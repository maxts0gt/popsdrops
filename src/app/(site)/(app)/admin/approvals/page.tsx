"use client";

import { useState, useEffect } from "react";
import {
  ShieldCheck,
  ExternalLink,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  INDUSTRY_LABELS,
  PLATFORM_LABELS,
  getMarketLabel,
} from "@/lib/constants";
import { useI18n } from "@/lib/i18n/context";
import type { Industry, Platform, Market } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { getSingleRelation } from "@/lib/supabase/relations";
import {
  approveProfile,
  approveWaitlistRequest,
  rejectProfile,
  rejectWaitlistRequest,
} from "@/app/actions/admin";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PendingProfile {
  id: string;
  full_name: string;
  email: string;
  role: "creator" | "brand";
  status: string;
  avatar_url: string | null;
  created_at: string;
  // Creator fields
  creator_profile?: {
    slug: string;
    bio: string | null;
    primary_market: string | null;
    niches: string[];
    tiktok: { url?: string; handle?: string; followers?: number } | null;
    instagram: { url?: string; handle?: string; followers?: number } | null;
    snapchat: { url?: string; handle?: string } | null;
    youtube: { url?: string; handle?: string } | null;
    facebook: { url?: string; handle?: string } | null;
  } | null;
  // Brand fields
  brand_profile?: {
    company_name: string;
    industry: string | null;
    website: string | null;
    target_markets: string[];
  } | null;
  // Waitlist fields
  waitlist_reason?: string | null;
}

interface PendingAccessRequest {
  id: string;
  type: "brand" | "creator";
  email: string;
  full_name: string;
  company_name: string | null;
  industry: string | null;
  website: string | null;
  budget_range: string | null;
  social_url: string | null;
  social_platform: Platform | null;
  follower_range: string | null;
  markets: string[];
  reason: string | null;
  created_at: string;
}

type PendingProfileRecord = Omit<PendingProfile, "creator_profile" | "brand_profile"> & {
  creator_profiles?: PendingProfile["creator_profile"] | PendingProfile["creator_profile"][];
  brand_profiles?: PendingProfile["brand_profile"] | PendingProfile["brand_profile"][];
};

const ACCESS_BUDGET_LABELS: Record<string, string> = {
  under_5k: "Under $5K",
  "5k_25k": "$5K to $25K",
  "25k_100k": "$25K to $100K",
  "100k_plus": "$100K+",
};

const ACCESS_FOLLOWER_LABELS: Record<string, string> = {
  under_10k: "Under 10K",
  "10k_50k": "10K to 50K",
  "50k_100k": "50K to 100K",
  "100k_500k": "100K to 500K",
  "500k_plus": "500K+",
};

async function fetchPendingProfiles(): Promise<PendingProfile[]> {
  const supabase = createClient();

  const { data } = await supabase
    .from("profiles")
    .select(`
      id, full_name, email, role, status, avatar_url, created_at,
      creator_profiles!creator_profiles_profile_id_fkey (slug, bio, primary_market, niches, tiktok, instagram, snapchat, youtube, facebook),
      brand_profiles!brand_profiles_profile_id_fkey (company_name, industry, website, target_markets)
    `)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  // Fetch waitlist reasons keyed by email for all pending profiles
  const emails = (data ?? []).map((row) => (row as PendingProfileRecord).email);
  const { data: waitlistEntries } = emails.length > 0
    ? await supabase
        .from("waitlist")
        .select("email, reason")
        .in("email", emails)
    : { data: [] };

  const reasonByEmail = new Map<string, string | null>();
  for (const entry of waitlistEntries ?? []) {
    reasonByEmail.set(entry.email, entry.reason);
  }

  return (data ?? []).map((row) => {
    const profile = row as PendingProfileRecord;

    return {
      id: profile.id,
      full_name: profile.full_name,
      email: profile.email,
      role: profile.role,
      status: profile.status,
      avatar_url: profile.avatar_url,
      created_at: profile.created_at,
      creator_profile: getSingleRelation(profile.creator_profiles),
      brand_profile: getSingleRelation(profile.brand_profiles),
      waitlist_reason: reasonByEmail.get(profile.email) ?? null,
    };
  });
}

