"use client";

import { useCallback, useEffect, useState } from "react";
import { TrendingUp, Eye, Loader2, ShoppingBag } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRealtime } from "@/hooks/use-realtime";
import { getTodaySummaryAction, getMySalesAction, getSaleDetailAction } from "@/app/actions/sales";
import type { MySaleRow } from "@/app/actions/sales";
import type { SaleItem } from "@/types";
import { formatCurrency, formatNumber } from "@/lib/utils";

function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function timeOf(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function StaffTodaySalesClient() {
  const [rows, setRows] = useState<MySaleRow[]>([]);
  const [summary, setSummary] = useState<{
    totalSale: number;
    totalProfit: number;
    productsSold: number;
    transactions: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<{ sale: { transaction_id: string; sale_date: string; status: string; created_at: string; total_sale: number; item_count: number }; items: SaleItem[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, sales] = await Promise.all([
        getTodaySummaryAction(),
        getMySalesAction(todayStr()),
      ]);
      setSummary({
        totalSale: s.totalSale,
        totalProfit: s.totalProfit,
        productsSold: s.productsSold,
        transactions: s.transactions,
      });
      setRows(sales);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRealtime = useCallback(() => {
    setRefreshing(true);
    setTimeout(async () => {
      await load();
      setRefreshing(false);
    }, 400);
  }, [load]);

  useRealtime({ table: "sales", event: "INSERT", onChange: handleRealtime });

  async function openDetail(id: string) {
    setDetailLoading(true);
    try {
      const data = await getSaleDetailAction(id);
      if (data) {
        setDetail({
          sale: {
            transaction_id: data.sale.transaction_id,
            sale_date: data.sale.sale_date,
            status: data.sale.status,
            created_at: data.sale.created_at,
            total_sale: data.sale.total_sale,
            item_count: data.sale.item_count,
          },
          items: data.items,
        });
      }
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Today&apos;s Sales</h1>
          <p className="text-muted-foreground text-sm">
            Your sales for {todayStr()}
          </p>
        </div>
        {refreshing && (
          <Badge variant="secondary" className="animate-pulse">
            Live syncing…
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Today's Sale"
          value={formatCurrency(summary?.totalSale ?? 0)}
          icon={<TrendingUp className="size-5" />}
          accent="green"
          loading={loading}
        />
        <StatCard
          title="Transactions"
          value={formatNumber(summary?.transactions ?? 0)}
          icon={<ShoppingBag className="size-5" />}
          accent="blue"
          loading={loading}
        />
        <StatCard
          title="Products Sold"
          value={formatNumber(summary?.productsSold ?? 0)}
          icon={<TrendingUp className="size-5" />}
          accent="violet"
          loading={loading}
        />
      </div>

      {summary && summary.totalProfit > 0 && (
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/50 p-4 text-emerald-700 dark:text-emerald-300">
          <p className="text-sm font-medium">
            Your contribution today: {formatCurrency(summary.totalProfit)} profit
          </p>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="size-4" />
            My transactions today
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Transaction</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="hidden sm:table-cell">Items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow key="state">
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      <Loader2 className="mx-auto size-5 animate-spin mb-2" />
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow key="state">
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      No sales recorded by you today
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.transaction_id}</TableCell>
                      <TableCell>{timeOf(r.created_at)}</TableCell>
                      <TableCell className="hidden sm:table-cell">{r.item_count}</TableCell>
                      <TableCell>
                        <Badge variant={r.status === "closed" ? "secondary" : "success"}>
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(r.total_sale)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => openDetail(r.id)}>
                          <Eye className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="sm:max-w-2xl">
          {detailLoading && (
            <div className="py-10 text-center text-muted-foreground">
              <Loader2 className="mx-auto size-6 animate-spin mb-2" />
              Loading…
            </div>
          )}
          {detail && !detailLoading && (
            <>
              <DialogHeader>
                <DialogTitle>{detail.sale.transaction_id}</DialogTitle>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>Date: {detail.sale.sale_date}</span>
                  <span>·</span>
                  <span>Time: {timeOf(detail.sale.created_at)}</span>
                  <span>·</span>
                  <Badge variant={detail.sale.status === "closed" ? "secondary" : "success"}>
                    {detail.sale.status}
                  </Badge>
                </div>
              </DialogHeader>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Product</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.items.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell className="font-medium">{it.product_name}</TableCell>
                        <TableCell className="text-center">{it.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(it.selling_price)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(it.total_sale)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end">
                <div className="text-sm text-muted-foreground">
                  <span>Items: {detail.sale.item_count} · Total: </span>
                  <span className="font-bold text-base text-foreground">
                    {formatCurrency(detail.sale.total_sale)}
                  </span>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}