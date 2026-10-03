import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { AppUser } from "@/types";

export interface SessionUser {
  id: string;
  email: string;
  profile: AppUser | null;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email ?? "",
    profile: profile as AppUser | null,
  };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user || !user.profile || user.profile.status !== "active") {
    redirect("/login");
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.profile!.role !== "admin") {
    redirect("/dashboard");
  }
  return user;
}

export async function requireStaff() {
  const user = await requireUser();
  if (user.profile!.role !== "staff") {
    redirect("/dashboard");
  }
  return user;
}