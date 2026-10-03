"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loginSchema, staffSchema, type StaffValues } from "@/lib/validations";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getErrorMessage } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

export type ActionState = {
  error?: string;
  success?: string;
};

export async function loginAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}

export async function signupAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!name) return { error: "Name is required" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { error: "Please enter a valid email address" };
  if (password.length < 8)
    return { error: "Password must be at least 8 characters" };

  const supabase = await createClient();

  // Only allow signup while the system has no users yet (bootstrap).
  const admin = createAdminClient();
  const { count } = await admin
    .from("users")
    .select("id", { count: "exact", head: true });

  if ((count ?? 0) > 0) {
    return {
      error: "Registration is closed. Please contact your administrator.",
    };
  }

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });

  if (authError) return { error: authError.message };
  if (!authData.user) return { error: "Signup failed. Please try again." };

  const { error: profileError } = await admin
    .from("users")
    .insert([{ id: authData.user.id, name, email, role: "admin" }]);

  if (profileError) {
    await supabase.auth.admin.deleteUser(authData.user.id);
    return { error: getErrorMessage(profileError) };
  }

  await recordAudit({
    userId: authData.user.id,
    userName: name,
    action: "staff_created",
    details: `System bootstrapped: admin account created (${email})`,
  });

  redirect("/dashboard");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function resetPasswordAction(email: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/reset-password`,
  });
  if (error) throw new Error(error.message);
}

export async function updatePasswordAction(newPassword: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (error) throw new Error(error.message);
}

export async function createStaffAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = staffSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.profile?.role !== "admin") {
    return { error: "Unauthorized" };
  }

  const admin = createAdminClient();
  const { data: authUser, error: authError } =
    await admin.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: { name: parsed.data.name },
    });

  if (authError) return { error: authError.message };

  const { error: profileError } = await admin.from("users").insert([
    {
      id: authUser.user!.id,
      name: parsed.data.name,
      email: parsed.data.email,
      role: "staff",
    },
  ]);

  if (profileError) {
    await admin.auth.admin.deleteUser(authUser.user!.id);
    return { error: getErrorMessage(profileError) };
  }

  await recordAudit({
    userId: currentUser.id,
    userName: currentUser.profile.name,
    action: "staff_created",
    details: `Staff account created for ${parsed.data.email} (${parsed.data.name})`,
  });

  revalidatePath("/admin/staff");
  return { success: `Staff account created for ${parsed.data.email}` };
}

export async function toggleStaffStatusAction(
  userId: string,
  status: "active" | "disabled"
) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.profile?.role !== "admin") {
    throw new Error("Unauthorized");
  }
  if (userId === currentUser.id && status === "disabled") {
    throw new Error("You cannot disable your own account");
  }

  const admin = createAdminClient();
  const profile = await admin.from("users").select("name, email").eq("id", userId).single();
  if (profile.error) throw new Error("User not found");

  const { error } = await admin
    .from("users")
    .update({ status })
    .eq("id", userId);
  if (error) throw new Error(error.message);

  if (status === "disabled") {
    await admin.auth.admin.updateUserById(userId, {
      ban_duration: "87600h",
    });
  } else {
    await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
  }

  await recordAudit({
    userId: currentUser.id,
    userName: currentUser.profile.name,
    action: status === "disabled" ? "staff_disabled" : "staff_enabled",
    details: `${status === "disabled" ? "Disabled" : "Enabled"} staff ${profile.data.email}`,
  });

  revalidatePath("/admin/staff");
}