"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShieldCheck,
  Users,
  Megaphone,
  AlertTriangle,
  BarChart3,
  DollarSign,
  MessageSquare,
  Settings,
  ScrollText,
  Menu,
} from "lucide-react";
import { AdminSearch } from "@/components/admin-search";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/approvals", label: "Approvals", icon: ShieldCheck },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/admin/reports", label: "Reports", icon: AlertTriangle },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/revenue", label: "Revenue", icon: DollarSign },
  {
    href: "/admin/communications",
    label: "Communications",
    icon: MessageSquare,
  },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/audit", label: "Audit", icon: ScrollText },
];

function SidebarContent({
  onNavigate,
  showSearch = true,
}: {
  onNavigate?: () => void;
  showSearch?: boolean;
}) {
  const pathname = usePathname();

  return (
    <>
      <div className="flex h-14 items-center border-b border-border px-5">
        <Link href="/" onClick={onNavigate}>
          <span className="text-lg font-bold text-foreground">PopsDrops</span>
        </Link>
      </div>
      {showSearch && (
        <div className="px-3 pt-3">
          <AdminSearch />
        </div>
      )}
      <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-4">
        <div className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname === item.href ||
                  pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                <item.icon className="size-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="flex items-center justify-between border-t border-border px-5 py-3">
        <p className="text-xs text-muted-foreground">Admin Panel</p>
        <ThemeToggle />
      </div>
    </>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-svh bg-muted/50">
      {/* Mobile header */}
      <div className="fixed inset-x-0 top-0 z-40 flex items-center gap-3 border-b border-border bg-card px-4 py-3 md:hidden">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger
            render={<Button variant="ghost" size="icon" />}
          >
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-60 p-0" showCloseButton={false}>
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarContent onNavigate={() => setSidebarOpen(false)} showSearch={false} />
          </SheetContent>
        </Sheet>
        <div className="flex-1">
          <AdminSearch />
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r border-border bg-card">
        <SidebarContent />
      </aside>

      {/* Main content */}
      <main className="flex-1 pt-14 md:pt-0">{children}</main>
    </div>
  );
}
