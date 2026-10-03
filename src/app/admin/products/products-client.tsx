"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  Power,
  Search,
  Package,
  ImagePlus,
  ImageOff,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { formatCurrency } from "@/lib/utils";
import {
  createProductAction,
  updateProductAction,
  deleteProductAction,
  toggleProductStatusAction,
} from "@/app/actions/products";
import { uploadProductImageAction } from "@/app/actions/storage";
import type { Product } from "@/types";

interface Props {
  initialProducts: Product[];
}

export function AdminProductsClient({ initialProducts }: Props) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [viewing, setViewing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: "",
    sku: "",
    cost_price: "",
    selling_price: "",
    category: "",
    stock: "",
    status: "active" as "active" | "inactive",
  });

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[],
    [products]
  );

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        categoryFilter === "all" || p.category === categoryFilter;
      const matchesStatus =
        statusFilter === "all" || p.status === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [products, search, categoryFilter, statusFilter]);

  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      sku: "",
      cost_price: "",
      selling_price: "",
      category: "",
      stock: "",
      status: "active",
    });
    setImageUrl(null);
    setImagePath(null);
    setDialogOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku,
      cost_price: String(p.cost_price),
      selling_price: p.selling_price != null ? String(p.selling_price) : "",
      category: p.category ?? "",
      stock: p.stock != null ? String(p.stock) : "",
      status: p.status,
    });
    setImageUrl(p.image_url);
    setImagePath(null);
    setDialogOpen(true);
  }

  async function handleImageUpload(file: File) {
    setImageUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadProductImageAction(fd);
      if (res.error) {
        toast.error(res.error);
      } else {
        setImageUrl(res.url!);
        setImagePath(res.path!);
        toast.success("Image uploaded");
      }
    } finally {
      setImageUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("name", form.name);
      fd.set("sku", form.sku);
      fd.set("cost_price", form.cost_price);
      fd.set("selling_price", form.selling_price || "");
      fd.set("category", form.category);
      fd.set("stock", form.stock || "");
      fd.set("status", form.status);
      fd.set("image_url", imageUrl ?? editing?.image_url ?? "");

      const result = editing
        ? await updateProductAction(editing.id, {}, fd)
        : await createProductAction({}, fd);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
        setDialogOpen(false);
        window.location.reload();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(p: Product) {
    const res = await toggleProductStatusAction(
      p.id,
      p.status === "active" ? "inactive" : "active"
    );
    if (res.error) toast.error(res.error);
    else {
      toast.success(res.success);
      window.location.reload();
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    const res = await deleteProductAction(deleting.id);
    if (res.error) toast.error(res.error);
    else {
      toast.success(res.success);
      setDeleting(null);
      window.location.reload();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-muted-foreground text-sm">
            Manage product catalog, pricing and status
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" /> Add Product
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-xs">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search name or SKU…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-9 rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="hidden sm:table-cell">Cost</TableHead>
                  <TableHead className="hidden sm:table-cell">Selling</TableHead>
                  <TableHead className="hidden md:table-cell">Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow key="state">
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No products found
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {p.image_url ? (
                          <Image
                            src={p.image_url}
                            alt={p.name}
                            width={40}
                            height={40}
                            className="size-10 rounded-lg object-cover border"
                          />
                        ) : (
                          <div className="size-10 rounded-lg bg-muted flex items-center justify-center">
                            <Package className="size-4 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.category || "—"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                    <TableCell className="hidden sm:table-cell">{formatCurrency(p.cost_price)}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {p.selling_price != null ? formatCurrency(p.selling_price) : "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant={p.stock != null && p.stock <= 5 ? "warning" : "secondary"}>
                        {p.stock ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.status === "active" ? "success" : "secondary"}>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => setViewing(p)}>
                          <Eye className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(p)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => handleToggleStatus(p)}
                          title={p.status === "active" ? "Deactivate" : "Activate"}
                        >
                          <Power className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleting(p)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Product" : "Add Product"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update product details. Cost price is only visible to admin."
                : "Create a new product. Cost price is only visible to admin."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Image Upload */}
            <div className="flex items-center gap-4">
              <div className="relative size-24 rounded-lg border overflow-hidden bg-muted flex items-center justify-center">
                {imageUrl ? (
                  <Image src={imageUrl} alt="Preview" width={96} height={96} className="object-cover size-full" />
                ) : (
                  <ImageOff className="text-muted-foreground size-6" />
                )}
                {imageUploading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 className="size-6 animate-spin text-white" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <Label>Product Image</Label>
                <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm text-muted-foreground hover:bg-accent text-center justify-center">
                  <ImagePlus className="size-4" />
                  Upload / Replace Image
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImageUpload(f);
                    }}
                  />
                </label>
                <div className="flex gap-2 mt-2">
                  {imageUrl && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (imagePath) {
                          // Best-effort remove from storage
                        }
                        setImageUrl(null);
                        setImagePath(null);
                      }}
                    >
                      Remove Image
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Product Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="e.g. Widget Pro"
                />
              </div>
              <div className="space-y-2">
                <Label>SKU / Product Code *</Label>
                <Input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  required
                  placeholder="e.g. WP-001"
                />
              </div>
              <div className="space-y-2">
                <Label>Cost Price (₹) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.cost_price}
                  onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                  required
                  placeholder="e.g. 300"
                />
                <p className="text-xs text-muted-foreground">Hidden from staff (admin only)</p>
              </div>
              <div className="space-y-2">
                <Label>Default Selling Price (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.selling_price}
                  onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
                  placeholder="e.g. 500 (optional)"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="e.g. Electronics"
                />
              </div>
              <div className="space-y-2">
                <Label>Stock Quantity</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  placeholder="e.g. 50 (optional)"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Status</Label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as "active" | "inactive" })}
                  className="h-9 rounded-md border bg-transparent px-3 text-sm w-full"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                {editing ? "Save Changes" : "Add Product"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent>
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle>{viewing.name}</DialogTitle>
                <DialogDescription>SKU: {viewing.sku}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex justify-center">
                  {viewing.image_url ? (
                    <Image src={viewing.image_url} alt={viewing.name} width={160} height={160} className="rounded-lg object-cover h-40 w-40 border" />
                  ) : (
                    <div className="size-40 rounded-lg bg-muted flex items-center justify-center">
                      <Package className="size-10 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Category</p>
                    <p className="font-medium">{viewing.category || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Stock</p>
                    <p className="font-medium">{viewing.stock ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Cost Price</p>
                    <p className="font-medium">{formatCurrency(viewing.cost_price)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Selling Price</p>
                    <p className="font-medium">
                      {viewing.selling_price != null ? formatCurrency(viewing.selling_price) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Est. Profit Margin</p>
                    <p className="font-medium text-emerald-600">
                      {viewing.cost_price > 0 && viewing.selling_price != null
                        ? `${((viewing.selling_price - viewing.cost_price) / viewing.cost_price * 100).toFixed(1)}%`
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge variant={viewing.status === "active" ? "success" : "secondary"}>
                      {viewing.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleting?.name}"? This will permanently remove the product from your catalog. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}