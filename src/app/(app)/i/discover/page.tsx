"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Bookmark,
  Clock,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlatformIcon } from "@/components/platform-icons";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  PLATFORM_LABELS,
  PLATFORMS,
  NICHES,
  MARKETS,
  NICHE_KEYS,
  getMarketLabel,
  formatBudgetRange,
  type Platform,
  type Niche,
  type Market,
} from "@/lib/constants";
import { useI18n, useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { getSingleRelation } from "@/lib/supabase/relations";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CampaignCard {
  id: string;
  title: string;
  brief_description: string | null;
  platforms: Platform[];
  markets: string[];
  niches: string[];
  budget_min: number | null;
  budget_max: number | null;
  budget_currency: string;
  max_creators: number | null;
  application_deadline: string | null;
  status: string;
  brand: {
    company_name: string;
    rating: number;
    review_count: number;
    logo_url: string | null;
  };
}

type CampaignCardRecord = Omit<CampaignCard, "brand"> & {
  profiles?:
    | {
        full_name: string | null;
        brand_profiles:
          | CampaignCard["brand"]
          | CampaignCard["brand"][]
          | null;
      }
    | {
        full_name: string | null;
        brand_profiles:
          | CampaignCard["brand"]
          | CampaignCard["brand"][]
          | null;
      }[]
    | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deadlineLabel(
  dateStr: string | null,
  t: (key: string, vars?: Record<string, string>) => string
): {
  text: string;
  urgent: boolean;
} {
  if (!dateStr) return { text: "", urgent: false };
  const diff = new Date(dateStr).getTime() - Date.now();
  const days = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  if (days === 0) return { text: t("card.lastDay"), urgent: true };
  if (days <= 3)
    return { text: t("card.daysLeft", { count: String(days) }), urgent: true };
  return { text: t("card.daysLeft", { count: String(days) }), urgent: false };
}

function brandInitials(name: string | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// ---------------------------------------------------------------------------
// Filter Sheet
// ---------------------------------------------------------------------------

interface FilterState {
  platforms: Set<Platform>;
  niches: Set<string>;
  market: string;
}

function FilterSheet({
  open,
  onOpenChange,
  filters,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: FilterState;
  onApply: (f: FilterState) => void;
}) {
  const { locale, t: tGlobal } = useI18n();
  const { t } = useTranslation("creator.discover");
  const [local, setLocal] = useState<FilterState>(filters);

  function togglePlatform(p: Platform) {
    setLocal((prev) => {
      const next = new Set(prev.platforms);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return { ...prev, platforms: next };
    });
  }

  function toggleNiche(n: string) {
    setLocal((prev) => {
      const next = new Set(prev.niches);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return { ...prev, niches: next };
    });
  }

  function handleApply() {
    onApply(local);
    onOpenChange(false);
  }

  function handleReset() {
    const empty: FilterState = {
      platforms: new Set(),
      niches: new Set(),
      market: "",
    };
    setLocal(empty);
    onApply(empty);
    onOpenChange(false);
  }

  const activeCount =
    local.platforms.size + local.niches.size + (local.market ? 1 : 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{t("filter.filters")}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-4">
          {/* Platforms */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
              {t("filter.platform")}
            </p>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const Icon = PlatformIcon[p];
                const active = local.platforms.has(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 text-muted-foreground ring-1 ring-border hover:bg-muted"
                    }`}
                  >
                    <Icon className="size-3.5" />
                    {PLATFORM_LABELS[p]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Niches */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
              {t("filter.niche")}
            </p>
            <div className="flex flex-wrap gap-2">
              {NICHES.map((n) => {
                const active = local.niches.has(n);
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => toggleNiche(n)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 text-muted-foreground ring-1 ring-border hover:bg-muted"
                    }`}
                  >
                    {NICHE_KEYS[n] ? tGlobal("ui.common", NICHE_KEYS[n]) : n}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Market */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
              {t("filter.market")}
            </p>
            <select
              value={local.market}
              onChange={(e) =>
                setLocal((prev) => ({ ...prev, market: e.target.value }))
              }
              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">{t("filter.allMarkets")}</option>
              {MARKETS.map((m) => (
                <option key={m} value={m}>
                  {getMarketLabel(m, locale)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <SheetFooter>
          <div className="flex w-full gap-3">
            <Button variant="outline" onClick={handleReset} className="flex-1">
              {t("filter.reset")}
            </Button>
            <Button onClick={handleApply} className="flex-1">
              {t("filter.apply")}{activeCount > 0 ? ` (${activeCount})` : ""}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DiscoverPage() {
  const { t } = useTranslation("creator.discover");
  const { locale, t: tGlobal } = useI18n();
  const [campaigns, setCampaigns] = useState<CampaignCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    platforms: new Set(),
    niches: new Set(),
    market: "",
  });
  const [saved, setSaved] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set<string>();
    try {
      const stored = localStorage.getItem("popsdrops:saved_campaigns");
      return stored ? new Set<string>(JSON.parse(stored)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      // campaigns.brand_id → profiles.id, brand_profiles.profile_id → profiles.id
      // Use profiles as the bridge to get brand info
      const { data } = await supabase
        .from("campaigns")
        .select(
          `id, title, brief_description, platforms, markets, niches,
           budget_min, budget_max, budget_currency, max_creators,
           application_deadline, status,
           profiles!campaigns_brand_id_fkey (
             full_name,
             brand_profiles (
               company_name, rating, review_count, logo_url
             )
           )`
        )
        .eq("status", "recruiting")
        .order("application_deadline", { ascending: true });

      if (data) {
        const mapped: CampaignCard[] = (data as CampaignCardRecord[]).map((campaign) => {
          const profile = getSingleRelation(campaign.profiles);
          const bp = getSingleRelation(profile?.brand_profiles);

          return {
            ...campaign,
            brand: bp
              ? bp
              : {
                  company_name: profile?.full_name || "Unknown Brand",
                  rating: 0,
                  review_count: 0,
                  logo_url: null,
                },
          };
        });
        setCampaigns(mapped);
      }
      setLoading(false);
    }
    load();
  }, []);

  // Client-side filtering
  const filtered = campaigns.filter((c) => {
    if (search) {
      const q = search.toLowerCase();
      const match =
        c.title.toLowerCase().includes(q) ||
        c.brand?.company_name?.toLowerCase().includes(q) ||
        c.niches.some((n) => n.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (filters.platforms.size > 0) {
      if (!c.platforms.some((p) => filters.platforms.has(p as Platform)))
        return false;
    }
    if (filters.niches.size > 0) {
      if (!c.niches.some((n) => filters.niches.has(n))) return false;
    }
    if (filters.market) {
      if (!c.markets.includes(filters.market)) return false;
    }
    return true;
  });

  const activeFilterCount =
    filters.platforms.size + filters.niches.size + (filters.market ? 1 : 0);

  function toggleSave(id: string) {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(
          "popsdrops:saved_campaigns",
          JSON.stringify(Array.from(next)),
        );
      } catch {
        // localStorage full or unavailable — ignore
      }
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 lg:p-6">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        {t("title")}
      </h1>

      {/* Search + Filter bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground/70" />
          <Input
            type="search"
            placeholder={t("search.placeholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute inset-y-0 end-2 my-auto flex size-5 items-center justify-center rounded-full text-muted-foreground/50 hover:text-muted-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          className="relative shrink-0"
          onClick={() => setFilterOpen(true)}
        >
          <SlidersHorizontal className="size-4" />
          {activeFilterCount > 0 && (
            <span className="absolute -end-1 -top-1 flex size-4 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {Array.from(filters.platforms).map((p) => (
            <span
              key={p}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground"
            >
              {PLATFORM_LABELS[p]}
              <button
                onClick={() =>
                  setFilters((prev) => {
                    const next = new Set(prev.platforms);
                    next.delete(p);
                    return { ...prev, platforms: next };
                  })
                }
                className="text-muted-foreground/70 hover:text-muted-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          {Array.from(filters.niches).map((n) => (
            <span
              key={n}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground"
            >
              {NICHE_KEYS[n as Niche] ? tGlobal("ui.common", NICHE_KEYS[n as Niche]) : n}
              <button
                onClick={() =>
                  setFilters((prev) => {
                    const next = new Set(prev.niches);
                    next.delete(n);
                    return { ...prev, niches: next };
                  })
                }
                className="text-muted-foreground/70 hover:text-muted-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          {filters.market && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
              {getMarketLabel(filters.market, locale)}
              <button
                onClick={() => setFilters((prev) => ({ ...prev, market: "" }))}
                className="text-muted-foreground/70 hover:text-muted-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          )}
          <button
            onClick={() =>
              setFilters({
                platforms: new Set(),
                niches: new Set(),
                market: "",
              })
            }
            className="text-xs text-muted-foreground/70 hover:text-muted-foreground"
          >
            {t("filter.clearAll")}
          </button>
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border/60 bg-card p-4"
            >
              {/* Brand row */}
              <div className="flex items-center gap-2">
                <div className="size-8 animate-pulse rounded-lg bg-muted" />
                <div className="space-y-1.5">
                  <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                  <div className="h-2.5 w-16 animate-pulse rounded bg-muted/50" />
                </div>
              </div>
              {/* Title */}
              <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-muted" />
              {/* Description */}
              <div className="mt-2 space-y-1.5">
                <div className="h-3 w-full animate-pulse rounded bg-muted/50" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-muted/50" />
              </div>
              {/* Platform pills */}
              <div className="mt-3 flex gap-1.5">
                <div className="h-5 w-20 animate-pulse rounded-full bg-muted/50" />
                <div className="h-5 w-16 animate-pulse rounded-full bg-muted/50" />
                <div className="h-5 w-14 animate-pulse rounded-full bg-muted/50" />
              </div>
              {/* Bottom row */}
              <div className="mt-3 flex gap-4">
                <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                <div className="h-3 w-14 animate-pulse rounded bg-muted/50" />
                <div className="h-3 w-12 animate-pulse rounded bg-muted/50" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-muted/50">
              <Search className="size-5 text-muted-foreground/70" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {campaigns.length === 0
                ? t("empty.none")
                : t("empty")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              {campaigns.length === 0
                ? t("empty.noneDetail")
                : t("empty.filterDetail")}
            </p>
            {activeFilterCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() =>
                  setFilters({
                    platforms: new Set(),
                    niches: new Set(),
                    market: "",
                  })
                }
              >
                {t("filter.clearFilters")}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground/70">
            {filtered.length === 1 ? t("results.countSingle") : t("results.count", { count: String(filtered.length) })}
          </p>
          {filtered.map((campaign) => {
            const dl = deadlineLabel(campaign.application_deadline, t);
            const isSaved = saved.has(campaign.id);

            return (
              <Link
                key={campaign.id}
                href={`/i/discover/${campaign.id}`}
                className="block"
              >
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="relative">
                    {/* Save button */}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleSave(campaign.id);
                      }}
                      className="absolute end-4 top-4 rounded-lg p-1 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
                    >
                      <Bookmark
                        className={`size-4 ${isSaved ? "fill-foreground text-foreground" : ""}`}
                      />
                    </button>

                    {/* Brand */}
                    <div className="flex items-center gap-2">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">
                        {brandInitials(campaign.brand?.company_name)}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          {campaign.brand?.company_name}
                        </p>
                        {campaign.brand?.rating > 0 && (
                          <p className="text-[11px] text-muted-foreground/70">
                            ★ {campaign.brand.rating.toFixed(1)} ·{" "}
                            {campaign.brand.review_count} {t("card.reviews")}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="mt-2.5 pe-8 text-sm font-semibold text-foreground">
                      {campaign.title}
                    </h3>

                    {/* Description preview */}
                    {campaign.brief_description && (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {campaign.brief_description}
                      </p>
                    )}

                    {/* Meta row: platforms + markets */}
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {campaign.platforms.map((p) => {
                        const Icon = PlatformIcon[p as Platform];
                        return Icon ? (
                          <span
                            key={p}
                            className="inline-flex items-center gap-1 rounded-full bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border/50"
                          >
                            <Icon className="size-3" />
                            {PLATFORM_LABELS[p as Platform]}
                          </span>
                        ) : null;
                      })}
                      {campaign.markets.slice(0, 3).map((m) => (
                        <span
                          key={m}
                          className="rounded-full bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground/70 ring-1 ring-border/50"
                        >
                          {getMarketLabel(m, locale)}
                        </span>
                      ))}
                      {campaign.markets.length > 3 && (
                        <span className="text-[11px] text-muted-foreground/70">
                          +{campaign.markets.length - 3}
                        </span>
                      )}
                    </div>

                    {/* Bottom row: budget + deadline + spots */}
                    <div className="mt-3 flex items-center gap-4 text-xs">
                      <span className="font-semibold tabular-nums text-foreground">
                        {formatBudgetRange(
                          campaign.budget_min,
                          campaign.budget_max,
                          locale,
                          campaign.budget_currency || "USD"
                        )}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 ${
                          dl.urgent
                            ? "font-medium text-red-500"
                            : "text-muted-foreground/70"
                        }`}
                      >
                        <Clock className="size-3" />
                        {dl.text}
                      </span>
                      {campaign.max_creators && (
                        <span className="inline-flex items-center gap-1 text-muted-foreground/70">
                          <Users className="size-3" />
                          {t("card.spots", { count: String(campaign.max_creators) })}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Filter Sheet */}
      <FilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={filters}
        onApply={setFilters}
      />
    </div>
  );
}
