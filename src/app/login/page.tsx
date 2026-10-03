"use client";

import { useFormStatus } from "react-dom";
import { useRef, useState } from "react";
import { loginAction, signupAction, resetPasswordAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import { isDevBypassPublic, DEV_CREDENTIALS } from "@/lib/supabase/dev";
import {
  Loader2,
  LogIn,
  KeyRound,
  Mail,
  User,
  ArrowLeft,
} from "lucide-react";

type Mode = "login" | "register" | "reset";

function SubmitButton({ mode }: { mode: Mode }) {
  const { pending } = useFormStatus();
  const icons: Record<Mode, React.ReactNode> = {
    login: pending ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />,
    register: pending ? <Loader2 className="size-4 animate-spin" /> : <User className="size-4" />,
    reset: pending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />,
  };

  const labels: Record<Mode, string> = {
    login: "Sign In",
    register: "Create Account",
    reset: "Send Reset Link",
  };

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {icons[mode]}
      {labels[mode]}
    </Button>
  );
}

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex items-center justify-center size-16 bg-primary text-primary-foreground rounded-2xl shadow-lg">
            <span className="text-2xl font-bold">₹</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Sales Manager
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Product Sales & Profit Management System
          </p>
        </div>

        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur dark:bg-card/80">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">
              {mode === "login"
                ? "Welcome Back"
                : mode === "register"
                  ? "Create Admin Account"
                  : "Reset Password"}
            </CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Enter your credentials to sign in"
                : mode === "register"
                  ? "Set up your first admin account"
                  : "Enter your email to receive a reset link"}
            </CardDescription>
          </CardHeader>

          {mode === "login" && isDevBypassPublic() && (
            <div className="mx-6 mb-2 rounded-md border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-left text-sm">
              <p className="font-medium text-foreground">Dev mode — temporary credentials</p>
              <div className="mt-1.5 space-y-0.5 font-mono text-xs text-muted-foreground">
                <p>Admin: {DEV_CREDENTIALS.adminEmail} / {DEV_CREDENTIALS.adminPassword}</p>
                <p>Staff: {DEV_CREDENTIALS.staffEmail} / {DEV_CREDENTIALS.staffPassword}</p>
              </div>
            </div>
          )}

          <CardContent>
            {mode === "login" && (
              <form
                ref={formRef}
                action={async (fd) => {
                  await loginAction({}, fd);
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="admin@example.com"
                      required
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="Enter password"
                      required
                      minLength={6}
                      className="pl-9"
                    />
                  </div>
                </div>
                <SubmitButton mode="login" />
              </form>
            )}

            {mode === "register" && (
              <form
                ref={formRef}
                action={async (fd) => {
                  await signupAction({}, fd);
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="reg-name">Full Name</Label>
                  <Input
                    id="reg-name"
                    name="name"
                    placeholder="Admin Name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email">Email</Label>
                  <Input
                    id="reg-email"
                    name="email"
                    type="email"
                    placeholder="admin@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">Password</Label>
                  <Input
                    id="reg-password"
                    name="password"
                    type="password"
                    placeholder="Min. 8 characters"
                    required
                    minLength={8}
                  />
                  <p className="text-xs text-muted-foreground">
                    Must contain at least 8 characters with letters and numbers
                  </p>
                </div>
                <SubmitButton mode="register" />
              </form>
            )}

            {mode === "reset" && (
              <form
                action={async (fd) => {
                  const email = String(fd.get("email") ?? "");
                  try {
                    await resetPasswordAction(email);
                    toast.success("Reset link sent", {
                      description: `Check your email (${email}) for the reset link`,
                    });
                    setMode("login");
                  } catch (e) {
                    toast.error(getErrorMessage(e));
                  }
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    name="email"
                    type="email"
                    placeholder="admin@example.com"
                    required
                  />
                </div>
                <SubmitButton mode="reset" />
              </form>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-2">
            {mode === "login" && (
              <>
                <Button
                  variant="link"
                  className="text-sm p-0 h-auto"
                  onClick={() => setMode("reset")}
                  type="button"
                >
                  Forgot password?
                </Button>
                <Button
                  variant="link"
                  className="text-sm p-0 h-auto"
                  onClick={() => setMode("register")}
                  type="button"
                >
                  First time? Create admin account
                </Button>
              </>
            )}

            {mode !== "login" && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1"
                onClick={() => setMode("login")}
                type="button"
              >
                <ArrowLeft className="size-4" />
                Back to Sign In
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}