import { requireAdmin } from "@/lib/auth";
import { AdminDashboardClient } from "./admin-dashboard-client";

export default async function AdminDashboardPage() {
  const user = await requireAdmin();
  return <AdminDashboardClient userName={user.profile?.name ?? "Admin"} />;
}