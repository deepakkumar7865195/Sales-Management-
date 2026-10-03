import { requireStaff } from "@/lib/auth";
import { MySalesClient } from "./my-sales-client";

export default async function DashboardMySalesPage() {
  await requireStaff();
  return <MySalesClient />;
}