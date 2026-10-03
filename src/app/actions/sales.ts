"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { saleItemInputSchema, saleSchema } from "@/lib/validations";
import { getErrorMessage, todayKey } from "@/lib/utils";
import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { Sale, SaleItem } from "@/types";
import type { StaffDayStat } from "@/types/extra";

export type SaleActionState = {
  error?: string;
  success?: string;
  sale?: Sale;
  transactionId?: string;
};

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
function generateTransactionId(): string {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TXN-${y}${m}${d}-${rand}`;
}

function localDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ---------------------------------------------------------------------------
// CREATE SALE  (Server-side cost price lookup - staff can never supply it)
// ---------------------------------------------------------------------------
export async function createSaleAction(
  _prev: SaleActionState,
  formData: FormData
): Promise<SaleActionState> {
  try {
    const user = await getCurrentUser();
    if (!user || !user.profile || user.profile.status !== "active") {
      return { error: "Unauthorized" };
    }
    const isAdmin = user.profile.role === "admin";

    let rawItems: { product_id: string; quantity: number; selling_price: number }[];
    try {
      const itemsJson = String(formData.get("items") ?? "[]");
      rawItems = JSON.parse(itemsJson);
    } catch {
      return { error: "Invalid sale items" };
    }

    const parsedItems = rawItems
      .map((it) =>
        saleItemInputSchema.safeParse({
          product_id: it.product_id,
          quantity: it.quantity,
          selling_price: it.selling_price,
        })
      )
      .filter((r) => r.success)
      .map((r) => r.data);

    if (parsedItems.length === 0) {
      return { error: "Add at least one product with a valid quantity and amount" };
    }

    const parsed = saleSchema.safeParse({ items: parsedItems });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid sale" };
    }

    // Deduplicate lines by product id, merging quantities (fee-note: last
    // selling price wins for the same product in one transaction).
    const merged = new Map<
      string,
      { product_id: string; quantity: number; selling_price: number }
    >();
    for (const item of parsed.data.items) {
      const existing = merged.get(item.product_id);
      if (existing) {
        existing.quantity += item.quantity;
        existing.selling_price = item.selling_price;
      } else {
        merged.set(item.product_id, { ...item });
      }
    }
    const items = Array.from(merged.values());

    const admin = createAdminClient();
    const { data: products, error: productError } = await admin
      .from("products")
      .select("id, name, cost_price, status, stock")
      .in(
        "id",
        items.map((i) => i.product_id)
      );

    if (productError) return { error: getErrorMessage(productError) };
    if (!products || products.length !== items.length) {
      return { error: "One or more products could not be found" };
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of items) {
      const product = productMap.get(item.product_id)!;
      if (product.status !== "active") {
        return { error: `"${product.name}" is currently unavailable` };
      }
    }

    const computedItems: {
      product_id: string;
      product_name: string;
      quantity: number;
      selling_price: number;
      cost_price: number;
      total_sale: number;
      total_cost: number;
      profit: number;
    }[] = items.map((item) => {
      const product = productMap.get(item.product_id)!;
      const cost = Number(product.cost_price);
      const saleAmt = Number(item.selling_price);
      const quantity = item.quantity;
      return {
        product_id: product.id,
        product_name: product.name,
        quantity,
        selling_price: saleAmt,
        cost_price: cost,
        total_sale: +(saleAmt * quantity).toFixed(2),
        total_cost: +(cost * quantity).toFixed(2),
        profit: +((saleAmt - cost) * quantity).toFixed(2),
      };
    });

    const totalSale = +computedItems
      .reduce((s, i) => s + i.total_sale, 0)
      .toFixed(2);
    const totalCost = +computedItems
      .reduce((s, i) => s + i.total_cost, 0)
      .toFixed(2);
    const totalProfit = +(totalSale - totalCost).toFixed(2);
    const itemCount = computedItems.reduce((s, i) => s + i.quantity, 0);

    const transactionId = generateTransactionId();
    const today = localDateKey();
    const staffId = user.id; // Authority: always the logged-in user.

    const { data: sale, error: saleError } = await admin
      .from("sales")
      .insert({
        transaction_id: transactionId,
        staff_id: staffId,
        sale_date: today,
        total_sale: totalSale,
        total_cost: totalCost,
        total_profit: totalProfit,
        item_count: itemCount,
        status: "open",
      })
      .select()
      .single();

    if (saleError) return { error: getErrorMessage(saleError) };

    const { error: itemsError } = await admin
      .from("sale_items")
      .insert(
        computedItems.map((i) => ({ ...i, sale_id: sale.id }))
      );

    if (itemsError) {
      // Roll back the sale row to keep data consistent.
      await admin.from("sales").delete().eq("id", sale.id);
      return { error: getErrorMessage(itemsError) };
    }

    // Stock adjustment (best-effort, non-blocking).
    for (const item of computedItems) {
      const product = productMap.get(item.product_id)!;
      if (product.stock != null && Number(product.stock) > 0) {
        await admin
          .from("products")
          .update({
            stock: Math.max(0, Number(product.stock) - item.quantity),
            updated_at: new Date().toISOString(),
          })
          .eq("id", product.id);
      }
    }

    await recordAudit({
      userId: user.id,
      userName: user.profile.name,
      action: "sale_created",
      details: `Sale ${transactionId}: ${itemCount} items, total ${totalSale}`,
    });

    revalidatePath("/dashboard");
    revalidatePath("/my-sales");
    revalidatePath("/today-sales");
    revalidatePath("/admin/sales-history");

    return {
      success: `Sale ${transactionId} recorded`,
      sale: { ...sale, items: computedItems } as Sale,
      transactionId,
    };
  } catch (e) {
    return { error: getErrorMessage(e) };
  }
}

// ---------------------------------------------------------------------------
// QUERIES
// ---------------------------------------------------------------------------
export interface TodaySummary {
  totalSale: number;
  totalCost: number;
  totalProfit: number;
  productsSold: number;
  transactions: number;
  includingCost: boolean;
}

function timezoneDateKey(): string {
  return todayKey();
}

export async function getTodaySummaryAction(): Promise<TodaySummary> {
  const user = await getCurrentUser();
  if (!user || !user.profile) throw new Error("Unauthorized");

  const isAdmin = user.profile.role === "admin";
  const admin = createAdminClient();

  if (isAdmin) {
    const { data, error } = await admin.rpc("get_today_summary", {
      day: timezoneDateKey(),
    });
    if (error) {
      // Fallback to JS aggregation if the RPC doesn't exist yet.
      return todaySummaryFallback(admin, timezoneDateKey(), isAdmin);
    }
    const row = data as unknown as {
      total_sale: number;
      total_cost: number;
      total_profit: number;
      products_sold: number;
      transactions: number;
    } | null;
    return {
      totalSale: Number(row?.total_sale ?? 0),
      totalCost: Number(row?.total_cost ?? 0),
      totalProfit: Number(row?.total_profit ?? 0),
      productsSold: Number(row?.products_sold ?? 0),
      transactions: Number(row?.transactions ?? 0),
      includingCost: true,
    };
  }

  // Staff summary uses the realtime-safe aggregate table.
  const { data, error } = await admin
    .from("staff_day_stats")
    .select("*")
    .eq("staff_id", user.id)
    .eq("business_date", timezoneDateKey())
    .maybeSingle();

  if (error) throw new Error(error.message);

  const stat = data as StaffDayStat | null;
  const { data: settingsData } = await admin
    .from("settings")
    .select("staff_can_view_profit")
    .limit(1)
    .single();

  const canViewProfit = settingsData?.staff_can_view_profit === true;

  let profit = 0;
  if (canViewProfit) {
    const { data: profitAgg } = await admin
      .rpc("get_staff_profit_summary", {
        p_staff_id: user.id,
        day: timezoneDateKey(),
      });
    const agg = profitAgg as unknown as
      | { total_cost: number; total_profit: number }
      | null;
    profit = Number(agg?.total_profit ?? 0);
  }

  return {
    totalSale: Number(stat?.total_sale ?? 0),
    totalCost: canViewProfit ? 0 : 0,
    totalProfit: profit,
    productsSold: Number(stat?.products_sold ?? 0),
    transactions: Number(stat?.transactions ?? 0),
    includingCost: false,
  };
}

export async function todaySummaryFallback(
  admin: ReturnType<typeof createAdminClient>,
  day: string,
  _isAdmin: boolean
): Promise<TodaySummary> {
  const { data, error } = await admin
    .from("sales")
    .select("total_sale, total_cost, total_profit, item_count")
    .eq("sale_date", day);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as {
    total_sale: number;
    total_cost: number;
    total_profit: number;
    item_count: number;
  }[];

  return {
    totalSale: rows.reduce((s, r) => s + Number(r.total_sale), 0),
    totalCost: rows.reduce((s, r) => s + Number(r.total_cost), 0),
    totalProfit: rows.reduce((s, r) => s + Number(r.total_profit), 0),
    productsSold: rows.reduce((s, r) => s + Number(r.item_count), 0),
    transactions: rows.length,
    includingCost: true,
  };
}

// ---------------------------------------------------------------------------
// MY SALES (staff) & SALES HISTORY (admin)
// ---------------------------------------------------------------------------
export interface MySaleRow {
  id: string;
  transaction_id: string;
  sale_date: string;
  total_sale: number;
  item_count: number;
  status: string;
  created_at: string;
}

export async function getMySalesAction(date?: string): Promise<MySaleRow[]> {
  const user = await getCurrentUser();
  if (!user || !user.profile) throw new Error("Unauthorized");

  const admin = createAdminClient();
  let query = admin
    .from("sales")
    .select("id, transaction_id, sale_date, total_sale, item_count, status, created_at")
    .eq("staff_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (date) query = query.eq("sale_date", date);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as MySaleRow[];
}

export interface HistoryFilters {
  from?: string;
  to?: string;
  productId?: string;
  staffId?: string;
  search?: string;
}

export interface HistoryRow {
  id: string;
  transaction_id: string;
  staff_id: string;
  staff_name?: string;
  sale_date: string;
  total_sale: number;
  total_cost: number;
  total_profit: number;
  item_count: number;
  status?: string;
  created_at: string;
}

export async function getSalesHistoryAction(
  filters: HistoryFilters = {}
): Promise<{ rows: HistoryRow[] }> {
  const user = await getCurrentUser();
  if (!user || user.profile?.role !== "admin") throw new Error("Unauthorized");

  const admin = createAdminClient();

  let query = admin
    .from("sales")
    .select(
      "id, transaction_id, staff_id, sale_date, total_sale, total_cost, total_profit, item_count, created_at, users:staff_id(name)"
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (filters.from) query = query.gte("sale_date", filters.from);
  if (filters.to) query = query.lte("sale_date", filters.to);
  if (filters.staffId) query = query.eq("staff_id", filters.staffId);
  if (filters.search) {
    query = query.ilike("transaction_id", `%${filters.search}%`);
  }
  if (filters.productId) {
    const { data: saleIds } = await admin
      .from("sale_items")
      .select("sale_id")
      .eq("product_id", filters.productId);
    if (!saleIds || saleIds.length === 0) return { rows: [] };
    query = query.in(
      "id",
      saleIds.map((s) => s.sale_id)
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((r) => ({
    id: r.id,
    transaction_id: r.transaction_id,
    staff_id: r.staff_id,
    staff_name: (r.users as { name?: string } | null)?.name ?? undefined,
    sale_date: r.sale_date,
    total_sale: Number(r.total_sale),
    total_cost: Number(r.total_cost),
    total_profit: Number(r.total_profit),
    item_count: Number(r.item_count),
    created_at: r.created_at,
  })) as HistoryRow[];

  return { rows };
}

export async function getSaleDetailAction(
  saleId: string
): Promise<{ sale: Sale; items: SaleItem[] } | null> {
  const admin = createAdminClient();
  const user = await getCurrentUser();
  if (!user || !user.profile) throw new Error("Unauthorized");
  const isAdmin = user.profile.role === "admin";

  const { data: sale, error } = await admin
    .from("sales")
    .select(
      "id, transaction_id, staff_id, sale_date, total_sale, total_cost, total_profit, item_count, status, created_at, users:staff_id(name)"
    )
    .eq("id", saleId)
    .single();

  if (error || !sale) return null;

  if (!isAdmin && sale.staff_id !== user.id) return null;

  const { data: items } = await admin
    .from("sale_items")
    .select("*")
    .eq("sale_id", saleId);

  return {
    sale: {
      ...sale,
      staff_name: (sale.users as { name?: string } | null)?.name ?? undefined,
      items: (items ?? []) as SaleItem[],
    } as Sale,
    items: (items ?? []) as SaleItem[],
  };
}

export async function getDashboardSalesAction(
  window: "today" | "yesterday" | "week" | "month"
): Promise<number> {
  const user = await getCurrentUser();
  if (!user || user.profile?.role !== "admin") throw new Error("Unauthorized");
  const admin = createAdminClient();

  const from = windowStart(window);
  if (!from) return 0;

  const { data, error } = await admin
    .from("sales")
    .select("total_sale")
    .gte("sale_date", from);

  if (error) throw new Error(error.message);
  return (data ?? []).reduce((s, r) => s + Number(r.total_sale), 0);
}

function windowStart(window: "today" | "yesterday" | "week" | "month"): string | null {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");

  switch (window) {
    case "today":
      return `${y}-${m}-${d}`;
    case "yesterday": {
      const w = new Date(now);
      w.setDate(w.getDate() - 1);
      const wy = w.getFullYear();
      const wm = String(w.getMonth() + 1).padStart(2, "0");
      const wd = String(w.getDate()).padStart(2, "0");
      return `${wy}-${wm}-${wd}`;
    }
    case "week": {
      const w = new Date(now);
      w.setDate(w.getDate() - 6);
      const wy = w.getFullYear();
      const wm = String(w.getMonth() + 1).padStart(2, "0");
      const wd = String(w.getDate()).padStart(2, "0");
      return `${wy}-${wm}-${wd}`;
    }
    case "month":
      return `${y}-${m}-01`;
    default:
      return null;
  }
}