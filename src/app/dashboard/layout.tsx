import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Sidebar, TopBar } from "@/components/app-shell";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user || !user.profile || user.profile.status !== "active") {
    redirect("/login");
  }
  // Admins belong in the /admin area — send them there instead of looping.
  if (user.profile.role === "admin") {
    redirect("/admin/dashboard");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role="staff" user={user.profile!} collapsed={false} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar name={user.profile?.name ?? "Staff"} role={user.profile?.role ?? "staff"} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-muted/20">
          {children}
        </main>
      </div>
    </div>
  );
}