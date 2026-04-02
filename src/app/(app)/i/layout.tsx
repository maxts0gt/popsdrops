"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, FolderOpen, DollarSign, User } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { NotificationBell } from "@/components/shared/notification-bell";
import { PageTransition } from "@/components/page-transition";

const navItems = [
  { href: "/i/home", labelKey: "nav.home", icon: Home },
  { href: "/i/discover", labelKey: "nav.discover", icon: Search },
  { href: "/i/campaigns", labelKey: "nav.campaigns", icon: FolderOpen },
  { href: "/i/earnings", labelKey: "nav.earnings", icon: DollarSign },
  { href: "/i/profile", labelKey: "nav.profile", icon: User },
] as const;

export default function CreatorAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { t, isRTL } = useTranslation("ui.common");

  return (
    <div className="flex min-h-svh flex-col bg-slate-50 lg:flex-row">
      {/* Desktop sidebar (lg+) */}
      <aside className="hidden lg:flex lg:w-20 lg:flex-col lg:items-center lg:border-e lg:border-slate-200 lg:bg-white lg:py-6">
        <Link href="/" className="mb-8">
          <span className="text-lg font-bold text-primary">PD</span>
        </Link>
        <nav className="flex flex-1 flex-col items-center gap-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs transition-colors ${
                  isActive
                    ? "font-medium text-primary"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <item.icon className="size-5" />
                <span>{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6">
          <Link href="/" className="lg:hidden">
            <span className="text-lg font-bold text-primary">PopsDrops</span>
          </Link>
          <div className="hidden lg:block" />
          <NotificationBell href="/i/notifications" />
        </header>

        {/* Page content */}
        <main className="flex-1 pb-20 lg:pb-0">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="flex items-center justify-around">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] transition-colors ${
                  isActive
                    ? "font-medium text-primary"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <item.icon className="size-5" />
                <span>{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
