"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  BadgeCheck,
  Camera,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  ExternalLink,
  Globe,
  Link2,
  LogOut,
  Mail,
  MapPin,
  Pencil,
  ShieldCheck,
  Star,
  Unlink,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PlatformBadge, PlatformIcon } from "@/components/platform-icons";
import {
  EditBioSheet,
  EditNichesSheet,
  EditRateCardSheet,
  ConnectPlatformSheet,
  EditMarketSheet,
  EditLanguagesSheet,
  EditSlugSheet,
} from "@/components/profile";
import {
  PLATFORM_LABELS,
  OAUTH_PLATFORMS,
  LANGUAGE_LABELS,
  NICHE_KEYS,
  FORMAT_KEYS,
  getMarketLabel,
} from "@/lib/constants";
import { useI18n, useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/app/actions/auth";
import { updateAvatar } from "@/app/actions/profile";
import { getSocialConnections, disconnectSocialAccount } from "@/app/actions/metrics";
import type { Platform, Niche, Language, ContentFormat } from "@/lib/constants";
import type { SocialAccount, RateCard, CreatorTier, PlatformType } from "@/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProfileData {
  full_name: string;
  avatar_url: string | null;
  email: string;
}

interface SocialConnection {
  id: string;
  platform: string;
  platform_username: string | null;
  platform_display_name: string | null;
  platform_avatar_url: string | null;
  status: string;
  followers_count: number | null;
  followers_updated_at: string | null;
  token_expires_at: string | null;
  error_message: string | null;
}

interface CreatorData {
  slug: string;
  bio: string | null;
  primary_market: string | null;
  tiktok: SocialAccount | null;
  instagram: SocialAccount | null;
  snapchat: SocialAccount | null;
  youtube: SocialAccount | null;
  facebook: SocialAccount | null;
  platforms: string[];
  niches: string[];
  markets: string[];
  languages: string[];
  rate_card: RateCard | null;
  rate_currency: string;
  rating: number;
  review_count: number;
  campaigns_completed: number;
  tier: CreatorTier;
  profile_completeness: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PLATFORM_KEYS: Platform[] = [
  "tiktok",
  "instagram",
  "snapchat",
  "youtube",
  "facebook",
];

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

function formatRate(rate: number, currency: string, locale = "en"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(rate);
}

const tierLabelKeys: Record<CreatorTier, string> = {
  new: "tier.new",
  rising: "tier.rising",
  established: "tier.established",
  top: "tier.top",
};

const tierStyles: Record<CreatorTier, string> = {
  new: "bg-muted text-foreground",
  rising: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  established: "bg-primary text-primary-foreground",
  top: "bg-primary text-primary-foreground",
};

function getCompleteness(profile: ProfileData, creator: CreatorData, labels: Record<string, string>) {
  const checks = [
    { label: labels.photo || "Profile photo", done: !!profile.avatar_url },
    { label: labels.bio || "Bio", done: !!creator.bio },
    {
      label: labels.socials || "At least 2 social accounts",
      done: PLATFORM_KEYS.filter((k) => creator[k]).length >= 2,
    },
    { label: labels.niches || "Niches selected", done: creator.niches.length > 0 },
    {
      label: labels.rateCard || "Rate card",
      done: !!creator.rate_card && Object.keys(creator.rate_card).length > 0,
    },
    { label: labels.market || "Primary market", done: !!creator.primary_market },
    { label: labels.languages || "Languages", done: creator.languages.length > 0 },
  ];
  const pct = Math.round(
    (checks.filter((c) => c.done).length / checks.length) * 100
  );
  return { checks, pct };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProfilePage() {
  const { t } = useTranslation("creator.profile");
  const { locale, t: tGlobal } = useI18n();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [creator, setCreator] = useState<CreatorData | null>(null);
  const [socialConnections, setSocialConnections] = useState<SocialConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Sheet states
  const [bioOpen, setBioOpen] = useState(false);
  const [nichesOpen, setNichesOpen] = useState(false);
  const [rateCardOpen, setRateCardOpen] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  const [languagesOpen, setLanguagesOpen] = useState(false);
  const [slugOpen, setSlugOpen] = useState(false);
  const [connectPlatform, setConnectPlatform] = useState<Platform | null>(null);

  // Handle OAuth callback success/error params
  useEffect(() => {
    const connected = searchParams.get("connected");
    const socialError = searchParams.get("social_error");

    if (connected) {
      const label = PLATFORM_LABELS[connected as Platform] || connected;
      toast.success(t("social.connectedToast", { platform: label }), {
        description: t("social.connectedDetail"),
      });
      // Clean URL params
      const url = new URL(window.location.href);
      url.searchParams.delete("connected");
      router.replace(url.pathname, { scroll: false });
    }

    if (socialError) {
      const messages: Record<string, string> = {
        unsupported_platform: t("social.error.unsupported"),
        missing_params: t("social.error.missingParams"),
        invalid_state: t("social.error.invalidState"),
        storage_failed: t("social.error.storageFailed"),
      };
      toast.error(t("social.connectionFailed"), {
        description: messages[socialError] || socialError,
      });
      const url = new URL(window.location.href);
      url.searchParams.delete("social_error");
      router.replace(url.pathname, { scroll: false });
    }
  }, [searchParams, router, t]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const [profileRes, creatorRes, connections] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, avatar_url, email")
          .eq("id", user.id)
          .single(),
        supabase
          .from("creator_profiles")
          .select("*")
          .eq("profile_id", user.id)
          .single(),
        getSocialConnections(),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      if (creatorRes.data) setCreator(creatorRes.data as unknown as CreatorData);
      setSocialConnections((connections || []) as unknown as SocialConnection[]);
      setLoading(false);
    }
    load();
  }, []);

