import { requireAdmin } from "@/lib/auth";
import { getSettingsAction } from "@/app/actions/settings";
import { SettingsClient, type SettingsRow } from "./settings-client";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = await getSettingsAction();
  return <SettingsClient initialSettings={(settings as SettingsRow | null) ?? null} />;
}