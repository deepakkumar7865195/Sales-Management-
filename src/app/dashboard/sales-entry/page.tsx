import { requireStaff } from "@/lib/auth";
import { SalesEntryClient } from "@/components/sales-entry-client";

export default async function StaffSalesEntryPage() {
  const user = await requireStaff();
  return <SalesEntryClient userName={user.profile?.name ?? "Staff"} />;
}