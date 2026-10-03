import { requireAdmin } from "@/lib/auth";
import { ReportsClient } from "./reports-client";

export default async function AdminReportsPage() {
  await requireAdmin();
  return <ReportsClient />;
}