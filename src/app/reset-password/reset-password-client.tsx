"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Lock, AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import { updatePasswordAction } from "@/app/actions/auth";

interface Props {
  canReset: boolean;
  error: "invalid_link" | null;
}

export function ResetPasswordClient({ canReset, error }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      await updatePasswordAction(password);
      toast.success("Password updated", {
        description: "You can now sign in with your new password",
      });
      router.push("/login");
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

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
          {!canReset ? (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto size-12 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center mb-2">
                  <AlertTriangle className="size-6" />
                </div>
                <CardTitle className="text-xl">Invalid or expired link</CardTitle>
                <CardDescription>
                  This password reset link is invalid or has already been used.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-3">
                <Link href="/reset-password" className="text-sm text-muted-foreground">
                  Request a new reset link
                </Link>
                <Link href="/login" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                  <ArrowLeft className="size-4" />
                  Back to Sign In
                </Link>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="text-center">
                <CardTitle className="text-xl">Set a new password</CardTitle>
                <CardDescription>
                  {error === "invalid_link"
                    ? "The link was invalid — but you are signed in, so set a new password directly."
                    : "Choose a strong password for your account."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="new-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        required
                        minLength={8}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirm-password"
                        type="password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="Re-enter password"
                        required
                        minLength={8}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Lock className="size-4" />
                    )}
                    Update Password
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}