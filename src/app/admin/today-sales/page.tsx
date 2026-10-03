import { requireAdmin } from "@/lib/auth";
import { AdminTodaySalesClient } from "./today-sales-client";

export default async function AdminTodaySalesPage() {
  await requireAdmin();
  return <AdminTodaySalesClient />;
}