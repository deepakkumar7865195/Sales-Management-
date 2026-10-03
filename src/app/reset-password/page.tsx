import { createClient } from "@/lib/supabase/server";
import { ResetPasswordClient } from "./reset-password-client";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <ResetPasswordClient
      canReset={!!user}
      error={error === "invalid_link" ? "invalid_link" : null}
    />
  );
}