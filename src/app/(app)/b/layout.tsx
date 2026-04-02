"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Megaphone,
  Users,
  Bell,
  Settings,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useTranslation } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";
import { NotificationBell } from "@/components/shared/notification-bell";
import { PageTransition } from "@/components/page-transition";

const navItems = [
  { href: "/b/home", labelKey: "nav.home", icon: Home },
  { href: "/b/campaigns", labelKey: "nav.campaigns", icon: Megaphone },
  { href: "/b/creators", labelKey: "nav.creators", icon: Users },
  { href: "/b/notifications", labelKey: "nav.notifications", icon: Bell },
  { href: "/b/settings", labelKey: "nav.settings", icon: Settings },
] as const;

function SidebarNav({ pathname, t }: { pathname: string; t: (key: string) => string }) {
  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              isActive
                ? "bg-primary/5 font-medium text-primary"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <item.icon className="size-5" />
            <span>{t(item.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function BrandAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { t } = useTranslation("ui.common");

  return (
    <div className="flex min-h-svh bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:border-e lg:border-slate-200 lg:bg-white">
        <div className="flex h-14 items-center border-b border-slate-200 px-6">
          <Link href="/">
            <span className="text-lg font-bold text-primary">PopsDrops</span>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarNav pathname={pathname} t={t} />
        </div>
        <div className="border-t border-slate-200 p-3">
          <LanguageSwitcher variant="minimal" />
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:hidden">
          <Sheet>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon-sm" />
              }
            >
              <Menu className="size-5" />
              <span className="sr-only">{t("nav.home")}</span>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetTitle className="sr-only">{t("nav.home")}</SheetTitle>
              <SheetDescription className="sr-only">
                {t("nav.home")}
              </SheetDescription>
              <div className="flex h-14 items-center border-b border-slate-200 px-6">
                <Link href="/">
                  <span className="text-lg font-bold text-primary">PopsDrops</span>
                </Link>
              </div>
              <div className="px-3 py-4">
                <SidebarNav pathname={pathname} t={t} />
              </div>
            </SheetContent>
          </Sheet>
          <Link href="/" className="flex-1">
            <span className="text-lg font-bold text-primary">PopsDrops</span>
          </Link>
          <NotificationBell href="/b/notifications" />
        </header>

        {/* Page content */}
        <main className="flex-1">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
