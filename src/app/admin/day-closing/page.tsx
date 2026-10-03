import { requireAdmin } from "@/lib/auth";
import { DayClosingClient } from "./day-closing-client";

export default async function AdminDayClosingPage() {
  await requireAdmin();
  return <DayClosingClient />;
}