async function fetchPendingAccessRequests(): Promise<PendingAccessRequest[]> {
  const supabase = createClient();

  const { data } = await supabase
    .from("waitlist")
    .select(
      `
      id,
      type,
      email,
      full_name,
      company_name,
      industry,
      website,
      budget_range,
      social_url,
      social_platform,
      follower_range,
      markets,
      reason,
      created_at
    `,
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  return (data ?? []) as PendingAccessRequest[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function hoursAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60));
}

function getSocialLinks(profile: PendingProfile["creator_profile"]) {
  if (!profile) return [];
  const links: { platform: string; url: string }[] = [];
  if (profile.tiktok?.url) links.push({ platform: "TikTok", url: profile.tiktok.url });
  if (profile.instagram?.url) links.push({ platform: "Instagram", url: profile.instagram.url });
  if (profile.snapchat?.url) links.push({ platform: "Snapchat", url: profile.snapchat.url });
  if (profile.youtube?.url) links.push({ platform: "YouTube", url: profile.youtube.url });
  if (profile.facebook?.url) links.push({ platform: "Facebook", url: profile.facebook.url });
  return links;
}

function getConnectedPlatforms(profile: PendingProfile["creator_profile"]): Platform[] {
  if (!profile) return [];
  const platforms: Platform[] = [];
  if (profile.tiktok?.url) platforms.push("tiktok");
  if (profile.instagram?.url) platforms.push("instagram");
  if (profile.snapchat?.url) platforms.push("snapchat");
  if (profile.youtube?.url) platforms.push("youtube");
  if (profile.facebook?.url) platforms.push("facebook");
  return platforms;
}

function getFollowerCount(profile: PendingProfile["creator_profile"], platform: Platform): number | null {
  if (!profile) return null;
  const data = profile[platform] as { followers?: number } | null;
  return data?.followers ?? null;
}

function getRedFlags(profile: PendingProfile): string[] {
  const flags: string[] = [];
  const cp = profile.creator_profile;

  // Disposable email domains
  const disposableDomains = ["mailinator.com", "guerrillamail.com", "tempmail.com", "throwaway.email", "yopmail.com", "sharklasers.com", "guerrillamailblock.com", "grr.la", "dispostable.com", "maildrop.cc"];
  const emailDomain = profile.email.split("@")[1]?.toLowerCase();
  if (emailDomain && disposableDomains.includes(emailDomain)) {
    flags.push("Disposable email");
  }

  // No connected platforms
  if (cp && getConnectedPlatforms(cp).length === 0) {
    flags.push("No social accounts connected");
  }

  // Very low followers (all platforms under 500)
  if (cp) {
    const platforms = getConnectedPlatforms(cp);
    const allLow = platforms.length > 0 && platforms.every(p => {
      const count = getFollowerCount(cp, p);
      return count !== null && count < 500;
    });
    if (allLow) flags.push("Very low follower count");
  }

  // No bio
  if (cp && !cp.bio?.trim()) {
    flags.push("No bio");
  }

  // No niches selected
  if (cp && (!cp.niches || cp.niches.length === 0)) {
    flags.push("No niches selected");
  }

  return flags;
}

function getAccessRequestTitle(request: PendingAccessRequest) {
  if (request.type === "brand") {
    return request.company_name || request.full_name;
  }

  return request.full_name;
}

type SortDirection = "asc" | "desc";
type SortState<Key extends string> = { key: Key; direction: SortDirection };
type AccessSortKey = "request" | "type" | "market" | "waiting";
type ProfileSortKey = "applicant" | "role" | "signal" | "waiting";

function toggleSort<Key extends string>(
  current: SortState<Key>,
  key: Key,
): SortState<Key> {
  if (current.key !== key) return { key, direction: "asc" };
  return { key, direction: current.direction === "asc" ? "desc" : "asc" };
}

