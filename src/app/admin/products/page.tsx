import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminProductsClient } from "./products-client";

export default async function AdminProductsPage() {
  const user = await requireAdmin();
  const admin = createAdminClient();

  const { data: products, error } = await admin
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="p-6 text-destructive">
        Failed to load products: {error.message}
      </div>
    );
  }

  return <AdminProductsClient initialProducts={products ?? []} />;
}