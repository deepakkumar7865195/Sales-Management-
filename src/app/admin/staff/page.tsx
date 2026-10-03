import { requireAdmin } from "@/lib/auth";
import { listStaffAction } from "@/app/actions/settings";
import { StaffClient, type StaffRow } from "./staff-client";

export default async function AdminStaffPage() {
  await requireAdmin();
  const staff = await listStaffAction();
  return <StaffClient initialStaff={(staff ?? []) as StaffRow[]} />;
}