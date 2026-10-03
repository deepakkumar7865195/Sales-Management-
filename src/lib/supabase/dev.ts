// Edge-safe helpers for the local dev bypass mode.
// Enabled with DEV_BYPASS_MODE=true (and NEXT_PUBLIC_DEV_BYPASS=true for
// client components). Lets the app run without a real Supabase project.

export const DEV_SESSION_COOKIE = "sb-dev-user";
export const DEV_MODE_ENV = "DEV_BYPASS_MODE";
export const DEV_MODE_PUBLIC_ENV = "NEXT_PUBLIC_DEV_BYPASS";

// Stable user IDs for the dev seed — also used by middleware auto-login.
export const DEV_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
export const DEV_STAFF_ID = "00000000-0000-4000-8000-000000000002";

export function isDevBypass(): boolean {
  return process.env.DEV_BYPASS_MODE === "true";
}

export function isDevBypassPublic(): boolean {
  return process.env.NEXT_PUBLIC_DEV_BYPASS === "true";
}

// Temporary credentials shown on the login card in dev mode.
export const DEV_CREDENTIALS = {
  adminEmail: "admin@example.com",
  adminPassword: "admin123",
  staffEmail: "staff@example.com",
  staffPassword: "staff123",
};