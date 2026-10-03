"use client";

import { useState } from "react";
import {
  Plus,
  UserPlus,
  Power,
  Loader2,
  Users,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import {
  createStaffAction,
  toggleStaffStatusAction,
} from "@/app/actions/auth";

export interface StaffRow {
  id: string;
  name: string;
  email: string;
  role: "admin" | "staff";
  status: "active" | "disabled";
  created_at: string;
}

interface Props {
  initialStaff: StaffRow[];
}

export function StaffClient({ initialStaff }: Props) {
  const [staff] = useState<StaffRow[]>(initialStaff);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("name", form.name);
      fd.set("email", form.email);
      fd.set("password", form.password);
      const res = await createStaffAction({}, fd);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.success);
        setDialogOpen(false);
        setForm({ name: "", email: "", password: "" });
        window.location.reload();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(s: StaffRow) {
    try {
      await toggleStaffStatusAction(
        s.id,
        s.status === "active" ? "disabled" : "active"
      );
      toast.success(s.status === "active" ? "Staff disabled" : "Staff enabled");
      window.location.reload();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Staff</h1>
          <p className="text-muted-foreground text-sm">
            Create and manage staff accounts
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" /> Add Staff
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="size-4" />
            Accounts ({staff.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.length === 0 && (
                  <TableRow key="state">
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      No staff created yet
                    </TableCell>
                  </TableRow>
                )}
                {staff.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground md:hidden">{s.email}</p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Mail className="size-3" />
                        {s.email}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.role === "admin" ? "default" : "secondary"}>
                        {s.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.status === "active" ? "success" : "destructive"}>
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {s.created_at?.slice(0, 10)}
                    </TableCell>
                    <TableCell className="text-right">
                      {s.role === "staff" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggle(s)}
                          title={s.status === "active" ? "Disable account" : "Enable account"}
                        >
                          <Power className="size-3" />
                          {s.status === "active" ? "Disable" : "Enable"}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Staff Account</DialogTitle>
            <DialogDescription>
              Staff can record sales but never see cost prices or profit.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Ravi Kumar"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="staff@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Password *</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Min. 8 chars with letters & numbers"
                required
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">
                Must contain at least 8 characters with letters and numbers
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                Create Staff
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}