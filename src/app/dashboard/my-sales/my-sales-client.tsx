"use client";

import { useCallback, useEffect, useState } from "react";
import { History, Eye, Loader2, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import { getMySalesAction, getSaleDetailAction } from "@/app/actions/sales";
import type { MySaleRow } from "@/app/actions/sales";
import type { SaleItem } from "@/types";
import { formatCurrency } from "@/lib/utils";

function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function MySalesClient() {
  const [rows, setRows] = useState<MySaleRow[]>([]);
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<{ sale: { transaction_id: string; sale_date: string; status: string; created_at: string; total_sale: number; item_count: number }; items: SaleItem[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async (d?: string) => {
    try {
      const data = await getMySalesAction(d || undefined);
      setRows(data);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function applyDate() {
    setLoading(true);
    load(date || undefined);
  }

  function clearDate() {
    setDate("");
    setLoading(true);
    load();
  }

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

  const total = rows.reduce((s, r) => s + Number(r.total_sale), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Sales</h1>
        <p className="text-muted-foreground text-sm">
          All sales recorded by you {date ? `on ${date}` : ""}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="size-4" />
            Filter by date
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="sm:max-w-xs"
            placeholder={todayStr()}
          />
          <div className="flex gap-2">
            <Button onClick={applyDate} variant="outline">Apply</Button>
            <Button onClick={clearDate} variant="ghost">Show all</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="size-4" />
            {rows.length} sale(s)
            {rows.length > 0 && (
              <span className="text-muted-foreground font-normal text-sm">
                · Total {formatCurrency(total)}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Transaction</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Sold On</TableHead>
                  <TableHead className="hidden sm:table-cell">Items</TableHead>
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
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow key="state">
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      {date ? "No sales on this date" : "No sales recorded yet"}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.transaction_id}</TableCell>
                      <TableCell>{r.sale_date}</TableCell>
                      <TableCell>{new Date(r.created_at).toLocaleDateString("en-IN")}</TableCell>
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