import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function DashboardRoot() {
  const user = await getCurrentUser();
  if (!user || !user.profile) redirect("/login");
  if (user.profile.role === "admin") redirect("/admin/dashboard");
  redirect("/dashboard/sales-entry");
}