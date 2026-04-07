"use client";

import { useState } from "react";
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
import { ThemeToggle } from "@/components/theme-toggle";
import { PageTransition } from "@/components/page-transition";

const navItems = [
  { href: "/b/home", labelKey: "nav.home", icon: Home },
  { href: "/b/campaigns", labelKey: "nav.campaigns", icon: Megaphone },
  { href: "/b/creators", labelKey: "nav.creators", icon: Users },
  { href: "/b/notifications", labelKey: "nav.notifications", icon: Bell },
  { href: "/b/settings", labelKey: "nav.settings", icon: Settings },
] as const;

function SidebarNav({ pathname, t, onNavigate }: { pathname: string; t: (key: string) => string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + "/");
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
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="flex min-h-svh bg-muted/50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:border-e lg:border-border lg:bg-card">
        <div className="flex h-14 items-center border-b border-border px-6">
          <Link href="/">
            <span className="text-lg font-bold text-foreground">PopsDrops</span>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarNav pathname={pathname} t={t} />
        </div>
        <div className="flex items-center justify-between border-t border-border p-3">
          <LanguageSwitcher variant="minimal" />
          <ThemeToggle />
        </div>
      </aside>

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card px-4 lg:hidden">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
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
              <div className="flex h-14 items-center border-b border-border px-6">
                <Link href="/">
                  <span className="text-lg font-bold text-foreground">PopsDrops</span>
                </Link>
              </div>
              <div className="px-3 py-4">
                <SidebarNav pathname={pathname} t={t} onNavigate={() => setSheetOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
          <Link href="/" className="flex-1">
            <span className="text-lg font-bold text-foreground">PopsDrops</span>
          </Link>
          <ThemeToggle />
          <NotificationBell href="/b/notifications" />
        </header>

        {/* Page content */}
        <main className="min-w-0 flex-1 overflow-x-hidden">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