  /** Get the OAuth connection for a platform (if any) */
  const getConnection = (platform: Platform): SocialConnection | null =>
    socialConnections.find((c) => c.platform === platform) || null;

  /** Whether a platform supports OAuth connect */
  const isOAuthSupported = (platform: Platform): boolean =>
    (OAUTH_PLATFORMS as readonly string[]).includes(platform);

  /** Disconnect OAuth and clear creator profile data */
  const handleOAuthDisconnect = async (platform: Platform) => {
    setDisconnecting(platform);
    try {
      await disconnectSocialAccount(platform as PlatformType);
      setSocialConnections((prev) => prev.filter((c) => c.platform !== platform));
      setCreator((prev) => (prev ? { ...prev, [platform]: null } : prev));
      toast.success(t("social.disconnected", { platform: PLATFORM_LABELS[platform] }));
    } catch (err) {
      toast.error(t("social.error.disconnectFailed"), {
        description: err instanceof Error ? err.message : t("social.error.tryAgain"),
      });
    } finally {
      setDisconnecting(null);
    }
  };

  const copyLink = () => {
    if (!creator) return;
    navigator.clipboard.writeText(`https://popsdrops.com/c/${creator.slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSignOut = () => {
    startTransition(() => {
      signOut();
    });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error(t("avatar.invalidType"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("avatar.tooLarge"));
      return;
    }

    setUploadingAvatar(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);

      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      await updateAvatar(avatarUrl);

      setProfile((prev) => (prev ? { ...prev, avatar_url: avatarUrl } : prev));
      toast.success(t("avatar.updated"));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("avatar.uploadFailed"),
      );
    } finally {
      setUploadingAvatar(false);
      // Reset file input so same file can be re-selected
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  // Loading skeleton
  if (loading || !profile || !creator) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-4 lg:p-6">
        <div className="h-6 w-20 animate-pulse rounded bg-muted" />
        {/* Avatar + name card */}
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <div className="flex items-center gap-4">
            <div className="size-16 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-32 animate-pulse rounded bg-muted" />
              <div className="h-3 w-48 animate-pulse rounded bg-muted/50" />
            </div>
          </div>
          {/* Completeness bar */}
          <div className="mt-4 space-y-2">
            <div className="flex justify-between">
              <div className="h-3 w-24 animate-pulse rounded bg-muted/50" />
              <div className="h-3 w-8 animate-pulse rounded bg-muted/50" />
            </div>
            <div className="h-1.5 w-full animate-pulse rounded-full bg-muted/50" />
          </div>
        </div>
        {/* Social accounts */}
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <div className="mb-3 h-4 w-28 animate-pulse rounded bg-muted" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="size-8 animate-pulse rounded-lg bg-muted/50" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-28 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-20 animate-pulse rounded bg-muted/50" />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Rate card */}
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <div className="mb-3 h-4 w-20 animate-pulse rounded bg-muted" />
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="flex justify-between">
                <div className="h-3 w-24 animate-pulse rounded bg-muted/50" />
                <div className="h-3 w-12 animate-pulse rounded bg-muted/50" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const { checks, pct } = getCompleteness(profile, creator, {
    photo: t("check.photo"),
    bio: t("check.bio"),
    socials: t("check.socials"),
    niches: t("check.niches"),
    rateCard: t("check.rateCard"),
    market: t("check.market"),
    languages: t("check.languages"),
  });
  const connectedPlatforms = PLATFORM_KEYS.filter((k) => creator[k]);
  const totalFollowers = connectedPlatforms.reduce(
    (sum, k) => sum + ((creator[k] as SocialAccount)?.followers || 0),
    0
  );

  const rateEntries = creator.rate_card
    ? Object.entries(creator.rate_card).flatMap(([platform, formats]) =>
        Object.entries(formats as Record<string, number>).map(
          ([format, rate]) => ({
            platform: platform as Platform,
            format,
            rate,
          })
        )
      )
    : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 lg:p-6">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        {t("title")}
      </h1>

      {/* ---- Identity Card ---- */}
      <Card className="overflow-hidden">
        <div className="h-20 bg-foreground" />
        <CardContent className="-mt-10">
          <div className="flex items-end gap-4">
            {/* Avatar */}
            <div className="relative">
              <div className="relative flex size-20 items-center justify-center overflow-hidden rounded-full bg-slate-900 text-xl font-semibold text-white ring-4 ring-card shadow-lg">
                {profile.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt={profile.full_name}
                    fill
                    unoptimized
                    sizes="80px"
                    className="object-cover"
                  />
                ) : (
                  getInitials(profile.full_name)
                )}
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-1 -end-1 flex size-7 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/80"
              >
                <Camera className="size-3.5" />
              </button>
            </div>

            {/* Name + tier */}
            <div className="flex-1 pb-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">
                  {profile.full_name}
                </h2>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${tierStyles[creator.tier]}`}
                >
                  {t(tierLabelKeys[creator.tier])}
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <button
                  onClick={() => setMarketOpen(true)}
                  className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                >
                  <MapPin className="size-3" />
                  {creator.primary_market
                    ? getMarketLabel(creator.primary_market, locale)
                    : t("action.setMarket")}
                </button>
                <button
                  onClick={() => setLanguagesOpen(true)}
                  className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                >
                  <Globe className="size-3" />
                  {creator.languages.length > 0
                    ? creator.languages
                        .map(
                          (l) =>
                            LANGUAGE_LABELS[l as Language] || l
                        )
                        .join(" · ")
                    : t("action.setLanguages")}
                </button>
              </div>
            </div>
          </div>

          {/* Bio */}
          <button
            onClick={() => setBioOpen(true)}
            className="mt-4 block w-full text-start"
          >
            {creator.bio ? (
              <p className="text-sm leading-relaxed text-muted-foreground transition-colors hover:text-foreground">
                {creator.bio}
              </p>
            ) : (
              <p className="text-sm italic text-muted-foreground/50 transition-colors hover:text-muted-foreground">
                {t("empty.bio")}
              </p>
            )}
          </button>

          {/* Quick stats */}
          <div className="mt-4 flex items-center gap-5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" />
              <span className="font-medium text-foreground">
                {formatFollowers(totalFollowers)}
              </span>{" "}
              {t("label.followers")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Star className="size-3.5 text-amber-500" />
              <span className="font-medium text-foreground">
                {creator.rating.toFixed(1)}
              </span>{" "}
              ({t("label.reviews", { count: String(creator.review_count) })})
            </span>
            <span>
              <span className="font-medium text-foreground">
                {creator.campaigns_completed}
              </span>{" "}
              {t("label.campaigns")}
            </span>
          </div>

          {/* Media kit link */}
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2.5 ring-1 ring-border/50">
            <Globe className="size-4 text-muted-foreground/70" />
            <button
              onClick={() => setSlugOpen(true)}
              className="flex-1 truncate text-start text-sm font-medium text-foreground transition-colors hover:text-foreground"
            >
              popsdrops.com/c/{creator.slug}
            </button>
            <button
              onClick={copyLink}
              className="rounded-lg p-1.5 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-muted-foreground"
              title={t("action.copyLink")}
            >
              {copied ? (
                <Check className="size-4 text-emerald-500" />
              ) : (
                <Copy className="size-4" />
              )}
            </button>
            <Link
              href={`/c/${creator.slug}`}
              target="_blank"
              className="rounded-lg p-1.5 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-muted-foreground"
              title={t("action.viewMediaKit")}
            >
              <ExternalLink className="size-4" />
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* ---- Social Accounts ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("section.socials")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {PLATFORM_KEYS.map((platform) => {
            const account = creator[platform] as SocialAccount | null;
            const connection = getConnection(platform);
            const oauthSupported = isOAuthSupported(platform);
            const isConnectedViaOAuth = !!connection && connection.status === "active";
            const isExpired = connection?.status === "expired";
            const hasError = connection?.status === "error";

            return (
              <div
                key={platform}
                className="rounded-xl ring-1 ring-border/50 transition-colors"
              >
                {/* Main row */}
                <div className="flex items-center gap-3 p-3">
                  <PlatformBadge platform={platform} size="sm" />

                  {/* Connected state */}
                  {account ? (
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-foreground">
                          {PLATFORM_LABELS[platform]}
                        </span>
                        {isConnectedViaOAuth && (
                          <ShieldCheck className="size-3.5 text-emerald-500" />
                        )}
                        {account.verified && !isConnectedViaOAuth && (
                          <BadgeCheck className="size-3.5 text-blue-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
                        <span className="font-medium text-muted-foreground">
                          {formatFollowers(account.followers)}
                        </span>
                        <span className="truncate">{account.handle}</span>
                        {isConnectedViaOAuth && (
                          <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
                            {t("social.verified")}
                          </span>
                        )}
                        {isExpired && (
                          <span className="rounded-full bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
                            {t("social.expired")}
                          </span>
                        )}
                        {hasError && (
                          <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
                            {t("social.error")}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1">
                      <span className="text-sm text-muted-foreground/70">
                        {PLATFORM_LABELS[platform]}
                      </span>
                      <p className="text-xs text-muted-foreground/50">{t("social.notConnected")}</p>
                    </div>
                  )}

                  {/* Action buttons */}
                  {account ? (
                    <div className="flex items-center gap-1">
                      {/* Edit manual data */}
                      <button
                        onClick={() => setConnectPlatform(platform)}
                        className="rounded-lg p-1.5 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-muted-foreground"
                        title={t("social.edit")}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      {/* Disconnect OAuth */}
                      {isConnectedViaOAuth && (
                        <button
                          onClick={() => handleOAuthDisconnect(platform)}
                          disabled={disconnecting === platform}
                          className="rounded-lg p-1.5 text-muted-foreground/70 transition-colors hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-500"
                          title={t("social.disconnect")}
                        >
                          <Unlink className="size-3.5" />
                        </button>
                      )}
                    </div>
                  ) : oauthSupported ? (
                    <a
                      href={`/auth/social/connect/${platform}`}
                      className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary/80"
                    >
                      {t("social.connect")}
                    </a>
                  ) : (
                    <button
                      onClick={() => setConnectPlatform(platform)}
                      className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
                    >
                      {t("social.addManually")}
                    </button>
                  )}
                </div>

                {/* Re-authenticate banner for expired/error connections */}
                {account && oauthSupported && (isExpired || hasError) && (
                  <div className="border-t border-border/50 px-3 py-2">
                    <a
                      href={`/auth/social/connect/${platform}`}
                      className="flex items-center gap-2 text-xs font-medium text-amber-600 transition-colors hover:text-amber-700"
                    >
                      <Link2 className="size-3" />
                      {t("social.reauthenticate")}
                    </a>
                  </div>
                )}

                {/* OAuth upsell for manually-connected accounts */}
                {account && oauthSupported && !connection && (
                  <div className="border-t border-border/50 px-3 py-2">
                    <a
                      href={`/auth/social/connect/${platform}`}
                      className="flex items-center gap-2 text-xs text-muted-foreground/70 transition-colors hover:text-muted-foreground"
                    >
                      <ShieldCheck className="size-3" />
                      {t("social.verifyWith", { platform: PLATFORM_LABELS[platform] })}
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ---- Niches ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-sm">
            {t("section.niches")}
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setNichesOpen(true)}
            >
              <Pencil className="me-1 size-3" />
              {t("action.edit")}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {creator.niches.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {(creator.niches as Niche[]).map((n) => (
                <span
                  key={n}
                  className="rounded-full bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border"
                >
                  {NICHE_KEYS[n] ? tGlobal("ui.common", NICHE_KEYS[n]) : n}
                </span>
              ))}
            </div>
          ) : (
            <button
              onClick={() => setNichesOpen(true)}
              className="text-sm text-muted-foreground/70 transition-colors hover:text-muted-foreground"
            >
              {t("empty.niches")}
            </button>
          )}
        </CardContent>
      </Card>

      {/* ---- Rate Card ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-sm">
            {t("section.rateCard")}
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setRateCardOpen(true)}
            >
              <Pencil className="me-1 size-3" />
              {t("action.edit")}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rateEntries.length > 0 ? (
            <div className="space-y-1">
              {rateEntries
                .sort((a, b) => b.rate - a.rate)
                .map((r) => {
                  const Icon = PlatformIcon[r.platform];
                  return (
                    <div
                      key={`${r.platform}-${r.format}`}
                      className="flex items-center justify-between rounded-lg px-1 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex size-6 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
                          <Icon className="size-3.5" />
                        </div>
                        <span className="text-sm text-foreground">
                          {FORMAT_KEYS[r.format as ContentFormat] ? tGlobal("ui.common", FORMAT_KEYS[r.format as ContentFormat]) : r.format}
                        </span>
                        <span className="text-xs text-muted-foreground/70">
                          {PLATFORM_LABELS[r.platform]}
                        </span>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {formatRate(r.rate, creator.rate_currency, locale)}
                      </span>
                    </div>
                  );
                })}
            </div>
          ) : (
            <button
              onClick={() => setRateCardOpen(true)}
              className="text-sm text-muted-foreground/70 transition-colors hover:text-muted-foreground"
            >
              {t("empty.rateCard")}
            </button>
          )}
        </CardContent>
      </Card>

      {/* ---- Profile Completeness ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            {t("section.completeness")}
            <span className="ms-2 font-normal text-muted-foreground/70">{pct}%</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="space-y-2.5">
            {checks.map((c) => (
              <div
                key={c.label}
                className="flex items-center gap-2.5 text-sm"
              >
                {c.done ? (
                  <CheckCircle2 className="size-4 text-emerald-500" />
                ) : (
                  <Circle className="size-4 text-muted-foreground/30" />
                )}
                <span
                  className={
                    c.done ? "text-muted-foreground/70 line-through" : "text-foreground"
                  }
                >
                  {c.label}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ---- Account ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("section.account")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Mail className="size-4 text-muted-foreground/70" />
            <div>
              <p className="text-sm text-foreground">{profile.email}</p>
              <p className="text-xs text-muted-foreground/70">{t("section.signedInWith")}</p>
            </div>
          </div>
          <Separator />
          <Button
            variant="ghost"
            className="w-full text-red-600 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-700"
            onClick={handleSignOut}
            disabled={isPending}
          >
            <LogOut className="me-2 size-4" />
            {isPending ? t("action.signingOut") : t("action.signOut")}
          </Button>
        </CardContent>
      </Card>

      {/* ---- Edit Sheets ---- */}
      <EditBioSheet
        open={bioOpen}
        onOpenChange={setBioOpen}
        currentBio={creator.bio || ""}
        onSaved={(bio) =>
          setCreator((prev) => (prev ? { ...prev, bio } : prev))
        }
      />

      <EditNichesSheet
        open={nichesOpen}
        onOpenChange={setNichesOpen}
        currentNiches={creator.niches}
        onSaved={(niches) =>
          setCreator((prev) => (prev ? { ...prev, niches } : prev))
        }
      />

      <EditRateCardSheet
        open={rateCardOpen}
        onOpenChange={setRateCardOpen}
        currentRateCard={
          creator.rate_card as Record<string, Record<string, number>> | null
        }
        connectedPlatforms={connectedPlatforms}
        currency={creator.rate_currency || "USD"}
        onSaved={(rate_card) =>
          setCreator((prev) =>
            prev ? { ...prev, rate_card: rate_card as RateCard } : prev
          )
        }
      />

      <EditMarketSheet
        open={marketOpen}
        onOpenChange={setMarketOpen}
        currentMarket={creator.primary_market}
        onSaved={(primary_market) =>
          setCreator((prev) =>
            prev ? { ...prev, primary_market } : prev
          )
        }
      />

      <EditLanguagesSheet
        open={languagesOpen}
        onOpenChange={setLanguagesOpen}
        currentLanguages={creator.languages}
        onSaved={(languages) =>
          setCreator((prev) => (prev ? { ...prev, languages } : prev))
        }
      />

      <EditSlugSheet
        open={slugOpen}
        onOpenChange={setSlugOpen}
        currentSlug={creator.slug}
        onSaved={(slug) =>
          setCreator((prev) => (prev ? { ...prev, slug } : prev))
        }
      />

      {connectPlatform && (
        <ConnectPlatformSheet
          open={!!connectPlatform}
          onOpenChange={(open) => {
            if (!open) setConnectPlatform(null);
          }}
          platform={connectPlatform}
          currentAccount={
            (creator[connectPlatform] as SocialAccount | null) || null
          }
          onSaved={(platform, account) =>
            setCreator((prev) =>
              prev ? { ...prev, [platform]: account } : prev
            )
          }
        />
      )}
    </div>
  );
}
