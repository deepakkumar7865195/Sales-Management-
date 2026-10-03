"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { getErrorMessage } from "@/lib/utils";
import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { SettingsValues } from "@/lib/validations";

export type SettingsState = {
  error?: string;
  success?: string;
};

export async function getSettingsAction() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("settings")
    .select("*")
    .limit(1)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateSettingsAction(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  try {
    const user = await getCurrentUser();
    if (!user || user.profile?.role !== "admin") return { error: "Unauthorized" };

    const parsed = {
      business_name: String(formData.get("business_name") ?? "My Business"),
      business_phone: String(formData.get("business_phone") ?? "") || null,
      business_address: String(formData.get("business_address") ?? "") || null,
      currency: String(formData.get("currency") ?? "INR"),
      staff_can_view_profit: formData.get("staff_can_view_profit") === "on",
      low_stock_threshold: Number(formData.get("low_stock_threshold") ?? 5),
    };

    const adminClient = createAdminClient();
    const { data: existing } = await adminClient
      .from("settings")
      .select("id")
      .limit(1)
      .single();

    if (existing) {
      const { error } = await adminClient
        .from("settings")
        .update({ ...parsed, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) return { error: getErrorMessage(error) };
    }

    await recordAudit({
      userId: user.id,
      userName: user.profile.name,
      action: "settings_updated",
      details: "System settings updated",
    });

    revalidatePath("/admin/settings");
    return { success: "Settings updated" };
  } catch (e) {
    return { error: getErrorMessage(e) };
  }
}

export async function listStaffAction() {
  const user = await getCurrentUser();
  if (!user || user.profile?.role !== "admin") throw new Error("Unauthorized");

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("id, name, email, role, status, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function getAuditLogAction() {
  const user = await getCurrentUser();
  if (!user || user.profile?.role !== "admin") throw new Error("Unauthorized");

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);
  return data;
}

export async function getReportAction(
  period: "daily" | "monthly" | "yearly",
  key: string
) {
  const user = await getCurrentUser();
  if (!user || user.profile?.role !== "admin") throw new Error("Unauthorized");

  const admin = createAdminClient();
  const from = key;
  let query = admin.from("sales").select(
    "sale_date, total_sale, total_cost, total_profit, item_count, staff_id, users:staff_id(name)"
  );

  if (period === "daily") {
    query = query.eq("sale_date", key);
  } else if (period === "monthly") {
    query = query.gte("sale_date", `${key}-01`).lte("sale_date", `${key}-31`);
  } else {
    query = query.gte("sale_date", `${key}-01-01`).lte("sale_date", `${key}-12-31`);
  }

  query = query.order("sale_date", { ascending: false }).limit(5000);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((r) => ({
    sale_date: r.sale_date as string,
    total_sale: Number(r.total_sale),
    total_cost: Number(r.total_cost),
    total_profit: Number(r.total_profit),
    item_count: Number(r.item_count),
    staff_id: r.staff_id as string,
    staff_name: (r.users as { name?: string } | null)?.name ?? undefined,
  }));

  // Build summary
  const totalSales = rows.reduce((s, r) => s + r.total_sale, 0);
  const totalCost = rows.reduce((s, r) => s + r.total_cost, 0);
  const totalProfit = rows.reduce((s, r) => s + r.total_profit, 0);
  const productsSold = rows.reduce((s, r) => s + r.item_count, 0);
  const transactionDates = new Set(rows.map((r) => r.sale_date));

  // Per-staff breakdown
  const staffMap = new Map<
    string,
    { name: string; total_sale: number; total_profit: number; transactions: number }
  >();
  for (const r of rows) {
    const id = r.staff_id;
    const existing = staffMap.get(id) ?? {
      name: r.staff_name ?? "Unknown",
      total_sale: 0,
      total_profit: 0,
      transactions: 0,
    };
    existing.total_sale += r.total_sale;
    existing.total_profit += r.total_profit;
    existing.transactions += 1;
    staffMap.set(id, existing);
  }

  // Daily breakdown (for daily → no-op; for monthly → per day; for yearly → per month)
  const dailyBreakdown = new Map<
    string,
    { sales: number; cost: number; profit: number }
  >();
  for (const r of rows) {
    const d = r.sale_date;
    const existing = dailyBreakdown.get(d) ?? { sales: 0, cost: 0, profit: 0 };
    existing.sales += r.total_sale;
    existing.cost += r.total_cost;
    existing.profit += r.total_profit;
    dailyBreakdown.set(d, existing);
  }

  const dailySeries = Array.from(dailyBreakdown.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, d]) => ({
      label: date,
      ...d,
    }));

  return {
    totalSales,
    totalCost,
    totalProfit,
    productsSold,
    transactions: rows.length,
    distinctDates: transactionDates.size,
    staffBreakdown: Array.from(staffMap.entries()).map(([id, s]) => ({
      staff_id: id,
      ...s,
    })),
    dailySeries,
    rows,
  };
}