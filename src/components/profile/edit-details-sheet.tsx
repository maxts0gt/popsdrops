"use client";

import { useState, useTransition } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MARKETS,
  MARKET_LABELS,
  LANGUAGES,
  LANGUAGE_LABELS,
  type Market,
  type Language,
} from "@/lib/constants";
import { updateCreatorProfile } from "@/app/actions/profile";

// ---------------------------------------------------------------------------
// Edit Primary Market
// ---------------------------------------------------------------------------

interface EditMarketSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentMarket: string | null;
  onSaved: (market: string) => void;
}

export function EditMarketSheet({
  open,
  onOpenChange,
  currentMarket,
  onSaved,
}: EditMarketSheetProps) {
  const [selected, setSelected] = useState(currentMarket || "");
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  const filtered = MARKETS.filter((m) =>
    MARKET_LABELS[m].toLowerCase().includes(search.toLowerCase())
  );

  function handleSave() {
    if (!selected) return;
    startTransition(async () => {
      await updateCreatorProfile({ primary_market: selected });
      onSaved(selected);
      onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Primary Market</SheetTitle>
          <SheetDescription>
            Where you&apos;re primarily based. Helps brands find you.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-hidden px-4">
          <Input
            placeholder="Search markets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-3"
            autoFocus
          />
          <div className="max-h-64 overflow-y-auto">
            <div className="space-y-0.5">
              {filtered.map((market) => (
                <button
                  key={market}
                  type="button"
                  onClick={() => setSelected(market)}
                  className={`flex w-full items-center rounded-lg px-3 py-2.5 text-start text-sm transition-colors ${
                    selected === market
                      ? "bg-foreground font-medium text-white"
                      : "text-foreground hover:bg-muted/50"
                  }`}
                >
                  {MARKET_LABELS[market]}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground/70">
                  No markets match &ldquo;{search}&rdquo;
                </p>
              )}
            </div>
          </div>
        </div>

        <SheetFooter>
          <Button
            onClick={handleSave}
            disabled={isPending || !selected}
            className="w-full"
          >
            {isPending ? "Saving..." : "Save"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Edit Languages
// ---------------------------------------------------------------------------

interface EditLanguagesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentLanguages: string[];
  onSaved: (languages: string[]) => void;
}

export function EditLanguagesSheet({
  open,
  onOpenChange,
  currentLanguages,
  onSaved,
}: EditLanguagesSheetProps) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(currentLanguages)
  );
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  const filtered = LANGUAGES.filter((l) =>
    LANGUAGE_LABELS[l].toLowerCase().includes(search.toLowerCase())
  );

  function toggle(lang: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(lang)) {
        next.delete(lang);
      } else {
        next.add(lang);
      }
      return next;
    });
  }

  function handleSave() {
    const languages = Array.from(selected);
    startTransition(async () => {
      await updateCreatorProfile({ languages });
      onSaved(languages);
      onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Languages</SheetTitle>
          <SheetDescription>
            Languages you create content in.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-hidden px-4">
          <Input
            placeholder="Search languages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-3"
            autoFocus
          />
          <div className="max-h-64 overflow-y-auto">
            <div className="space-y-0.5">
              {filtered.map((lang) => {
                const isSelected = selected.has(lang);
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => toggle(lang)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-start text-sm transition-colors ${
                      isSelected
                        ? "bg-foreground font-medium text-white"
                        : "text-foreground hover:bg-muted/50"
                    }`}
                  >
                    {LANGUAGE_LABELS[lang]}
                    {isSelected && (
                      <span className="text-xs opacity-70">✓</span>
                    )}
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground/70">
                  No languages match &ldquo;{search}&rdquo;
                </p>
              )}
            </div>
          </div>
        </div>

        <SheetFooter>
          <Button
            onClick={handleSave}
            disabled={isPending || selected.size === 0}
            className="w-full"
          >
            {isPending
              ? "Saving..."
              : `Save (${selected.size} selected)`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Edit Slug
// ---------------------------------------------------------------------------

interface EditSlugSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSlug: string;
  onSaved: (slug: string) => void;
}

export function EditSlugSheet({
  open,
  onOpenChange,
  currentSlug,
  onSaved,
}: EditSlugSheetProps) {
  const [slug, setSlug] = useState(currentSlug);
  const [isPending, startTransition] = useTransition();

  // Sanitize: lowercase, alphanumeric + hyphens only
  function sanitize(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-/, "");
  }

  function handleSave() {
    const clean = sanitize(slug);
    if (!clean || clean.length < 3) return;
    startTransition(async () => {
      await updateCreatorProfile({ slug: clean });
      onSaved(clean);
      onOpenChange(false);
    });
  }

  const clean = sanitize(slug);
  const isValid = clean.length >= 3 && clean.length <= 30;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Profile URL</SheetTitle>
          <SheetDescription>
            Your unique media kit link. 3–30 characters, lowercase.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4">
          <Label htmlFor="slug" className="mb-1.5 text-xs text-muted-foreground">
            Slug
          </Label>
          <div className="flex items-center gap-0 rounded-lg ring-1 ring-border focus-within:ring-2 focus-within:ring-ring">
            <span className="shrink-0 ps-3 text-sm text-muted-foreground/70">
              popsdrops.com/c/
            </span>
            <input
              id="slug"
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="min-w-0 flex-1 bg-transparent py-2 pe-3 text-sm font-medium text-foreground outline-none"
              maxLength={30}
              autoFocus
            />
          </div>
          {slug && !isValid && (
            <p className="mt-1 text-xs text-red-500">
              Must be 3–30 characters
            </p>
          )}
        </div>

        <SheetFooter>
          <Button
            onClick={handleSave}
            disabled={isPending || !isValid}
            className="w-full"
          >
            {isPending ? "Saving..." : "Save"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
