"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { productSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";
import { getErrorMessage } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import type { AuditAction, Product } from "@/types";

export type ProductActionState = {
  error?: string;
  success?: string;
  product?: Product;
};

function requireAdminUser() {
  // Thrown errors are caught by callers.
  return getCurrentUser().then((u) => {
    if (!u || u.profile?.role !== "admin") {
      throw new Error("Unauthorized");
    }
    return u;
  });
}

export async function createProductAction(
  _prev: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  try {
    const user = await requireAdminUser();
    const parsed = productSchema.safeParse({
      name: formData.get("name"),
      sku: formData.get("sku"),
      cost_price: formData.get("cost_price"),
      selling_price: formData.get("selling_price") || null,
      category: formData.get("category") || null,
      stock: formData.get("stock") || null,
      status: formData.get("status"),
      image_url: formData.get("image_url") || null,
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("products")
      .insert([parsed.data])
      .select()
      .single();

    if (error) return { error: getErrorMessage(error) };

    await recordAudit({
      userId: user.id,
      userName: user.profile!.name,
      action: "product_added",
      details: `Added product "${data.name}" (SKU ${data.sku})`,
    });

    revalidatePath("/admin/products");
    return { success: `Product "${data.name}" added`, product: data };
  } catch (e) {
    return { error: getErrorMessage(e) };
  }
}

export async function updateProductAction(
  productId: string,
  _prev: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  try {
    const user = await requireAdminUser();
    const parsed = productSchema.safeParse({
      name: formData.get("name"),
      sku: formData.get("sku"),
      cost_price: formData.get("cost_price"),
      selling_price: formData.get("selling_price") || null,
      category: formData.get("category") || null,
      stock: formData.get("stock") || null,
      status: formData.get("status"),
      image_url: formData.get("image_url") || null,
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("products")
      .select("cost_price")
      .eq("id", productId)
      .single();

    const costChanged =
      existing && Number(existing.cost_price) !== Number(parsed.data.cost_price);

    const { data, error } = await admin
      .from("products")
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq("id", productId)
      .select()
      .single();

    if (error) return { error: getErrorMessage(error) };

    await recordAudit({
      userId: user.id,
      userName: user.profile!.name,
      action: costChanged ? "cost_price_changed" : "product_edited",
      details: costChanged
        ? `Cost Price changed for "${data.name}" from ${existing?.cost_price} to ${data.cost_price}`
        : `Edited product "${data.name}" (SKU ${data.sku})`,
    });

    revalidatePath("/admin/products");
    return { success: `Product "${data.name}" updated`, product: data };
  } catch (e) {
    return { error: getErrorMessage(e) };
  }
}

export async function deleteProductAction(productId: string) {
  try {
    const user = await requireAdminUser();
    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("products")
      .select("name, sku, image_url")
      .eq("id", productId)
      .single();

    if (!existing) throw new Error("Product not found");

    if (existing.image_url) {
      const { imagePath } = getBucketPath(existing.image_url);
      if (imagePath) {
        await admin.storage.from("product-images").remove([imagePath]);
      }
    }

    const { error } = await admin.from("products").delete().eq("id", productId);
    if (error) throw new Error(error.message);

    await recordAudit({
      userId: user.id,
      userName: user.profile!.name,
      action: "product_deleted",
      details: `Deleted product "${existing.name}"`,
    });

    revalidatePath("/admin/products");
    return { success: `Product "${existing.name}" deleted` };
  } catch (e) {
    return { error: getErrorMessage(e) };
  }
}

export async function toggleProductStatusAction(
  productId: string,
  status: "active" | "inactive"
) {
  return updateProductStatusRaw(productId, status);
}

async function updateProductStatusRaw(
  productId: string,
  status: "active" | "inactive"
) {
  try {
    const user = await requireAdminUser();
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("products")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", productId)
      .select("name")
      .single();

    if (error) throw new Error(error.message);

    await recordAudit({
      userId: user.id,
      userName: user.profile!.name,
      action: "product_edited",
      details: `Product "${data.name}" set to ${status}`,
    });

    revalidatePath("/admin/products");
    return { success: `Product "${data.name}" ${status}` };
  } catch (e) {
    return { error: getErrorMessage(e) };
  }
}

export async function listProductsAction(): Promise<Product[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Product[];
}

export async function getProductAction(productId: string): Promise<Product | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("products")
    .select("*")
    .eq("id", productId)
    .single();

  if (error) return null;
  return data as Product;
}

function getBucketPath(url: string) {
  const match = url.match(/\/product-images\/(.+)$/);
  return { imagePath: match?.[1] ?? null };
}