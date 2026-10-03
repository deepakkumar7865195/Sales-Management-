"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Eye, Loader2, History, ListFilter } from "lucide-react";
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
import { getSalesHistoryAction, getSaleDetailAction } from "@/app/actions/sales";
import type { HistoryRow } from "@/app/actions/sales";
import type { SaleItem } from "@/types";
import { formatCurrency } from "@/lib/utils";

export interface StaffRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

interface Props {
  initialStaff: StaffRow[];
}

interface DetailData {
  sale: HistoryRow;
  items: SaleItem[];
}

export function SalesHistoryClient({ initialStaff }: Props) {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [staff] = useState<StaffRow[]>(initialStaff);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [staffId, setStaffId] = useState("all");
  const [applied, setApplied] = useState(false);
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const staffNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of staff) map.set(s.id, s.name);
    return map;
  }, [staff]);

  const load = useCallback(
    async (opts: { search: string; from: string; to: string; staffId: string }) => {
      try {
        const { rows: data } = await getSalesHistoryAction({
          search: opts.search || undefined,
          from: opts.from || undefined,
          to: opts.to || undefined,
          staffId: opts.staffId === "all" ? undefined : opts.staffId,
        });
        setRows(data);
      } catch (e) {
        toast.error(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    load({ search: "", from: "", to: "", staffId: "all" });
  }, [load]);

  function applyFilters() {
    setApplied(true);
    setLoading(true);
    load({ search, from, to, staffId });
  }

  function clearFilters() {
    setSearch("");
    setFrom("");
    setTo("");
    setStaffId("all");
    setApplied(false);
    setLoading(true);
    load({ search: "", from: "", to: "", staffId: "all" });
  }

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
      <div>
        <h1 className="text-2xl font-bold">Sales History</h1>
        <p className="text-muted-foreground text-sm">
          Browse all recorded transactions with filters
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ListFilter className="size-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-5">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search transaction ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">From</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">To</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Staff</label>
              <select
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="all">All Staff</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={applyFilters}>Apply Filters</Button>
            <Button variant="outline" onClick={clearFilters}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="size-4" />
            {rows.length} record(s)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Transaction</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead className="hidden md:table-cell">Items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Cost</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Profit</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow key="state">
                    <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                      <Loader2 className="mx-auto size-5 animate-spin mb-2" />
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow key="state">
                    <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                      {applied ? "No sales match your filters" : "No sales recorded yet"}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.transaction_id}</TableCell>
                      <TableCell className="hidden sm:table-cell">{r.sale_date}</TableCell>
                      <TableCell>{staffNames.get(r.staff_id) ?? r.staff_name ?? "Unknown"}</TableCell>
                      <TableCell className="hidden md:table-cell">{r.item_count}</TableCell>
                      <TableCell>
                        <Badge variant={r.status === "closed" ? "secondary" : "success"}>
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right text-muted-foreground">
                        {formatCurrency(r.total_cost)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right">
                        <span className={r.total_profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
                          {formatCurrency(r.total_profit)}
                        </span>
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