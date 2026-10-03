import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createMockClient } from "./mock";
import { isDevBypassPublic } from "./dev";

export function createClient() {
  if (isDevBypassPublic()) {
    return createMockClient() as unknown as ReturnType<typeof createSupabaseClient>;
  }

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}