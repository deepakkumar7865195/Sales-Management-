"use client";

import { useState } from "react";
import { Settings, Save, Loader2, Building2, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { updateSettingsAction } from "@/app/actions/settings";

export interface SettingsRow {
  id?: string;
  business_name: string;
  business_phone: string | null;
  business_address: string | null;
  currency: string;
  staff_can_view_profit: boolean;
  low_stock_threshold: number;
}

interface Props {
  initialSettings: SettingsRow | null;
}

const currencyOptions = ["INR", "USD", "EUR", "GBP", "AED", "SAR"];

export function SettingsClient({ initialSettings }: Props) {
  const [form, setForm] = useState<SettingsRow>({
    business_name: initialSettings?.business_name ?? "My Business",
    business_phone: initialSettings?.business_phone ?? "",
    business_address: initialSettings?.business_address ?? "",
    currency: initialSettings?.currency ?? "INR",
    staff_can_view_profit: initialSettings?.staff_can_view_profit ?? false,
    low_stock_threshold: initialSettings?.low_stock_threshold ?? 5,
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("business_name", form.business_name);
      fd.set("business_phone", form.business_phone || "");
      fd.set("business_address", form.business_address || "");
      fd.set("currency", form.currency);
      fd.set("staff_can_view_profit", form.staff_can_view_profit ? "on" : "off");
      fd.set("low_stock_threshold", String(form.low_stock_threshold));
      const res = await updateSettingsAction({}, fd);
      if (res.error) toast.error(res.error);
      else toast.success(res.success ?? "Settings saved");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Configure your business profile and system preferences
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="size-4" />
            Business Profile
          </CardTitle>
          <CardDescription>
            Shown throughout the app for billing and branding.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Business Name *</Label>
                <Input
                  value={form.business_name}
                  onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                  required
                  placeholder="e.g. Sharma Traders"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={form.business_phone ?? ""}
                  onChange={(e) => setForm({ ...form, business_phone: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={form.business_address ?? ""}
                onChange={(e) => setForm({ ...form, business_address: e.target.value })}
                placeholder="Shop address, city"
              />
            </div>
            <div className="space-y-2 sm:max-w-xs">
              <Label>Currency</Label>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              >
                {currencyOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="pt-4 border-t space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Allow staff to view profit</p>
                  <p className="text-xs text-muted-foreground">
                    If enabled, staff can see their daily profit figures
                  </p>
                </div>
                <Switch
                  checked={form.staff_can_view_profit}
                  onCheckedChange={(v) => setForm({ ...form, staff_can_view_profit: v })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <BellRing className="size-3" />
                    Low Stock Threshold
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.low_stock_threshold}
                    onChange={(e) =>
                      setForm({ ...form, low_stock_threshold: Number(e.target.value) })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Products at or below this stock level show a warning badge
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="size-4" />
            About
          </CardTitle>
          <CardDescription>
            Product Sales, Cost Price, Billing &amp; Profit Management System.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Cost prices and profit margins are restricted to admin accounts. Staff
            only record sales against products without ever seeing margin data.
          </p>
          <p className="text-xs">
            All sensitive actions are tracked in the audit log for accountability.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}