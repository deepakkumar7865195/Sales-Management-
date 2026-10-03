"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarCheck,
  Loader2,
  CheckCircle2,
  Wallet,
  TrendingUp,
  Package,
  Receipt,
  IndianRupee,
  User,
} from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  getDayClosePreviewAction,
  processDayCloseAction,
  getClosedDaysAction,
} from "@/app/actions/day-close";
import type { DailyClosing } from "@/types";
import { formatCurrency, formatNumber } from "@/lib/utils";

interface Preview {
  totalSale: number;
  totalCost: number;
  totalProfit: number;
  productsSold: number;
  transactions: number;
  alreadyClosed: boolean;
}

export function DayClosingClient() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [closedDays, setClosedDays] = useState<DailyClosing[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, days] = await Promise.all([
        getDayClosePreviewAction(),
        getClosedDaysAction(),
      ]);
      setPreview(p);
      setClosedDays(days);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleProcess() {
    setClosing(true);
    try {
      const res = await processDayCloseAction();
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.success ?? "Day closed");
        await load();
      }
    } finally {
      setClosing(false);
      setConfirmOpen(false);
    }
  }

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Day Closing</h1>
        <p className="text-muted-foreground text-sm">
          Preview today&apos;s totals and close the business day — {today}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Total Sales"
          value={formatCurrency(preview?.totalSale ?? 0)}
          icon={<IndianRupee className="size-5" />}
          accent="green"
          loading={loading}
        />
        <StatCard
          title="Total Cost"
          value={formatCurrency(preview?.totalCost ?? 0)}
          icon={<Wallet className="size-5" />}
          accent="red"
          loading={loading}
        />
        <StatCard
          title="Total Profit"
          value={formatCurrency(preview?.totalProfit ?? 0)}
          icon={<TrendingUp className="size-5" />}
          accent="blue"
          loading={loading}
        />
        <StatCard
          title="Products Sold"
          value={formatNumber(preview?.productsSold ?? 0)}
          icon={<Package className="size-5" />}
          accent="violet"
          loading={loading}
        />
        <StatCard
          title="Transactions"
          value={formatNumber(preview?.transactions ?? 0)}
          icon={<Receipt className="size-5" />}
          accent="amber"
          loading={loading}
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          {preview?.alreadyClosed ? (
            <div className="flex items-center gap-3 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/50 p-4 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="size-5 shrink-0" />
              <div>
                <p className="font-semibold">Today is already closed</p>
                <p className="text-xs opacity-80">
                  The day has been locked. Additional sales will need to be attributed to the next day.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <CalendarCheck className="size-5 text-muted-foreground" />
                <div>
                  <p className="font-semibold">Close business day</p>
                  <p className="text-xs text-muted-foreground">
                    Locks all {preview?.transactions ?? 0} transaction(s) and records the day&apos;s summary.
                  </p>
                </div>
              </div>
              <Button
                variant="success"
                size="lg"
                disabled={closing || (preview?.transactions ?? 0) === 0}
                onClick={() => setConfirmOpen(true)}
              >
                {closing ? <Loader2 className="size-5 animate-spin" /> : <CheckCircle2 className="size-5" />}
                {closing ? "Closing…" : "Close Day Now"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarCheck className="size-4" />
            Closed Days
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Date</TableHead>
                  <TableHead className="hidden sm:table-cell">Closed By</TableHead>
                  <TableHead className="text-right">Transactions</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Products</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow key="loading">
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      <Loader2 className="mx-auto size-5 animate-spin mb-2" />
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : closedDays.length === 0 ? (
                  <TableRow key="empty">
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      No closed days yet
                    </TableCell>
                  </TableRow>
                ) : (
                  closedDays.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.business_date}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="inline-flex items-center gap-1.5">
                          <User className="size-3 text-muted-foreground" />
                          {(d as DailyClosing & { closed_by_name?: string }).closed_by_name ?? "Admin"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{d.total_transactions}</TableCell>
                      <TableCell className="hidden md:table-cell text-right">{d.products_sold}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatCurrency(d.total_cost)}</TableCell>
                      <TableCell className="text-right">
                        <span className={d.total_profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
                          {formatCurrency(d.total_profit)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(d.total_sales)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close business day?</AlertDialogTitle>
            <AlertDialogDescription>
              This will lock all of today&apos;s {preview?.transactions ?? 0} sale(s) and record a closing
              entry of <span className="font-semibold">{formatCurrency(preview?.totalSale ?? 0)}</span>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleProcess} disabled={closing}>
              {closing ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Close Day
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}