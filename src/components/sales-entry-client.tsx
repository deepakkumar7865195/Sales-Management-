"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Loader2,
  Package,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { createSaleAction } from "@/app/actions/sales";
import { getSaleableProductsAction, type SaleableProduct } from "@/app/actions/sale-products";
import { useRealtime } from "@/hooks/use-realtime";

interface CartItem {
  product_id: string;
  name: string;
  quantity: number;
  selling_price: number;
  image_url: string | null;
}

interface Props {
  userName: string;
}

export function SalesEntryClient({ userName }: Props) {
  const [products, setProducts] = useState<SaleableProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SaleableProduct | null>(null);
  const [sellingPrice, setSellingPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [lastSale, setLastSale] = useState<{ id: string; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadProducts = useCallback(async () => {
    const data = await getSaleableProductsAction();
    setProducts(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Real-time product updates (admin adds/edits products → reflect here).
  useRealtime({ table: "products_realtime", event: "*", onChange: loadProducts });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );
  }, [products, search]);

  function selectProduct(p: SaleableProduct) {
    setSelected(p);
    setSellingPrice(p.selling_price != null ? String(p.selling_price) : "");
    setQuantity("1");
    inputRef.current?.focus();
  }

  function addToCart() {
    if (!selected) return;
    const price = Number(sellingPrice);
    const qty = Number(quantity);

    if (!price || price <= 0) {
      toast.error("Please enter a valid sale amount");
      return;
    }
    if (!qty || qty < 1) {
      toast.error("Please enter quantity");
      return;
    }

    setCart((prev) => {
      const existing = prev.find((c) => c.product_id === selected.id);
      if (existing) {
        return prev.map((c) =>
          c.product_id === selected.id
            ? { ...c, quantity: c.quantity + qty, selling_price: price }
            : c
        );
      }
      return [
        ...prev,
        {
          product_id: selected.id,
          name: selected.name,
          quantity: qty,
          selling_price: price,
          image_url: selected.image_url,
        },
      ];
    });

    setSelected(null);
    setSellingPrice("");
    setQuantity("1");
    setSearch("");
  }

  function updateCartItem(product_id: string, qty: number) {
    if (qty < 1) {
      removeCartItem(product_id);
      return;
    }
    setCart((prev) =>
      prev.map((c) =>
        c.product_id === product_id ? { ...c, quantity: qty } : c
      )
    );
  }

  function removeCartItem(product_id: string) {
    setCart((prev) => prev.filter((c) => c.product_id !== product_id));
  }

  const grandTotal = cart.reduce((s, c) => s + c.selling_price * c.quantity, 0);
  const totalItems = cart.reduce((s, c) => s + c.quantity, 0);

  async function submitSale() {
    if (cart.length === 0) {
      toast.error("Add at least one product to the sale");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set(
        "items",
        JSON.stringify(
          cart.map((c) => ({
            product_id: c.product_id,
            quantity: c.quantity,
            selling_price: c.selling_price,
          }))
        )
      );
      const result = await createSaleAction({}, fd);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Sale recorded: ${result.transactionId ?? ""}`, {
          description: `Total ${formatCurrency(
            cart.reduce((s, c) => s + c.selling_price * c.quantity, 0)
          )}`,
        });
        setCart([]);
        setSelected(null);
        setSellingPrice("");
        setQuantity("1");
        setSearch("");
        setLastSale({
          id: result.transactionId ?? "",
          total: cart.reduce((s, c) => s + c.selling_price * c.quantity, 0),
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = cart.length > 0 && !submitting;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      {/* Left: Product selection */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">New Sale</h1>
          <p className="text-muted-foreground text-sm">
            Select products, enter selling amount & quantity
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product by name or SKU…"
            className="pl-9 h-11 text-base"
            ref={inputRef}
          />
        </div>

        {selected && (
          <Card className="bg-primary text-primary-foreground border-0">
            <CardContent className="py-4 flex items-center gap-4">
              {selected.image_url ? (
                <Image
                  src={selected.image_url}
                  alt={selected.name}
                  width={64}
                  height={64}
                  className="size-16 rounded-lg object-cover border border-white/20"
                />
              ) : (
                <div className="size-16 rounded-lg bg-primary-foreground/10 flex items-center justify-center">
                  <Package className="size-6" />
                </div>
              )}
              <div className="flex-1 space-y-2">
                <div>
                  <p className="font-semibold">{selected.name}</p>
                  <p className="text-xs opacity-80">{selected.sku}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] uppercase opacity-70">
                      Sale Amount (₹)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={sellingPrice}
                      onChange={(e) => setSellingPrice(e.target.value)}
                      className="h-8 bg-primary-foreground/95 text-foreground"
                      placeholder="500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase opacity-70">
                      Quantity
                    </label>
                    <Input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="h-8 bg-primary-foreground/95 text-foreground"
                      placeholder="1"
                    />
                  </div>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="shrink-0 h-10 px-4"
                onClick={addToCart}
              >
                <Plus className="size-4" /> Add
              </Button>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-40 rounded-xl bg-muted animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => selectProduct(p)}
                className="text-left group relative rounded-xl border bg-white dark:bg-card p-3 transition-all hover:shadow-md hover:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="aspect-square w-full overflow-hidden rounded-lg bg-muted mb-2">
                  {p.image_url ? (
                    <Image
                      src={p.image_url}
                      alt={p.name}
                      width={120}
                      height={120}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="size-full flex items-center justify-center">
                      <Package className="size-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <p className="font-medium text-sm line-clamp-1">{p.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{p.sku}</p>
                <p className="text-sm font-semibold mt-1 text-emerald-600 dark:text-emerald-400">
                  {p.selling_price != null
                    ? formatCurrency(p.selling_price)
                    : "—"}
                </p>
                {p.stock != null && p.stock <= 5 && (
                  <Badge variant="warning" className="absolute top-4 right-4">
                    {p.stock} left
                  </Badge>
                )}
              </button>
            ))}
            {filtered.length === 0 && !loading && (
              <div className="col-span-full py-12 text-center text-muted-foreground">
                <Package className="mx-auto size-10 mb-2 opacity-40" />
                No products match "{search}"
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: Cart / Transaction */}
      <Card className="h-fit sticky top-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="size-4" />
            Sale Summary
            {cart.length > 0 && (
              <Badge variant="secondary">{cart.length} item(s)</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {cart.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingCart className="mx-auto size-10 mb-2 opacity-30" />
              <p className="text-sm">No items added yet</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {cart.map((c) => (
                  <div
                    key={c.product_id}
                    className="flex items-center gap-3 rounded-lg border p-2"
                  >
                    {c.image_url ? (
                      <Image
                        src={c.image_url}
                        alt={c.name}
                        width={40}
                        height={40}
                        className="size-10 rounded-md object-cover"
                      />
                    ) : (
                      <div className="size-10 rounded-md bg-muted flex items-center justify-center">
                        <Package className="size-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(c.selling_price)} × {c.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-6"
                        onClick={() =>
                          updateCartItem(c.product_id, c.quantity - 1)
                        }
                      >
                        <Minus className="size-3" />
                      </Button>
                      <span className="w-6 text-center text-sm">{c.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-6"
                        onClick={() =>
                          updateCartItem(c.product_id, c.quantity + 1)
                        }
                      >
                        <Plus className="size-3" />
                      </Button>
                    </div>
                    <p className="text-sm font-semibold w-20 text-right">
                      {formatCurrency(c.selling_price * c.quantity)}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 text-destructive"
                      onClick={() => removeCartItem(c.product_id)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Items</span>
                  <span>{totalItems}</span>
                </div>
                <div className="flex justify-between font-bold text-base">
                  <span>Grand Total</span>
                  <span>{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            </>
          )}

          <Button
            className="w-full h-12 text-base"
            variant="success"
            disabled={!canSubmit}
            onClick={submitSale}
          >
            {submitting ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <CheckCircle2 className="size-5" />
            )}
            {submitting ? "Recording sale…" : `+ Add Sale (${formatCurrency(grandTotal)})`}
          </Button>

          {lastSale && (
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/50 p-3 text-sm text-emerald-700 dark:text-emerald-300">
              <p className="font-semibold">✓ {lastSale.id} recorded</p>
              <p className="text-xs opacity-80">
                Staffed by {userName} · {formatCurrency(lastSale.total)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}