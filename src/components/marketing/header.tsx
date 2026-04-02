"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useTranslation } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/for-brands", labelKey: "nav.forBrands" },
  { href: "/for-creators", labelKey: "nav.forCreators" },
  { href: "/partners", labelKey: "nav.partners" },
] as const;

export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { t } = useTranslation("ui.common");
  const pathname = usePathname();

  // Only the landing page has a dark hero
  const hasDarkHero = pathname === "/";
  // On dark hero pages, header starts transparent. On light pages, always solid.
  const isLight = !hasDarkHero || scrolled;

  useEffect(() => {
    if (!hasDarkHero) {
      setScrolled(true);
      return;
    }
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [hasDarkHero]);

  function navLinkClass(href: string) {
    const isActive = pathname === href;
    if (isLight) {
      return `text-sm font-medium transition-colors ${
        isActive ? "text-slate-900" : "text-slate-500 hover:text-slate-900"
      }`;
    }
    return `text-sm font-medium transition-colors ${
      isActive ? "text-white" : "text-white/60 hover:text-white"
    }`;
  }

  return (
    <header
      className={`fixed top-0 start-0 end-0 z-50 w-full transition-all duration-300 ${
        isLight
          ? "bg-white/90 backdrop-blur-xl border-b border-slate-200/50 shadow-sm"
          : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center px-6 py-4">
        <Link
          href="/"
          className={`text-lg font-extrabold tracking-tight transition-colors ${
            isLight ? "text-slate-900" : "text-white"
          }`}
        >
          PopsDrops
        </Link>

        {/* Desktop — right-aligned */}
        <div className="hidden items-center gap-8 ms-auto md:flex">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className={navLinkClass(link.href)}>
              {t(link.labelKey)}
            </Link>
          ))}
          <LanguageSwitcher variant={isLight ? "header" : "dark"} />
          <Link
            href="/login"
            className={`text-sm font-medium transition-colors ${
              isLight
                ? "text-slate-500 hover:text-slate-900"
                : "text-white/60 hover:text-white"
            }`}
          >
            {t("nav.login")}
          </Link>
          <Link
            href="/request-invite"
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              isLight
                ? "bg-slate-900 text-white hover:bg-slate-800"
                : "bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20 backdrop-blur-sm"
            }`}
          >
            {t("nav.requestInvite")}
          </Link>
        </div>

        {/* Mobile */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            className={`ms-auto rounded-lg p-2 md:hidden transition-colors ${
              isLight ? "text-slate-500 hover:text-slate-900" : "text-white/60 hover:text-white"
            }`}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </SheetTrigger>
          <SheetContent side="right" className="w-72 border-l border-slate-200 bg-white p-6">
            <div className="flex flex-col gap-1 pt-8">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-slate-50 text-slate-900"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {t(link.labelKey)}
                  </Link>
                );
              })}
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {t("nav.login")}
              </Link>
              <div className="mt-4 border-t border-slate-200 pt-4">
                <div className="px-3 py-2.5">
                  <LanguageSwitcher variant="minimal" />
                </div>
                <Link
                  href="/request-invite"
                  onClick={() => setOpen(false)}
                  className="mt-2 block rounded-lg bg-slate-900 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-slate-800"
                >
                  {t("nav.requestInvite")}
                </Link>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  );
}
