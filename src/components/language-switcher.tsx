"use client";

import { useI18n } from "@/lib/i18n";
import {
  SUPPORTED_LOCALES,
  getLocaleDisplayName,
} from "@/lib/i18n/strings";
import { Check, Globe } from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";

export function LanguageSwitcher({
  variant = "default",
}: {
  variant?: "default" | "minimal" | "dark" | "header";
}) {
  const { locale, setLocale, isLoading } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Pinned: current locale + English (always visible at top)
  // Rest: our 30 curated locales sorted alphabetically by native name
  // If current locale is outside our 30, it still appears pinned at top
  const { pinned, rest } = useMemo(() => {
    const pinnedSet = new Set<string>();

    // Current language first (even if it's not in our curated list)
    pinnedSet.add(locale);
    // English always pinned
    pinnedSet.add("en");

    const pinnedList = Array.from(pinnedSet);

    // Remaining curated locales sorted by native display name
    const restList = SUPPORTED_LOCALES
      .filter((loc) => !pinnedSet.has(loc))
      .sort((a, b) =>
        getLocaleDisplayName(a).localeCompare(
          getLocaleDisplayName(b),
          undefined,
          { sensitivity: "base" }
        )
      );

    return { pinned: pinnedList, rest: restList };
  }, [locale]);

  const isDark = variant === "dark";
  const isHeader = variant === "header";

  const buttonClass = {
    default:
      "flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all",
    minimal:
      "flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors",
    dark:
      "flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors",
    header:
      "flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors",
  };

  const dropdownClass = {
    default:
      "absolute end-0 top-full z-50 mt-2 w-52 rounded-xl border border-border bg-card p-1.5 shadow-xl",
    minimal:
      "absolute end-0 bottom-full z-50 mb-2 w-52 rounded-xl border border-border bg-card p-1.5 shadow-xl",
    dark:
      "absolute end-0 top-full z-50 mt-2 w-52 rounded-xl border border-white/10 bg-[#1a1a1a] p-1.5 shadow-2xl backdrop-blur-xl",
    header:
      "absolute end-0 top-full z-50 mt-2 w-52 rounded-xl border border-border bg-card p-1.5 shadow-xl",
  };

  function renderItem(loc: string) {
    const isActive = loc === locale;
    return (
      <button
        key={loc}
        onClick={() => {
          setLocale(loc);
          setOpen(false);
        }}
        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
          isActive
            ? isDark
              ? "bg-white/10 text-white"
              : "bg-muted font-medium text-foreground"
            : isDark
              ? "text-white/60 hover:bg-white/5 hover:text-white"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        }`}
      >
        <span>{getLocaleDisplayName(loc)}</span>
        {isActive && (
          <Check className={`h-3.5 w-3.5 ${isDark ? "text-white/40" : "text-muted-foreground/70"}`} />
        )}
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={buttonClass[variant]}
        aria-label="Change language"
      >
        <Globe className="h-4 w-4" />
        {!isHeader && (
          <span>{getLocaleDisplayName(locale)}</span>
        )}
        {isLoading && (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
      </button>

      {open && (
        <div className={dropdownClass[variant]}>
          {/* Pinned: current locale + English */}
          <div>
            {pinned.map(renderItem)}
          </div>

          {/* Divider + remaining languages */}
          {rest.length > 0 && (
            <>
              <div
                className={`my-1.5 border-t ${
                  isDark ? "border-white/10" : "border-border/50"
                }`}
              />
              <div className="max-h-60 overflow-auto">
                {rest.map(renderItem)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
