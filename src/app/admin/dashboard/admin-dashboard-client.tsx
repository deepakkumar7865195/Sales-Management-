"use client";

import { useEffect, useCallback, useState } from "react";
import {
  IndianRupee,
  Wallet,
  TrendingUp,
  Package,
  Receipt,
  CalendarCheck,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRealtime } from "@/hooks/use-realtime";
import { getTodaySummaryAction } from "@/app/actions/sales";
import { getDayClosePreviewAction } from "@/app/actions/day-close";
import { formatCurrency, formatNumber } from "@/lib/utils";

export function AdminDashboardClient({ userName }: { userName: string }) {
  const [summary, setSummary] = useState<{
    totalSale: number;
    totalCost: number;
    totalProfit: number;
    productsSold: number;
    transactions: number;
  } | null>(null);
  const [closed, setClosed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await getTodaySummaryAction();
      setSummary({
        totalSale: s.totalSale,
        totalCost: s.totalCost,
        totalProfit: s.totalProfit,
        productsSold: s.productsSold,
        transactions: s.transactions,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPreview = useCallback(async () => {
    try {
      const p = await getDayClosePreviewAction();
      setClosed(p.alreadyClosed);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    load();
    loadPreview();
  }, [load, loadPreview]);

  // Real-time: when a new sale is inserted anywhere, re-fetch the summary.
  const handleRealtime = useCallback(() => {
    setRefreshing(true);
    // small debounce to let the DB trigger settle
    setTimeout(async () => {
      await load();
      await loadPreview();
      setRefreshing(false);
    }, 400);
  }, [load, loadPreview]);

  useRealtime({ table: "sales", event: "INSERT", onChange: handleRealtime });

  const currentDate = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back, {userName}
          </h1>
          <p className="text-muted-foreground text-sm">{currentDate}</p>
        </div>
        <div className="flex items-center gap-2">
          {refreshing && (
            <Badge variant="secondary" className="animate-pulse">
              Live syncing…
            </Badge>
          )}
          <Button asChild>
            <Link href="/admin/sales-entry">
              <Receipt className="size-4" /> New Sale
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/day-closing">
              <CalendarCheck className="size-4" /> Process Day
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Today's Sale"
          value={formatCurrency(summary?.totalSale ?? 0)}
          icon={<IndianRupee className="size-5" />}
          accent="green"
          loading={loading}
          subtitle={`${summary?.transactions ?? 0} transaction(s)`}
        />
        <StatCard
          title="Today's Cost"
          value={formatCurrency(summary?.totalCost ?? 0)}
          icon={<Wallet className="size-5" />}
          accent="red"
          loading={loading}
        />
        <StatCard
          title="Today's Profit"
          value={formatCurrency(summary?.totalProfit ?? 0)}
          icon={<TrendingUp className="size-5" />}
          accent="blue"
          loading={loading}
        />
        <StatCard
          title="Products Sold"
          value={formatNumber(summary?.productsSold ?? 0)}
          icon={<Package className="size-5" />}
          accent="violet"
          loading={loading}
        />
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <div className="size-10 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 flex items-center justify-center">
                <ArrowUpRight className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">New sale recorded</p>
                <p className="text-xs text-muted-foreground">
                  Real-time updates are active — dashboard auto-refreshes
                </p>
              </div>
              <Badge variant="success">Live</Badge>
            </div>

            <div className="flex items-center gap-3 rounded-lg border p-3">
              <div className="size-10 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 flex items-center justify-center">
                <ArrowDownRight className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Day status</p>
                <p className="text-xs text-muted-foreground">
                  Use "Process Day" to close and lock today's sales
                </p>
              </div>
              <Badge variant={closed ? "success" : "warning"}>
                {closed ? "Closed" : "Open"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/admin/products">
                <Package className="size-4" /> Manage Products
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/admin/sales-history">
                <Receipt className="size-4" /> View Sales History
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/admin/reports">
                <TrendingUp className="size-4" /> View Reports
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/admin/staff">
                <Package className="size-4" /> Manage Staff
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}