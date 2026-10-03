"use client";

import { useCallback, useEffect, useState } from "react";
import {
  IndianRupee,
  Wallet,
  TrendingUp,
  Package,
  Eye,
  Loader2,
  Receipt,
} from "lucide-react";
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
import {
  getTodaySummaryAction,
  getSalesHistoryAction,
  getSaleDetailAction,
} from "@/app/actions/sales";
import type { HistoryRow } from "@/app/actions/sales";
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

interface DetailData {
  sale: HistoryRow;
  items: SaleItem[];
}

export function AdminTodaySalesClient() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [summary, setSummary] = useState<{
    totalSale: number;
    totalCost: number;
    totalProfit: number;
    productsSold: number;
    transactions: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, sales] = await Promise.all([
        getTodaySummaryAction(),
        getSalesHistoryAction({ from: todayStr(), to: todayStr() }),
      ]);
      setSummary({
        totalSale: s.totalSale,
        totalCost: s.totalCost,
        totalProfit: s.totalProfit,
        productsSold: s.productsSold,
        transactions: s.transactions,
      });
      setRows(sales.rows);
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
      if (data) setDetail({ sale: data.sale as unknown as HistoryRow, items: data.items });
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
            Live view of all transactions for {todayStr()}
          </p>
        </div>
        {refreshing && (
          <Badge variant="secondary" className="animate-pulse">
            Live syncing…
          </Badge>
        )}
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="size-4" />
            Transactions today
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Transaction</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="hidden sm:table-cell">Staff</TableHead>
                  <TableHead className="hidden md:table-cell">Items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow key="state">
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      <Loader2 className="mx-auto size-5 animate-spin mb-2" />
                      Loading today&apos;s sales…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow key="state">
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      No sales recorded today yet
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.transaction_id}</TableCell>
                      <TableCell>{timeOf(r.created_at)}</TableCell>
                      <TableCell className="hidden sm:table-cell">{r.staff_name ?? "Unknown"}</TableCell>
                      <TableCell className="hidden md:table-cell">{r.item_count}</TableCell>
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
                  <span>Staff: {detail.sale.staff_name ?? "Unknown"}</span>
                  <span>·</span>
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
                        <TableCell>
                          <p className="font-medium">{it.product_name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{it.product_id.slice(0, 8)}</p>
                        </TableCell>
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