function getAriaSort<Key extends string>(
  sort: SortState<Key>,
  key: Key,
): "ascending" | "descending" | "none" {
  if (sort.key !== key) return "none";
  return sort.direction === "asc" ? "ascending" : "descending";
}

function compareText(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function sortMultiplier(direction: SortDirection) {
  return direction === "asc" ? 1 : -1;
}

function formatWaitingLabel(hours: number) {
  if (hours < 1) return "New";
  if (hours === 1) return "1h";
  if (hours < 48) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function formatSubmittedAt(dateStr: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  }).format(new Date(dateStr));
}

function getAccessMarketSummary(request: PendingAccessRequest, locale: string) {
  if (request.markets.length === 0) return "No market";
  return request.markets.map((m) => getMarketLabel(m as Market, locale)).join(", ");
}

function getAccessSignal(request: PendingAccessRequest) {
  if (request.type === "brand") {
    return request.budget_range
      ? ACCESS_BUDGET_LABELS[request.budget_range] ?? request.budget_range
      : request.industry
        ? INDUSTRY_LABELS[request.industry as Industry] ?? request.industry
        : "Brand request";
  }

  return request.follower_range
    ? ACCESS_FOLLOWER_LABELS[request.follower_range] ?? request.follower_range
    : request.social_platform
      ? PLATFORM_LABELS[request.social_platform]
      : "Creator request";
}

function sortAccessRequests(
  requests: PendingAccessRequest[],
  sort: SortState<AccessSortKey>,
  locale: string,
) {
  const direction = sortMultiplier(sort.direction);

  return [...requests].sort((a, b) => {
    let result = 0;
    if (sort.key === "request") {
      result = compareText(getAccessRequestTitle(a), getAccessRequestTitle(b));
    } else if (sort.key === "type") {
      result = compareText(a.type, b.type);
    } else if (sort.key === "market") {
      result = compareText(
        getAccessMarketSummary(a, locale),
        getAccessMarketSummary(b, locale),
      );
    } else {
      result = hoursAgo(a.created_at) - hoursAgo(b.created_at);
    }

    if (result === 0) {
      result = compareText(a.email, b.email);
    }

    return result * direction;
  });
}

function getProfileTitle(profile: PendingProfile) {
  if (profile.role === "brand") {
    return profile.brand_profile?.company_name || profile.full_name;
  }

  return profile.full_name;
}

function getProfileMarketSummary(profile: PendingProfile, locale: string) {
  if (profile.role === "brand") {
    const markets = profile.brand_profile?.target_markets ?? [];
    if (markets.length === 0) return "No market";
    return markets.map((m) => getMarketLabel(m as Market, locale)).join(", ");
  }

  if (!profile.creator_profile?.primary_market) return "No market";
  return getMarketLabel(profile.creator_profile.primary_market as Market, locale);
}

function getProfileSignal(profile: PendingProfile, locale: string) {
  if (profile.role === "brand") {
    return [
      profile.brand_profile?.industry
        ? INDUSTRY_LABELS[profile.brand_profile.industry as Industry] ??
          profile.brand_profile.industry
        : null,
      getProfileMarketSummary(profile, locale),
    ].filter(Boolean).join(" · ");
  }

  const platforms = getConnectedPlatforms(profile.creator_profile);
  const flags = getRedFlags(profile);

  if (flags.length > 0) return flags.join(", ");
  if (platforms.length > 0) {
    return platforms.map((p) => PLATFORM_LABELS[p]).join(", ");
  }
  return getProfileMarketSummary(profile, locale);
}

function sortProfiles(
  profiles: PendingProfile[],
  sort: SortState<ProfileSortKey>,
  locale: string,
) {
  const direction = sortMultiplier(sort.direction);

  return [...profiles].sort((a, b) => {
    let result = 0;
    if (sort.key === "applicant") {
      result = compareText(getProfileTitle(a), getProfileTitle(b));
    } else if (sort.key === "role") {
      result = compareText(a.role, b.role);
    } else if (sort.key === "signal") {
      result = compareText(getProfileSignal(a, locale), getProfileSignal(b, locale));
    } else {
      result = hoursAgo(a.created_at) - hoursAgo(b.created_at);
    }

    if (result === 0) {
      result = compareText(a.email, b.email);
    }

    return result * direction;
  });
}

