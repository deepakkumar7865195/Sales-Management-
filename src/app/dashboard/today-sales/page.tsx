import { requireStaff } from "@/lib/auth";
import { StaffTodaySalesClient } from "./staff-today-sales-client";

export default async function DashboardTodaySalesPage() {
  await requireStaff();
  return <StaffTodaySalesClient />;
}