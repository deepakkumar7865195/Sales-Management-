"use client";

import { useMemo, useState } from "react";
import { ScrollText, Search, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
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

export interface AuditRow {
  id: string;
  user_id: string;
  user_name?: string;
  action: string;
  details: string;
  created_at: string;
}

interface Props {
  initialEntries: AuditRow[];
}

const actionVariant: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  sale_created: "success",
  product_added: "secondary",
  product_edited: "secondary",
  product_deleted: "destructive",
  cost_price_changed: "warning",
  day_closed: "warning",
  staff_created: "secondary",
  staff_disabled: "destructive",
  staff_enabled: "success",
  settings_updated: "secondary",
};

export function AuditClient({ initialEntries }: Props) {
  const [entries] = useState<AuditRow[]>(initialEntries);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.action.toLowerCase().includes(q) ||
        e.details.toLowerCase().includes(q) ||
        (e.user_name ?? "").toLowerCase().includes(q)
    );
  }, [entries, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-muted-foreground text-sm">
          Chronological record of actions performed in the system
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="size-4" />
              Activity log ({filtered.length})
            </CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search actions, users, details…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="hidden md:table-cell">Time</TableHead>
                  <TableHead className="hidden lg:table-cell">User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow key="state">
                    <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                      <ScrollText className="mx-auto size-8 mb-2 opacity-30" />
                      No audit entries found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="hidden md:table-cell whitespace-nowrap text-muted-foreground">
                        {new Date(e.created_at).toLocaleString("en-IN", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">{e.user_name ?? "System"}</TableCell>
                      <TableCell>
                        <Badge variant={actionVariant[e.action] ?? "secondary"}>
                          {e.action.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <span className="text-sm text-muted-foreground line-clamp-2">
                          {e.details}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}