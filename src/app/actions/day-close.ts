"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { getErrorMessage } from "@/lib/utils";
import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { DailyClosing } from "@/types";

export type DayCloseState = {
  error?: string;
  success?: string;
  closing?: DailyClosing;
};

function dayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function getDayClosePreviewAction() {
  const user = await getCurrentUser();
  if (!user || user.profile?.role !== "admin") throw new Error("Unauthorized");

  const admin = createAdminClient();
  const day = dayKey();

  const { data: sales, error } = await admin
    .from("sales")
    .select("total_sale, total_cost, total_profit, item_count")
    .eq("sale_date", day);

  if (error) throw new Error(error.message);

  const rows = (sales ?? []) as {
    total_sale: number;
    total_cost: number;
    total_profit: number;
    item_count: number;
  }[];

  const { data: closingExists } = await admin
    .from("daily_closing")
    .select("id")
    .eq("business_date", day)
    .maybeSingle();

  return {
    totalSale: rows.reduce((s, r) => s + Number(r.total_sale), 0),
    totalCost: rows.reduce((s, r) => s + Number(r.total_cost), 0),
    totalProfit: rows.reduce((s, r) => s + Number(r.total_profit), 0),
    productsSold: rows.reduce((s, r) => s + Number(r.item_count), 0),
    transactions: rows.length,
    alreadyClosed: !!closingExists,
  };
}

export async function processDayCloseAction(): Promise<DayCloseState> {
  try {
    const user = await getCurrentUser();
    if (!user || user.profile?.role !== "admin") {
      return { error: "Unauthorized" };
    }

    const admin = createAdminClient();
    const day = dayKey();

    const { data: existing } = await admin
      .from("daily_closing")
      .select("id")
      .eq("business_date", day)
      .maybeSingle();

    if (existing) {
      return { error: "This day has already been closed" };
    }

    const { data: sales, error: salesError } = await admin
      .from("sales")
      .select("total_sale, total_cost, total_profit, item_count, id")
      .eq("sale_date", day);

    if (salesError) return { error: getErrorMessage(salesError) };

    const rows = (sales ?? []) as {
      total_sale: number;
      total_cost: number;
      total_profit: number;
      item_count: number;
      id: string;
    }[];

    if (rows.length === 0) {
      return { error: "No sales to close for today" };
    }

    const totalSale = rows.reduce((s, r) => s + Number(r.total_sale), 0);
    const totalCost = rows.reduce((s, r) => s + Number(r.total_cost), 0);
    const totalProfit = rows.reduce((s, r) => s + Number(r.total_profit), 0);
    const productsSold = rows.reduce((s, r) => s + Number(r.item_count), 0);
    const transactions = rows.length;

    const { data: closing, error: closingError } = await admin
      .from("daily_closing")
      .insert({
        business_date: day,
        total_sales: totalSale,
        total_cost: totalCost,
        total_profit: totalProfit,
        total_transactions: transactions,
        products_sold: productsSold,
        closed_by: user.id,
      })
      .select()
      .single();

    if (closingError) return { error: getErrorMessage(closingError) };

    // Mark all sales as closed.
    const ids = rows.map((r) => r.id);
    if (ids.length > 0) {
      await admin
        .from("sales")
        .update({ status: "closed" })
        .in("id", ids);
    }

    await recordAudit({
      userId: user.id,
      userName: user.profile.name,
      action: "day_closed",
      details: `Day ${day} closed: Sales ${totalSale}, Cost ${totalCost}, Profit ${totalProfit}, Transactions ${transactions}`,
    });

    revalidatePath("/admin/day-closing");
    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/sales-history");
    revalidatePath("/today-sales");

    return {
      success: `Day ${day} closed successfully`,
      closing: closing as DailyClosing,
    };
  } catch (e) {
    return { error: getErrorMessage(e) };
  }
}

export async function getClosedDaysAction(): Promise<DailyClosing[]> {
  const user = await getCurrentUser();
  if (!user || user.profile?.role !== "admin") throw new Error("Unauthorized");

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("daily_closing")
    .select("*, users:closed_by(name)")
    .order("business_date", { ascending: false })
    .limit(120);

  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({
    ...r,
    closed_by_name: (r.users as { name?: string } | null)?.name ?? undefined,
  })) as unknown as DailyClosing[];
}