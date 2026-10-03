import { requireAdmin } from "@/lib/auth";
import { SalesEntryClient } from "@/components/sales-entry-client";

export default async function AdminSalesEntryPage() {
  const user = await requireAdmin();
  return <SalesEntryClient userName={user.profile?.name ?? "Admin"} />;
}