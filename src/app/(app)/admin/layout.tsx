"use client";

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
} from "lucide-react";

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

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-svh bg-slate-50">
      {/* Sidebar */}
      <aside className="flex w-60 flex-col border-r border-slate-200 bg-white">
        <div className="flex h-14 items-center border-b border-slate-200 px-5">
          <Link href="/">
            <span className="text-lg font-bold text-slate-900">PopsDrops</span>
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
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
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-slate-100 font-medium text-slate-900"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <item.icon className="size-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
        <div className="border-t border-slate-200 px-5 py-3">
          <p className="text-xs text-slate-400">Admin Panel</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
