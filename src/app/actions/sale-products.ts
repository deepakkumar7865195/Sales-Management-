"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

export interface SaleableProduct {
  id: string;
  name: string;
  sku: string;
  image_url: string | null;
  selling_price: number | null;
  category: string | null;
  stock: number | null;
}

export async function getSaleableProductsAction(): Promise<SaleableProduct[]> {
  const user = await getCurrentUser();
  if (!user || !user.profile) throw new Error("Unauthorized");

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("products")
    .select(
      "id, name, sku, image_url, selling_price, category, stock, status"
    )
    .eq("status", "active")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    image_url: p.image_url,
    selling_price: p.selling_price != null ? Number(p.selling_price) : null,
    category: p.category,
    stock: p.stock,
  }));
}