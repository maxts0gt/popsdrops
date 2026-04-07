"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  Search,
  Star,
  MapPin,
  Users,
  Eye,
  Zap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlatformIcon } from "@/components/platform-icons";
import {
  PLATFORM_LABELS,
  NICHE_KEYS,
  getMarketLabel,
  formatCurrency,
} from "@/lib/constants";
import { useTranslation } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/context";
import type { Platform, Niche } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { getSingleRelation } from "@/lib/supabase/relations";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreatorRow {
  id: string;
  slug: string;
  bio: string | null;
  primary_market: string | null;
  niches: string[];
  rating: number;
  campaigns_completed: number;
  avg_response_time_hours: number | null;
  total_views: number;
  total_engagements: number;
  avg_engagement_rate: number;
  tiktok: { followers?: number } | string | null;
  instagram: { followers?: number } | string | null;
  snapchat: { followers?: number } | string | null;
  youtube: { followers?: number } | string | null;
  facebook: { followers?: number } | string | null;
  rate_card: Record<string, Record<string, number>> | null;
  profiles: {
    full_name: string;
    avatar_url: string | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getConnectedPlatforms(c: CreatorRow): Platform[] {
  const platforms: Platform[] = [];
  const keys = ["tiktok", "instagram", "snapchat", "youtube", "facebook"] as const;
  for (const k of keys) {
    if (c[k]) platforms.push(k as Platform);
  }
  return platforms;
}

function getTotalFollowers(c: CreatorRow): number {
  let total = 0;
  const keys = ["tiktok", "instagram", "snapchat", "youtube", "facebook"] as const;
  for (const k of keys) {
    const val = c[k];
    if (val && typeof val === "object" && val.followers) {
      total += val.followers;
    }
  }
  return total;
}

function formatFollowers(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function getMinRate(rateCard: Record<string, Record<string, number>> | null): number | null {
  if (!rateCard) return null;
  let min = Infinity;
  for (const formats of Object.values(rateCard)) {
    for (const rate of Object.values(formats)) {
      if (rate < min) min = rate;
    }
  }
  return min === Infinity ? null : min;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BrandCreatorsPage() {
  const { t } = useTranslation("brand.creators");
  const { locale, t: tc } = useI18n();
  const [creators, setCreators] = useState<CreatorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("creator_profiles")
        .select(
          `id, slug, bio, primary_market, niches, rating, campaigns_completed,
           avg_response_time_hours, total_views, total_engagements, avg_engagement_rate,
           tiktok, instagram, snapchat, youtube, facebook, rate_card,
           profiles!creator_profiles_profile_id_fkey ( full_name, avatar_url )`
        )
        .order("ranking_score", { ascending: false })
        .limit(50);

      if (data) {
        setCreators(
          data.map((row) => {
            const creator = row as CreatorRow & {
              profiles?: CreatorRow["profiles"] | CreatorRow["profiles"][];
            };

            return {
              ...creator,
              profiles: getSingleRelation(creator.profiles),
            };
          }) as CreatorRow[]
        );
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = search
    ? creators.filter((c) => {
        const q = search.toLowerCase();
        const name = c.profiles?.full_name?.toLowerCase() || "";
        const niches = c.niches.join(" ").toLowerCase();
        const market = c.primary_market?.toLowerCase() || "";
        return name.includes(q) || niches.includes(q) || market.includes(q);
      })
    : creators;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" />
        <Input
          placeholder={t("search.placeholder")}
          className="ps-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border/60 bg-card p-5"
            >
              <div className="flex items-center gap-3">
                <div className="size-12 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-16 animate-pulse rounded bg-muted/50" />
                </div>
              </div>
              <div className="mt-3 flex gap-1.5">
                <div className="h-5 w-16 animate-pulse rounded-full bg-muted/50" />
                <div className="h-5 w-14 animate-pulse rounded-full bg-muted/50" />
              </div>
              <div className="mt-3 flex gap-4">
                <div className="h-3 w-14 animate-pulse rounded bg-muted/50" />
                <div className="h-3 w-12 animate-pulse rounded bg-muted/50" />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <div className="h-5 w-12 animate-pulse rounded-full bg-muted/50" />
                <div className="h-5 w-14 animate-pulse rounded-full bg-muted/50" />
                <div className="h-5 w-10 animate-pulse rounded-full bg-muted/50" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-12 text-center">
          <Users className="mx-auto mb-3 size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((creator) => {
            const name = creator.profiles?.full_name || "";
            const platforms = getConnectedPlatforms(creator);
            const followers = getTotalFollowers(creator);
            const minRate = getMinRate(creator.rate_card);

            return (
              <Link
                key={creator.id}
                href={`/c/${creator.slug}`}
                className="block"
              >
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Avatar className="size-10">
                        {creator.profiles?.avatar_url && (
                          <AvatarImage src={creator.profiles.avatar_url} />
                        )}
                        <AvatarFallback>{getInitials(name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-medium text-foreground">
                          {name}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          {creator.primary_market && (
                            <>
                              <MapPin className="size-3" />
                              {getMarketLabel(creator.primary_market, locale) ||
                                creator.primary_market}
                            </>
                          )}
                          {followers > 0 && (
                            <>
                              <span className="text-muted-foreground/50">·</span>
                              {formatFollowers(followers)}
                            </>
                          )}
                        </div>
                      </div>
                      {creator.rating > 0 && (
                        <div className="flex items-center gap-1 text-sm font-medium text-amber-500">
                          <Star className="size-3.5 fill-amber-500" />{" "}
                          {creator.rating.toFixed(1)}
                        </div>
                      )}
                    </div>

                    {creator.bio && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {creator.bio}
                      </p>
                    )}

                    {/* Platforms */}
                    {platforms.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {platforms.map((p) => {
                          const Icon = PlatformIcon[p];
                          return (
                            <span
                              key={p}
                              className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                            >
                              <Icon className="size-3" />
                              {PLATFORM_LABELS[p]}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Niches */}
                    {creator.niches.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {creator.niches.slice(0, 3).map((n) => (
                          <Badge key={n} variant="secondary" className="text-xs">
                            {NICHE_KEYS[n as Niche] ? tc("ui.common", NICHE_KEYS[n as Niche]) : n}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Stats */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/50 pt-3 text-xs text-muted-foreground">
                      {minRate && (
                        <span className="font-medium tabular-nums text-foreground">
                          {formatCurrency(minRate, locale)}+
                        </span>
                      )}
                      <span>
                        {creator.campaigns_completed}{" "}
                        {t("label.campaigns")}
                      </span>
                      {creator.total_views > 0 && (
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Eye className="size-3 text-muted-foreground/70" />
                          {formatFollowers(creator.total_views)}
                        </span>
                      )}
                      {creator.avg_engagement_rate > 0 && (
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Zap className="size-3 text-muted-foreground/70" />
                          {creator.avg_engagement_rate.toFixed(1)}%
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
    </div>
  );
}
