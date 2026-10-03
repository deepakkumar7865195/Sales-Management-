import { requireAdmin } from "@/lib/auth";
import { getAuditLogAction } from "@/app/actions/settings";
import { AuditClient, type AuditRow } from "./audit-client";

export default async function AdminAuditPage() {
  await requireAdmin();
  const entries = await getAuditLogAction();
  return <AuditClient initialEntries={(entries ?? []) as AuditRow[]} />;
}