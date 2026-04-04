"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";

export function MarketingFooter() {
  const { t } = useTranslation("ui.common");

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-12 sm:py-16">
        <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
          {/* Brand */}
          <div className="max-w-xs">
            <Link href="/" className="text-lg font-extrabold tracking-tight text-slate-900">
              PopsDrops
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              {t("footer.description")}
            </p>
            <div className="mt-5">
              <LanguageSwitcher variant="minimal" />
            </div>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-10 sm:gap-16">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t("footer.section.platform")}</p>
              <ul className="mt-4 space-y-3">
                <li>
                  <Link href="/for-brands" className="text-sm text-slate-600 transition-colors hover:text-slate-900">
                    {t("nav.forBrands")}
                  </Link>
                </li>
                <li>
                  <Link href="/for-creators" className="text-sm text-slate-600 transition-colors hover:text-slate-900">
                    {t("nav.forCreators")}
                  </Link>
                </li>
                <li>
                  <Link href="/partners" className="text-sm text-slate-600 transition-colors hover:text-slate-900">
                    {t("nav.partners")}
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t("footer.section.company")}</p>
              <ul className="mt-4 space-y-3">
                <li>
                  <Link href="/about" className="text-sm text-slate-600 transition-colors hover:text-slate-900">
                    {t("footer.about")}
                  </Link>
                </li>
                <li>
                  <a href="mailto:hello@popsdrops.com" className="text-sm text-slate-600 transition-colors hover:text-slate-900">
                    {t("footer.contact")}
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t("footer.section.legal")}</p>
              <ul className="mt-4 space-y-3">
                <li>
                  <Link href="/terms" className="text-sm text-slate-600 transition-colors hover:text-slate-900">
                    {t("footer.terms")}
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="text-sm text-slate-600 transition-colors hover:text-slate-900">
                    {t("footer.privacy")}
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t("footer.section.mobile")}</p>
              <div className="mt-4 space-y-3">
                {/* App Store */}
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <svg className="h-5 w-5 shrink-0 text-slate-900" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                  <div className="min-w-0">
                    <p className="text-[10px] leading-none text-slate-500">{t("footer.mobile.appStore")}</p>
                    <p className="mt-0.5 text-xs font-semibold text-slate-700">{t("footer.mobile.creatorApp")}</p>
                  </div>
                </div>
                {/* Google Play */}
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <svg className="h-5 w-5 shrink-0 text-slate-900" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.807 1.626a1 1 0 0 1 0 1.732l-2.807 1.626L15.206 12l2.492-2.492zM5.864 3.458L16.8 9.79l-2.302 2.302-8.634-8.634z" />
                  </svg>
                  <div className="min-w-0">
                    <p className="text-[10px] leading-none text-slate-500">{t("footer.mobile.playStore")}</p>
                    <p className="mt-0.5 text-xs font-semibold text-slate-700">{t("footer.mobile.creatorApp")}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-100 pt-8 sm:flex-row">
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} PopsDrops. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
