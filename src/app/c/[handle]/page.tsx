import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ExternalLink,
  Eye,
  MapPin,
  Globe,
  Star,
  TrendingUp,
  Users,
  Heart,
  Award,
  BadgeCheck,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PLATFORM_LABELS, NICHE_LABELS } from "@/lib/constants";
import { PlatformBadge, PlatformIcon } from "@/components/platform-icons";
import type { Platform, Niche } from "@/lib/constants";
import type { SocialAccount, RateCard, CreatorTier } from "@/types/database";

// =============================================================================
// Public Creator Media Kit — the single-player-mode product.
// This is the page creators share in their social bios.
// SEO-optimized, server-rendered, no auth required.
// Queries Supabase by slug — zero hardcoded data.
// =============================================================================

// ---------------------------------------------------------------------------
// DB query
// ---------------------------------------------------------------------------

const PLATFORM_KEYS = ["tiktok", "instagram", "snapchat", "youtube", "facebook"] as const;

async function getCreatorBySlug(slug: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("creator_profiles")
    .select(`
      *,
      profile:profiles!creator_profiles_profile_id_fkey (
        full_name,
        avatar_url
      )
    `)
    .eq("slug", slug)
    .single();

  if (error || !data) return null;
  return data;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFollowers(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface PlatformStat {
  platform: Platform;
  handle: string;
  followers: number;
  verified: boolean;
  url: string;
}

function extractPlatformStats(data: Record<string, unknown>): PlatformStat[] {
  const stats: PlatformStat[] = [];
  for (const key of PLATFORM_KEYS) {
    const account = data[key] as SocialAccount | null;
    if (account && account.handle) {
      stats.push({
        platform: key,
        handle: account.handle,
        followers: account.followers || 0,
        verified: account.verified || false,
        url: account.url || "",
      });
    }
  }
  return stats.sort((a, b) => b.followers - a.followers);
}

function getTotalFollowers(platforms: PlatformStat[]): number {
  return platforms.reduce((sum, p) => sum + p.followers, 0);
}

interface RateEntry {
  format: string;
  platform: Platform;
  rate: number;
}

function extractRateCard(rateCard: RateCard | null): RateEntry[] {
  if (!rateCard) return [];
  const entries: RateEntry[] = [];
  for (const [platform, formats] of Object.entries(rateCard)) {
    for (const [format, rate] of Object.entries(formats as Record<string, number>)) {
      entries.push({
        platform: platform as Platform,
        format: formatContentType(format),
        rate,
      });
    }
  }
  return entries.sort((a, b) => b.rate - a.rate);
}

function formatContentType(key: string): string {
  const labels: Record<string, string> = {
    short_video: "Short Video",
    long_video: "Long-form Video",
    reel: "Reel",
    story: "Story",
    post: "Post",
    carousel: "Carousel",
  };
  return labels[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatRate(rate: number, currency: string, locale = "en"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(rate);
}

const tierLabels: Record<CreatorTier, string> = {
  new: "Creator",
  rising: "Rising Creator",
  established: "Established Creator",
  top: "Top Creator",
};

const tierStyles: Record<CreatorTier, string> = {
  new: "bg-slate-50 text-slate-600 ring-1 ring-slate-200",
  rising: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/60",
  established: "bg-slate-900 text-white",
  top: "bg-slate-900 text-white ring-2 ring-amber-400/40",
};

function platformUrl(platform: Platform, handle: string): string {
  const bases: Record<Platform, string> = {
    tiktok: "https://tiktok.com/",
    instagram: "https://instagram.com/",
    youtube: "https://youtube.com/",
    snapchat: "https://snapchat.com/add/",
    facebook: "https://facebook.com/",
  };
  return bases[platform] + handle.replace("@", "");
}

const MARKET_OVERRIDES: Record<string, string> = {
  us: "United States",
  uk: "United Kingdom",
  uae: "UAE",
  united_states: "United States",
  united_kingdom: "United Kingdom",
  south_korea: "South Korea",
  saudi_arabia: "Saudi Arabia",
  new_zealand: "New Zealand",
  ksa: "Saudi Arabia",
};

function formatMarket(market: string): string {
  if (MARKET_OVERRIDES[market]) return MARKET_OVERRIDES[market];
  return market
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const creator = await getCreatorBySlug(handle);

  if (!creator) {
    return { title: "Creator Not Found | PopsDrops" };
  }

  const name = (creator.profile as { full_name: string })?.full_name || handle;
  const platforms = extractPlatformStats(creator);
  const totalFollowers = formatFollowers(getTotalFollowers(platforms));
  const nicheNames = (creator.niches || [])
    .map((n: string) => NICHE_LABELS[n as Niche] || n)
    .join(", ");
  const description = `${name} — ${nicheNames} creator with ${totalFollowers} followers. View media kit, rates, and stats.`;

  return {
    title: `${name} — Media Kit`,
    description,
    openGraph: {
      title: `${name} — Creator Media Kit`,
      description,
      type: "profile",
      url: `https://popsdrops.com/c/${creator.slug}`,
    },
    twitter: {
      card: "summary",
      title: `${name} — Media Kit`,
      description,
    },
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function CreatorMediaKitPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const creator = await getCreatorBySlug(handle);

  if (!creator) {
    notFound();
  }

  const profile = creator.profile as { full_name: string; avatar_url: string | null } | null;
  const name = profile?.full_name || handle;
  const avatarUrl = profile?.avatar_url || null;
  const initials = getInitials(name);
  const platforms = extractPlatformStats(creator);
  const totalFollowers = getTotalFollowers(platforms);
  const rateEntries = extractRateCard(creator.rate_card);
  const niches = (creator.niches || []) as Niche[];
  const languages = (creator.languages || []) as string[];
  const tier = (creator.tier || "new") as CreatorTier;

  return (
    <div className="min-h-svh bg-white">
      {/* ---- Hero strip ---- */}
      <div className="h-32 bg-slate-950">
        <div className="mx-auto h-full max-w-xl px-4 sm:px-6" />
      </div>

      <div className="mx-auto max-w-xl px-4 sm:px-6">
        {/* ---- Avatar (overlapping hero) ---- */}
        <div className="-mt-16 mb-4 flex justify-center">
          <div className="flex size-32 items-center justify-center rounded-full bg-slate-900 text-3xl font-semibold tracking-tight text-white ring-4 ring-white shadow-xl">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={name}
                className="size-full rounded-full object-cover"
              />
            ) : (
              initials
            )}
          </div>
        </div>

        {/* ---- Identity ---- */}
        <header className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {name}
          </h1>

          <div className="mt-2.5 flex items-center justify-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${tierStyles[tier]}`}
            >
              {(tier === "top" || tier === "established") && (
                <Award className="size-3" />
              )}
              {tierLabels[tier]}
            </span>
          </div>

          {/* Location + languages */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-slate-500">
            {creator.primary_market && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                {formatMarket(creator.primary_market)}
              </span>
            )}
            {languages.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Globe className="size-3.5" />
                {languages.join(" · ")}
              </span>
            )}
          </div>

          {/* Bio */}
          {creator.bio && (
            <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-slate-500">
              {creator.bio}
            </p>
          )}

          {/* Niches */}
          {niches.length > 0 && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {niches.map((n) => (
                <span
                  key={n}
                  className="rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-900/[0.06]"
                >
                  {NICHE_LABELS[n] || n}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* ---- Stats ---- */}
        <div className="mt-8 grid grid-cols-3 gap-3">
          <StatCard
            icon={<Users className="size-4" />}
            value={formatFollowers(totalFollowers)}
            label="Followers"
          />
          <StatCard
            icon={<Star className="size-4 text-amber-500" />}
            value={creator.rating?.toFixed(1) || "—"}
            label={`${creator.review_count || 0} reviews`}
          />
          <StatCard
            icon={<Heart className="size-4" />}
            value={String(creator.campaigns_completed || 0)}
            label="Campaigns"
          />
        </div>

        {/* ---- Campaign Performance ---- */}
        {(creator.total_views > 0 || creator.total_engagements > 0) && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            <StatCard
              icon={<Eye className="size-4" />}
              value={formatFollowers(creator.total_views || 0)}
              label="Total Views"
            />
            <StatCard
              icon={<Zap className="size-4" />}
              value={
                creator.avg_engagement_rate > 0
                  ? `${Number(creator.avg_engagement_rate).toFixed(1)}%`
                  : "—"
              }
              label="Avg ER"
            />
            <StatCard
              icon={<TrendingUp className="size-4" />}
              value={formatFollowers(creator.total_engagements || 0)}
              label="Engagements"
            />
          </div>
        )}

        {/* ---- Platforms ---- */}
        {platforms.length > 0 && (
          <section className="mt-10">
            <SectionTitle>Platforms</SectionTitle>
            <div className="space-y-2">
              {platforms.map((p) => {
                const Icon = PlatformIcon[p.platform];
                return (
                  <div
                    key={p.platform}
                    className="group flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-slate-900/[0.04] transition-shadow hover:shadow-md"
                  >
                    <PlatformBadge platform={p.platform} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">
                          {PLATFORM_LABELS[p.platform]}
                        </span>
                        {p.verified && (
                          <BadgeCheck className="size-4 text-blue-500" />
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-400">
                        <span className="font-medium text-slate-600">
                          {formatFollowers(p.followers)} followers
                        </span>
                        <span className="truncate">{p.handle}</span>
                      </div>
                    </div>

                    <a
                      href={p.url || platformUrl(p.platform, p.handle)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl p-2.5 text-slate-300 transition-colors group-hover:bg-slate-50 group-hover:text-slate-500"
                    >
                      <ExternalLink className="size-4" />
                    </a>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ---- Rate Card ---- */}
        {rateEntries.length > 0 && (
          <section className="mt-10">
            <SectionTitle>Rate Card</SectionTitle>
            <div className="overflow-hidden rounded-2xl ring-1 ring-slate-900/[0.04]">
              {rateEntries.map((r, i) => {
                const Icon = PlatformIcon[r.platform];
                return (
                  <div
                    key={`${r.platform}-${r.format}`}
                    className={`flex items-center justify-between px-4 py-3.5 ${
                      i > 0 ? "border-t border-slate-100" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-7 items-center justify-center rounded-lg bg-slate-50 text-slate-600">
                        <Icon className="size-3.5" />
                      </div>
                      <div>
                        <span className="text-sm text-slate-700">{r.format}</span>
                        <span className="ms-1.5 text-xs text-slate-400">
                          {PLATFORM_LABELS[r.platform]}
                        </span>
                      </div>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-slate-900">
                      {formatRate(r.rate, creator.rate_currency || "USD")}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ---- Track Record ---- */}
        {(creator.campaigns_completed || 0) > 0 && (
          <section className="mt-10">
            <div className="flex items-center justify-between rounded-2xl p-5 ring-1 ring-slate-900/[0.04]">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {creator.campaigns_completed} campaigns completed
                </p>
                <p className="mt-0.5 text-xs text-slate-400">on PopsDrops</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Star className="size-4 text-amber-500" />
                <span className="text-base font-semibold tabular-nums text-slate-900">
                  {creator.rating?.toFixed(1)}
                </span>
                <span className="text-xs text-slate-400">
                  ({creator.review_count})
                </span>
              </div>
            </div>
          </section>
        )}

        {/* ---- CTA ---- */}
        <section className="mt-10">
          <a
            href={`/request-invite?type=brand&creator=${creator.slug}`}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 active:translate-y-px"
          >
            Work with {name} on PopsDrops
          </a>
        </section>

        {/* ---- Footer ---- */}
        <footer className="mt-12 border-t border-slate-100 py-6 text-center">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-xs text-slate-400 transition-colors hover:text-slate-600"
          >
            <span className="text-sm font-bold tracking-tight text-slate-900">
              PopsDrops
            </span>
            <span className="text-slate-300">|</span>
            <span>Creator Campaigns Without Borders</span>
          </a>
        </footer>
      </div>

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ProfilePage",
            mainEntity: {
              "@type": "Person",
              name,
              description: creator.bio || "",
              url: `https://popsdrops.com/c/${creator.slug}`,
              knowsAbout: niches.map((n) => NICHE_LABELS[n] || n),
            },
          }),
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">
      {children}
    </h2>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-2xl p-4 ring-1 ring-slate-900/[0.04]">
      <div className="text-slate-400">{icon}</div>
      <span className="text-xl font-semibold tabular-nums text-slate-900">{value}</span>
      <span className="text-[11px] text-slate-400">{label}</span>
    </div>
  );
}