function SortableHeader<Key extends string>({
  label,
  sortKey,
  sort,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: Key;
  sort: SortState<Key>;
  onSort: (key: Key) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;

  return (
    <th
      scope="col"
      aria-sort={getAriaSort(sort, sortKey)}
      className={`px-4 py-3 text-start text-xs font-semibold text-muted-foreground ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 rounded-md text-start hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"
      >
        {label}
        <span className="inline-flex w-3 justify-center text-[10px] text-muted-foreground">
          {active ? (sort.direction === "asc" ? "↑" : "↓") : ""}
        </span>
      </button>
    </th>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminApprovalsPage() {
  const { locale } = useI18n();
  const [accessRequests, setAccessRequests] = useState<PendingAccessRequest[]>([]);
  const [profiles, setProfiles] = useState<PendingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState("");

  async function loadApprovals() {
    setLoading(true);
    const [nextAccessRequests, nextProfiles] = await Promise.all([
      fetchPendingAccessRequests(),
      fetchPendingProfiles(),
    ]);
    setAccessRequests(nextAccessRequests);
    setProfiles(nextProfiles);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      fetchPendingAccessRequests(),
      fetchPendingProfiles(),
    ]).then(([nextAccessRequests, nextProfiles]) => {
      if (cancelled) return;
      setAccessRequests(nextAccessRequests);
      setProfiles(nextProfiles);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const creators = profiles.filter((p) => p.role === "creator");
  const brands = profiles.filter((p) => p.role === "brand");
  const overdue = profiles.filter((p) => hoursAgo(p.created_at) > 24);
  const overdueAccessRequests = accessRequests.filter(
    (request) => hoursAgo(request.created_at) > 24,
  );
  const totalPending = accessRequests.length + profiles.length;

  const currentProfiles =
    activeTab === "creators" ? creators :
    activeTab === "brands" ? brands :
    activeTab === "overdue" ? overdue :
    profiles;

  function handleToggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleBulkApprove() {
    setBulkLoading(true);
    let succeeded = 0;
    let failed = 0;

    for (const id of selectedIds) {
      try {
        await approveProfile(id);
        succeeded++;
      } catch {
        failed++;
      }
    }

    toast.success(`${succeeded} approved${failed > 0 ? `, ${failed} failed` : ""}`);
    setSelectedIds(new Set());
    loadApprovals();
    setBulkLoading(false);
  }

  async function handleBulkReject() {
    if (!bulkRejectReason.trim()) return;
    setBulkLoading(true);
    let succeeded = 0;
    let failed = 0;

    for (const id of selectedIds) {
      try {
        await rejectProfile(id, bulkRejectReason.trim());
        succeeded++;
      } catch {
        failed++;
      }
    }

    toast.success(`${succeeded} rejected${failed > 0 ? `, ${failed} failed` : ""}`);
    setSelectedIds(new Set());
    setBulkRejectOpen(false);
    setBulkRejectReason("");
    loadApprovals();
    setBulkLoading(false);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Access Review</h1>
        <p className="text-sm text-muted-foreground">
          {totalPending} pending
          {overdue.length + overdueAccessRequests.length > 0
            ? ` · ${overdue.length + overdueAccessRequests.length} overdue`
            : ""}
        </p>
      </div>

      <section className="mb-8">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Access requests
            </h2>
            <p className="text-xs text-muted-foreground">
              Public requests waiting for private platform access.
            </p>
          </div>
          {accessRequests.length > 0 && (
            <Badge variant="secondary">{accessRequests.length}</Badge>
          )}
        </div>
        <AccessRequestList
          requests={accessRequests}
          locale={locale}
          onAction={loadApprovals}
        />
      </section>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(String(value));
          setSelectedIds(new Set());
        }}
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              Profile approvals
            </h2>
            <TabsList variant="line">
              <TabsTrigger value="all">All ({profiles.length})</TabsTrigger>
              <TabsTrigger value="creators">Creators ({creators.length})</TabsTrigger>
              <TabsTrigger value="brands">Brands ({brands.length})</TabsTrigger>
              {overdue.length > 0 && (
                <TabsTrigger value="overdue">Overdue ({overdue.length})</TabsTrigger>
              )}
            </TabsList>
          </div>
          {currentProfiles.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={selectedIds.size === currentProfiles.length && currentProfiles.length > 0}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedIds(new Set(currentProfiles.map((p) => p.id)));
                  } else {
                    setSelectedIds(new Set());
                  }
                }}
                className="size-4 rounded border-border accent-slate-900"
              />
              Select all
            </label>
          )}
        </div>

        <TabsContent value="all">
          <ProfileList profiles={profiles} locale={locale} onAction={loadApprovals} selectedIds={selectedIds} onToggle={handleToggle} />
        </TabsContent>
        <TabsContent value="creators">
          <ProfileList profiles={creators} locale={locale} onAction={loadApprovals} selectedIds={selectedIds} onToggle={handleToggle} />
        </TabsContent>
        <TabsContent value="brands">
          <ProfileList profiles={brands} locale={locale} onAction={loadApprovals} selectedIds={selectedIds} onToggle={handleToggle} />
        </TabsContent>
        <TabsContent value="overdue">
          <ProfileList profiles={overdue} locale={locale} onAction={loadApprovals} selectedIds={selectedIds} onToggle={handleToggle} />
        </TabsContent>
      </Tabs>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="sticky bottom-4 mx-auto flex w-fit items-center gap-3 rounded-xl border border-border bg-white px-4 py-3 shadow-lg">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <Button size="sm" onClick={handleBulkApprove} disabled={bulkLoading}>
            <CheckCircle className="size-3.5" /> Approve All
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setBulkRejectOpen(true)} disabled={bulkLoading}>
            <XCircle className="size-3.5" /> Reject All
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {/* Bulk reject dialog */}
      <Dialog open={bulkRejectOpen} onOpenChange={setBulkRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {selectedIds.size} {selectedIds.size === 1 ? "applicant" : "applicants"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Provide a reason for rejection. This will be sent to all selected applicants.
            </p>
            <Textarea
              rows={3}
              placeholder="Reason for rejection..."
              value={bulkRejectReason}
              onChange={(e) => setBulkRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkReject}
              disabled={bulkLoading || !bulkRejectReason.trim()}
            >
              Reject {selectedIds.size} {selectedIds.size === 1 ? "Applicant" : "Applicants"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccessRequestList({
  requests,
  locale,
  onAction,
}: {
  requests: PendingAccessRequest[];
  locale: string;
  onAction: () => void;
}) {
  const [sort, setSort] = useState<SortState<AccessSortKey>>({
    key: "waiting",
    direction: "desc",
  });
  const [reviewRequest, setReviewRequest] =
    useState<PendingAccessRequest | null>(null);
  const [rejectRequest, setRejectRequest] =
    useState<PendingAccessRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const sortedRequests = sortAccessRequests(requests, sort, locale);

  async function handleApprove(request: PendingAccessRequest) {
    const title = getAccessRequestTitle(request);
    setActionLoadingId(request.id);
    try {
      await approveWaitlistRequest(request.id);
      toast.success(`${title} approved`);
      setReviewRequest(null);
      onAction();
    } catch {
      toast.error("Failed to approve request");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleReject() {
    if (!rejectRequest || !rejectReason.trim()) return;
    const title = getAccessRequestTitle(rejectRequest);
    setActionLoadingId(rejectRequest.id);
    try {
      await rejectWaitlistRequest(rejectRequest.id, rejectReason.trim());
      toast.success(`${title} rejected`);
      setRejectRequest(null);
      setReviewRequest(null);
      setRejectReason("");
      onAction();
    } catch {
      toast.error("Failed to reject request");
    } finally {
      setActionLoadingId(null);
    }
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-10 text-center">
        <ShieldCheck className="mx-auto mb-3 size-8 text-muted-foreground/50" />
        <p className="text-sm font-medium text-foreground">All clear</p>
        <p className="text-xs text-muted-foreground/70">
          No pending access requests
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table
            data-testid="admin-access-requests-table"
            className="min-w-[860px] table-fixed divide-y divide-border"
          >
            <thead className="bg-slate-50/70">
              <tr>
                <SortableHeader
                  label="Request"
                  sortKey="request"
                  sort={sort}
                  onSort={(key) => setSort((current) => toggleSort(current, key))}
                  className="w-[32%]"
                />
                <th
                  scope="col"
                  className="w-[22%] px-4 py-3 text-start text-xs font-semibold text-muted-foreground"
                >
                  Review
                </th>
                <SortableHeader
                  label="Type"
                  sortKey="type"
                  sort={sort}
                  onSort={(key) => setSort((current) => toggleSort(current, key))}
                  className="w-[12%]"
                />
                <SortableHeader
                  label="Market"
                  sortKey="market"
                  sort={sort}
                  onSort={(key) => setSort((current) => toggleSort(current, key))}
                  className="w-[22%]"
                />
                <SortableHeader
                  label="Waiting"
                  sortKey="waiting"
                  sort={sort}
                  onSort={(key) => setSort((current) => toggleSort(current, key))}
                  className="w-[12%]"
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-white">
              {sortedRequests.map((request) => {
                const hours = hoursAgo(request.created_at);
                const isOverdue = hours > 24;
                const title = getAccessRequestTitle(request);
                const loading = actionLoadingId === request.id;

                return (
                  <tr key={request.id} className="group align-top hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {title}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {request.full_name} · {request.email}
                        </p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {getAccessSignal(request)}
                        </p>
                      </div>
                    </td>
                    <td data-testid="admin-access-row-actions" className="px-4 py-3">
                      <div className="flex flex-nowrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setReviewRequest(request)}
                          className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                        >
                          Review
                        </button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRejectRequest(request)}
                          disabled={loading}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(request)}
                          disabled={loading}
                        >
                          Approve
                        </Button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-xs">
                        {request.type === "brand" ? "Brand" : "Creator"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      <span className="line-clamp-2">
                        {getAccessMarketSummary(request, locale)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-sm text-foreground">
                        <Clock className="size-3.5 text-muted-foreground" />
                        <span>{formatWaitingLabel(hours)}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatSubmittedAt(request.created_at, locale)}
                      </p>
                      {isOverdue && (
                        <p className="mt-1 text-xs font-medium text-amber-700">
                          Overdue
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog
        open={reviewRequest !== null}
        onOpenChange={(open) => !open && setReviewRequest(null)}
      >
        <DialogContent>
          {reviewRequest && (
            <>
              <DialogHeader>
                <DialogTitle>{getAccessRequestTitle(reviewRequest)}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Contact</p>
                    <p className="font-medium text-foreground">
                      {reviewRequest.full_name}
                    </p>
                    <p className="text-muted-foreground">{reviewRequest.email}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Signal</p>
                    <p className="font-medium text-foreground">
                      {getAccessSignal(reviewRequest)}
                    </p>
                    <p className="text-muted-foreground">
                      {getAccessMarketSummary(reviewRequest, locale)}
                    </p>
                  </div>
                </div>
                {reviewRequest.website && (
                  <a
                    href={reviewRequest.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-muted-foreground"
                  >
                    <Globe className="size-4" />
                    Open website
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
                {reviewRequest.social_url && (
                  <a
                    href={reviewRequest.social_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-muted-foreground"
                  >
                    <ExternalLink className="size-4" />
                    Open social profile
                  </a>
                )}
                {reviewRequest.reason && (
                  <div className="rounded-lg border border-border bg-slate-50 px-3 py-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Reason
                    </p>
                    <p className="mt-1 text-foreground">{reviewRequest.reason}</p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setReviewRequest(null)}>
                  Close
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setRejectRequest(reviewRequest);
                    setReviewRequest(null);
                  }}
                >
                  Reject
                </Button>
                <Button
                  onClick={() => handleApprove(reviewRequest)}
                  disabled={actionLoadingId === reviewRequest.id}
                >
                  Approve
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={rejectRequest !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRejectRequest(null);
            setRejectReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Reject {rejectRequest ? getAccessRequestTitle(rejectRequest) : "request"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Keep the reason short and specific. It stays on the request record.
            </p>
            <Textarea
              rows={3}
              placeholder="Reason for rejection"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectRequest(null);
                setRejectReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={actionLoadingId !== null || !rejectReason.trim()}
            >
              Reject request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProfileList({
  profiles,
  locale,
  onAction,
  selectedIds,
  onToggle,
}: {
  profiles: PendingProfile[];
  locale: string;
  onAction: () => void;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [sort, setSort] = useState<SortState<ProfileSortKey>>({
    key: "waiting",
    direction: "desc",
  });
  const [reviewProfile, setReviewProfile] = useState<PendingProfile | null>(null);
  const [rejectProfileTarget, setRejectProfileTarget] =
    useState<PendingProfile | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const sortedProfiles = sortProfiles(profiles, sort, locale);

  async function handleApprove(profile: PendingProfile) {
    setActionLoadingId(profile.id);
    try {
      await approveProfile(profile.id);
      toast.success(`${getProfileTitle(profile)} approved`);
      setReviewProfile(null);
      onAction();
    } catch {
      toast.error("Failed to approve");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleReject() {
    if (!rejectProfileTarget || !rejectReason.trim()) return;
    setActionLoadingId(rejectProfileTarget.id);
    try {
      await rejectProfile(rejectProfileTarget.id, rejectReason.trim());
      toast.success(`${getProfileTitle(rejectProfileTarget)} rejected`);
      setRejectProfileTarget(null);
      setReviewProfile(null);
      setRejectReason("");
      onAction();
    } catch {
      toast.error("Failed to reject");
    } finally {
      setActionLoadingId(null);
    }
  }

  if (profiles.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-12 text-center">
        <ShieldCheck className="mx-auto mb-3 size-8 text-muted-foreground/50" />
        <p className="text-sm font-medium text-foreground">All clear</p>
        <p className="text-xs text-muted-foreground/70">No pending approvals</p>
      </div>
    );
  }
  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table
            data-testid="admin-profile-approvals-table"
            className="min-w-[920px] table-fixed divide-y divide-border"
          >
            <thead className="bg-slate-50/70">
              <tr>
                <th scope="col" className="w-[48px] px-4 py-3 text-start">
                  <span className="sr-only">Select</span>
                </th>
                <SortableHeader
                  label="Applicant"
                  sortKey="applicant"
                  sort={sort}
                  onSort={(key) => setSort((current) => toggleSort(current, key))}
                  className="w-[28%]"
                />
                <th
                  scope="col"
                  className="w-[22%] px-4 py-3 text-start text-xs font-semibold text-muted-foreground"
                >
                  Review
                </th>
                <SortableHeader
                  label="Role"
                  sortKey="role"
                  sort={sort}
                  onSort={(key) => setSort((current) => toggleSort(current, key))}
                  className="w-[12%]"
                />
                <SortableHeader
                  label="Signal"
                  sortKey="signal"
                  sort={sort}
                  onSort={(key) => setSort((current) => toggleSort(current, key))}
                  className="w-[26%]"
                />
                <SortableHeader
                  label="Waiting"
                  sortKey="waiting"
                  sort={sort}
                  onSort={(key) => setSort((current) => toggleSort(current, key))}
                  className="w-[12%]"
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-white">
              {sortedProfiles.map((profile) => {
                const hours = hoursAgo(profile.created_at);
                const isOverdue = hours > 24;
                const title = getProfileTitle(profile);
                const loading = actionLoadingId === profile.id;

                return (
                  <tr key={profile.id} className="group align-top hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(profile.id)}
                        onChange={() => onToggle(profile.id)}
                        aria-label={`Select ${title}`}
                        className="size-4 rounded border-border accent-slate-900"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-slate-50 text-xs font-semibold text-muted-foreground">
                          {getInitials(profile.full_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {title}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {profile.full_name} · {profile.email}
                          </p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {getProfileMarketSummary(profile, locale)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td data-testid="admin-profile-row-actions" className="px-4 py-3">
                      <div className="flex flex-nowrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setReviewProfile(profile)}
                          className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                        >
                          Review
                        </button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRejectProfileTarget(profile)}
                          disabled={loading}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(profile)}
                          disabled={loading}
                        >
                          Approve
                        </Button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-xs">
                        {profile.role === "creator" ? "Creator" : "Brand"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <p className="line-clamp-2 text-sm text-foreground">
                        {getProfileSignal(profile, locale)}
                      </p>
                      {profile.role === "creator" &&
                        getRedFlags(profile).length > 0 && (
                          <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-red-700">
                            <AlertTriangle className="size-3" />
                            Needs review
                          </p>
                        )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-sm text-foreground">
                        <Clock className="size-3.5 text-muted-foreground" />
                        <span>{formatWaitingLabel(hours)}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatSubmittedAt(profile.created_at, locale)}
                      </p>
                      {isOverdue && (
                        <p className="mt-1 text-xs font-medium text-amber-700">
                          Overdue
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog
        open={reviewProfile !== null}
        onOpenChange={(open) => !open && setReviewProfile(null)}
      >
        <DialogContent>
          {reviewProfile && (
            <>
              <DialogHeader>
                <DialogTitle>{getProfileTitle(reviewProfile)}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Contact</p>
                    <p className="font-medium text-foreground">
                      {reviewProfile.full_name}
                    </p>
                    <p className="text-muted-foreground">{reviewProfile.email}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Signal</p>
                    <p className="font-medium text-foreground">
                      {getProfileSignal(reviewProfile, locale)}
                    </p>
                    <p className="text-muted-foreground">
                      {getProfileMarketSummary(reviewProfile, locale)}
                    </p>
                  </div>
                </div>
                {reviewProfile.creator_profile?.bio && (
                  <div className="rounded-lg border border-border bg-slate-50 px-3 py-2">
                    <p className="text-xs font-medium text-muted-foreground">Bio</p>
                    <p className="mt-1 text-foreground">
                      {reviewProfile.creator_profile.bio}
                    </p>
                  </div>
                )}
                {reviewProfile.brand_profile?.website && (
                  <a
                    href={reviewProfile.brand_profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-muted-foreground"
                  >
                    <Globe className="size-4" />
                    Open website
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
                {getSocialLinks(reviewProfile.creator_profile).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {getSocialLinks(reviewProfile.creator_profile).map((link) => (
                      <a
                        key={link.platform}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                      >
                        <ExternalLink className="size-3.5" />
                        {link.platform}
                      </a>
                    ))}
                  </div>
                )}
                {reviewProfile.waitlist_reason && (
                  <div className="rounded-lg border border-border bg-slate-50 px-3 py-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Reason for joining
                    </p>
                    <p className="mt-1 text-foreground">
                      {reviewProfile.waitlist_reason}
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setReviewProfile(null)}>
                  Close
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setRejectProfileTarget(reviewProfile);
                    setReviewProfile(null);
                  }}
                >
                  Reject
                </Button>
                <Button
                  onClick={() => handleApprove(reviewProfile)}
                  disabled={actionLoadingId === reviewProfile.id}
                >
                  Approve
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={rejectProfileTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRejectProfileTarget(null);
            setRejectReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Reject {rejectProfileTarget ? getProfileTitle(rejectProfileTarget) : "profile"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Provide a reason for rejection. This will be sent to the user.
            </p>
            <Textarea
              rows={3}
              placeholder="Reason for rejection"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectProfileTarget(null);
                setRejectReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={actionLoadingId !== null || !rejectReason.trim()}
            >
              Reject profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
