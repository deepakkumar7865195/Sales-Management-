"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  TrendingUp,
  History,
  Sun,
  Moon,
  LogOut,
  Users,
  Settings,
  Menu,
  X,
  ScrollText,
  CalendarCheck,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useTheme } from "next-themes";
import { logoutAction } from "@/app/actions/auth";
import type { AppUser } from "@/types";

interface SidebarProps {
  role: "admin" | "staff";
  user: AppUser;
  collapsed?: boolean;
  onToggle?: () => void;
}

const adminNav = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/sales-entry", label: "Sales Entry", icon: ShoppingCart },
  { href: "/admin/today-sales", label: "Today's Sales", icon: TrendingUp },
  { href: "/admin/sales-history", label: "Sales History", icon: History },
  { href: "/admin/day-closing", label: "Day Closing", icon: CalendarCheck },
  { href: "/admin/reports", label: "Reports", icon: ScrollText },
  { href: "/admin/staff", label: "Staff", icon: Users },
  { href: "/admin/audit", label: "Audit Log", icon: ScrollText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

const staffNav = [
  { href: "/dashboard/sales-entry", label: "Sales Entry", icon: ShoppingCart },
  { href: "/dashboard/today-sales", label: "Today's Sales", icon: TrendingUp },
  { href: "/dashboard/my-sales", label: "My Sales", icon: History },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  collapsed?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-accent",
        active && "bg-accent text-accent-foreground shadow-sm",
        !active && "text-muted-foreground hover:text-foreground",
        collapsed && "justify-center px-2"
      )}
      title={collapsed ? label : undefined}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}

export function Sidebar({ role, user, collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const items = role === "admin" ? adminNav : staffNav;

  return (
    <aside
      className={cn(
        "flex flex-col h-screen border-r bg-card/80 backdrop-blur-sm transition-all",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className={cn("flex items-center h-16 px-4 border-b", collapsed && "justify-center px-2")}>
        {!collapsed && (
          <div className="flex items-center gap-2 flex-1">
            <div className="flex items-center justify-center size-8 bg-primary text-primary-foreground rounded-lg">
              <span className="text-sm font-bold">₹</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">Sales Manager</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{role}</p>
            </div>
          </div>
        )}
        {onToggle && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={onToggle}
          >
            {collapsed ? (
              <Menu className="size-4" />
            ) : (
              <ChevronLeft className="size-4" />
            )}
          </Button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={
              pathname === item.href ||
              (pathname.startsWith(item.href) && item.href !== "/admin/dashboard" && item.href !== "/dashboard")
            }
            collapsed={collapsed}
          />
        ))}
      </nav>

      <div className={cn("p-3 border-t", collapsed && "flex flex-col items-center")}>
        <ThemeToggle />
        {!collapsed && <Separator className="my-2" />}
        <form action={logoutAction}>
          <Button
            variant="ghost"
            className={cn(
              "w-full text-muted-foreground hover:text-destructive",
              collapsed && "w-auto p-2"
            )}
            title="Logout"
          >
            <LogOut className="size-4 shrink-0" />
            {!collapsed && <span className="ml-2">Logout</span>}
          </Button>
        </form>
      </div>
    </aside>
  );
}

export function MobileSidebar({ role }: { role: "admin" | "staff" }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = role === "admin" ? adminNav : staffNav;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden size-9">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="flex items-center gap-2">
            <div className="flex items-center justify-center size-8 bg-primary text-primary-foreground rounded-lg">
              <span className="text-sm font-bold">₹</span>
            </div>
            Sales Manager
          </SheetTitle>
        </SheetHeader>
        <nav className="flex-1 p-3 space-y-1">
          {items.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={
                pathname === item.href ||
                (pathname.startsWith(item.href) && item.href !== "/admin/dashboard" && item.href !== "/dashboard")
              }
            />
          ))}
        </nav>
        <div className="p-3 border-t">
          <form action={logoutAction}>
            <Button variant="ghost" className="w-full text-muted-foreground hover:text-destructive">
              <LogOut className="size-4" />
              <span className="ml-2">Logout</span>
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function TopBar({
  name,
  role,
  children,
}: {
  name: string;
  role: string;
  children?: React.ReactNode;
}) {
  const { theme, setTheme } = useTheme();

  return (
    <header className="h-16 border-b bg-card/80 backdrop-blur-sm flex items-center justify-between px-4 md:px-6 gap-4">
      <div className="flex items-center gap-3">
        <MobileSidebar role={role as "admin" | "staff"} />
        {children}
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2 text-sm">
          <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs">
            {name
              .split(" ")
              .map((w) => w[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)}
          </div>
          <div>
            <p className="font-medium leading-none">{name}</p>
            <p className="text-xs text-muted-foreground capitalize">{role}</p>
          </div>
        </div>
      </div>
    </header>
  );
}