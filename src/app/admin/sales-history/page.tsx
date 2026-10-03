import { requireAdmin } from "@/lib/auth";
import { listStaffAction } from "@/app/actions/settings";
import { SalesHistoryClient, type StaffRow } from "./sales-history-client";

export default async function AdminSalesHistoryPage() {
  await requireAdmin();
  const staff = await listStaffAction();
  return <SalesHistoryClient initialStaff={(staff ?? []) as StaffRow[]} />;
}