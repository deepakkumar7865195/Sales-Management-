import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { createMockClient } from "./mock";
import { isDevBypass } from "./dev";

// Server-only client with admin privileges. NEVER import this into
// client components or Server Actions used by unauthenticated users.
export function createAdminClient() {
  if (isDevBypass()) {
    return createMockClient() as unknown as ReturnType<typeof createSupabaseAdminClient>;
  }

  return createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}