import { requireAdmin } from "@/lib/auth";
import { Sidebar, TopBar } from "@/components/app-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role="admin" user={user.profile!} collapsed={false} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar name={user.profile?.name ?? "Admin"} role={user.profile?.role ?? "admin"} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-muted/20">
          {children}
        </main>
      </div>
    </div>
  );
}