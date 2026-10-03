"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ScrollText,
  Loader2,
  IndianRupee,
  Wallet,
  TrendingUp,
  Package,
  Receipt,
  CalendarDays,
  Users,
} from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import { getReportAction } from "@/app/actions/settings";
import { formatCurrency, formatNumber } from "@/lib/utils";

type Period = "daily" | "monthly" | "yearly";

interface Report {
  totalSales: number;
  totalCost: number;
  totalProfit: number;
  productsSold: number;
  transactions: number;
  distinctDates: number;
  staffBreakdown: {
    staff_id: string;
    name: string;
    total_sale: number;
    total_profit: number;
    transactions: number;
  }[];
  dailySeries: { label: string; sales: number; cost: number; profit: number }[];
  rows: {
    sale_date: string;
    staff_name?: string;
    total_sale: number;
    total_cost: number;
    total_profit: number;
    item_count: number;
  }[];
}

function currentKey(period: Period): { key: string; label: string } {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  if (period === "daily") return { key: `${y}-${m}-${day}`, label: d.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) };
  if (period === "monthly") return { key: `${y}-${m}`, label: d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }) };
  return { key: `${y}`, label: String(y) };
}

function maxSales(series: Report["dailySeries"]) {
  return series.reduce((m, s) => Math.max(m, s.sales), 0);
}

export function ReportsClient() {
  const [period, setPeriod] = useState<Period>("daily");
  const [report, setReport] = useState<Report | null>(null);
  const [series, setSeries] = useState<Report["dailySeries"]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(currentKey("daily").label);

  const load = useCallback(async (p: Period) => {
    const { key, label } = currentKey(p);
    try {
      const data = await getReportAction(p, key);
      setReport(data as unknown as Report);
      setSeries(data.dailySeries as unknown as Report["dailySeries"]);
      setRange(label);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(period);
  }, [period, load]);

  function switchTab(p: Period) {
    setLoading(true);
    setPeriod(p);
  }

  const max = maxSales(series);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-muted-foreground text-sm">
          Sales, cost and profit summaries for {range}
        </p>
      </div>

      <Tabs value={period} onValueChange={(v) => switchTab(v as Period)}>
        <TabsList>
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="yearly">Yearly</TabsTrigger>
        </TabsList>
        <TabsContent value={period} className="mt-0">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard
              title="Total Sales"
              value={formatCurrency(report?.totalSales ?? 0)}
              icon={<IndianRupee className="size-5" />}
              accent="green"
              loading={loading}
            />
            <StatCard
              title="Total Cost"
              value={formatCurrency(report?.totalCost ?? 0)}
              icon={<Wallet className="size-5" />}
              accent="red"
              loading={loading}
            />
            <StatCard
              title="Total Profit"
              value={formatCurrency(report?.totalProfit ?? 0)}
              icon={<TrendingUp className="size-5" />}
              accent="blue"
              loading={loading}
            />
            <StatCard
              title="Products Sold"
              value={formatNumber(report?.productsSold ?? 0)}
              icon={<Package className="size-5" />}
              accent="violet"
              loading={loading}
            />
            <StatCard
              title="Transactions"
              value={formatNumber(report?.transactions ?? 0)}
              icon={<Receipt className="size-5" />}
              accent="amber"
              loading={loading}
            />
            <StatCard
              title="Active Days"
              value={formatNumber(report?.distinctDates ?? 0)}
              icon={<CalendarDays className="size-5" />}
              accent="primary"
              loading={loading}
            />
          </div>
        </TabsContent>
      </Tabs>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ScrollText className="size-4" />
              {period === "daily" ? "Daily Breakdown" : period === "monthly" ? "Daily Series (month)" : "Monthly Series (year)"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : series.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                No data for this period
              </div>
            ) : (
              <div className="space-y-2">
                {series.map((s) => (
                  <div key={s.label} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-xs font-mono text-muted-foreground">
                      {s.label}
                    </span>
                    <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                      <div
                        className="h-full bg-emerald-500/80 rounded transition-all"
                        style={{ width: max > 0 ? `${(s.sales / max) * 100}%` : "0%" }}
                      />
                    </div>
                    <span className="w-24 shrink-0 text-right text-xs font-semibold">
                      {formatCurrency(s.sales)}
                    </span>
                    <span className="hidden sm:block w-24 shrink-0 text-right text-xs">
                      <span className={s.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
                        {formatCurrency(s.profit)}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="size-4" />
              Staff Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Staff</TableHead>
                    <TableHead className="text-center">Sales</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow key="state">
                      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                        <Loader2 className="mx-auto size-4 animate-spin" />
                      </TableCell>
                    </TableRow>
                  ) : (report?.staffBreakdown ?? []).length === 0 ? (
                    <TableRow key="state">
                      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                        No staff activity
                      </TableCell>
                    </TableRow>
                  ) : (
                    (report?.staffBreakdown ?? []).map((s) => (
                      <TableRow key={s.staff_id}>
                        <TableCell>
                          <span className="font-medium">{s.name}</span>
                          <Badge variant="secondary" className="ml-2">{s.transactions}</Badge>
                        </TableCell>
                        <TableCell className="text-center">{s.transactions}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(s.total_sale)}</TableCell>
                        <TableCell className="text-right">
                          <span className={s.total_profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
                            {formatCurrency(s.total_profit)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="size-4" />
            Raw Transactions ({report?.transactions ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Date</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead className="text-center">Items</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow key="state">
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      <Loader2 className="mx-auto size-4 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : (report?.rows ?? []).length === 0 ? (
                  <TableRow key="state">
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No transactions in this period
                    </TableCell>
                  </TableRow>
                ) : (
                  [report!].flatMap((r) => r.rows ?? []).slice(0, 200).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{row.sale_date}</TableCell>
                      <TableCell>{row.staff_name ?? "Unknown"}</TableCell>
                      <TableCell className="text-center">{row.item_count}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatCurrency(row.total_cost)}</TableCell>
                      <TableCell className="text-right">
                        <span className={row.total_profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
                          {formatCurrency(row.total_profit)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(row.total_sale)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end p-4">
            <Button variant="outline" size="sm" disabled>
              Top 200 shown
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}