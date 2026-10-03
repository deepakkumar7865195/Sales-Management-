import { createAdminClient } from "@/lib/supabase/admin";
import type { AuditAction } from "@/types";

interface AuditPayload {
  userId: string;
  userName: string;
  action: AuditAction;
  details: string;
}

export async function recordAudit({
  userId,
  userName,
  action,
  details,
}: AuditPayload) {
  try {
    const supabase = createAdminClient();
    await supabase.from("audit_log").insert({
      user_id: userId,
      user_name: userName,
      action,
      details: details.slice(0, 500),
    });
  } catch {
    // Audit failures should never break the primary operation.
  }
}