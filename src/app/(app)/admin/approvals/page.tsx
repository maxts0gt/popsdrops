"use client";

import { useState, useEffect } from "react";
import {
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Clock,
  MapPin,
  CheckCircle,
  XCircle,
  MessageSquare,
  AlertTriangle,
  Globe,
  Building2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { PLATFORM_LABELS, NICHE_LABELS, getMarketLabel } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/context";
import type { Platform, Niche, Market } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { getSingleRelation } from "@/lib/supabase/relations";
import { approveProfile, rejectProfile } from "@/app/actions/admin";
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

type PendingProfileRecord = Omit<PendingProfile, "creator_profile" | "brand_profile"> & {
  creator_profiles?: PendingProfile["creator_profile"] | PendingProfile["creator_profile"][];
  brand_profiles?: PendingProfile["brand_profile"] | PendingProfile["brand_profile"][];
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

function formatFollowers(count: number | null): string {
  if (count === null || count === undefined) return "";
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
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

// ---------------------------------------------------------------------------
// ApplicantCard
// ---------------------------------------------------------------------------

function ApplicantCard({
  profile,
  locale,
  onAction,
  selected,
  onToggle,
}: {
  profile: PendingProfile;
  locale: string;
  onAction: () => void;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const hours = hoursAgo(profile.created_at);
  const isOverdue = hours > 24;
  const cp = profile.creator_profile;
  const bp = profile.brand_profile;
  const socialLinks = getSocialLinks(cp);
  const platforms = getConnectedPlatforms(cp);
  const redFlags = profile.role === "creator" ? getRedFlags(profile) : [];

  async function handleApprove() {
    setActionLoading(true);
    try {
      await approveProfile(profile.id);
      toast.success(`${profile.full_name} approved`);
      onAction();
    } catch (err) {
      toast.error("Failed to approve");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) return;
    setActionLoading(true);
    try {
      await rejectProfile(profile.id, rejectReason.trim());
      toast.success(`${profile.full_name} rejected`);
      setRejectDialogOpen(false);
      onAction();
    } catch (err) {
      toast.error("Failed to reject");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <>
      <Card className={isOverdue ? "border-amber-200" : ""}>
        <CardContent>
          <div className="flex items-start justify-between">
            <div className="flex gap-3">
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggle(profile.id)}
                className="mt-1 size-4 rounded border-border accent-slate-900"
              />
              <Avatar size="lg">
                <AvatarFallback>{getInitials(profile.full_name)}</AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-foreground">{profile.full_name}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {profile.role === "creator" ? "Creator" : "Brand"}
                  </Badge>
                  {isOverdue && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertTriangle className="me-1 size-3" /> Overdue
                    </Badge>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  {cp?.primary_market && (
                    <>
                      <MapPin className="size-3" /> {getMarketLabel(cp.primary_market as Market, locale)}
                      <span className="text-muted-foreground/50">|</span>
                    </>
                  )}
                  {profile.email}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs">
                  <Clock className={`size-3 ${isOverdue ? "text-amber-500" : "text-muted-foreground/70"}`} />
                  <span className={isOverdue ? "font-medium text-amber-600" : "text-muted-foreground"}>
                    Waiting {hours}h
                  </span>
                </div>
                {redFlags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {redFlags.map((flag) => (
                      <span key={flag} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                        <AlertTriangle className="size-3" /> {flag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="rounded-lg p-1 text-muted-foreground/70 hover:bg-muted hover:text-muted-foreground"
            >
              {expanded ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
            </button>
          </div>

          {expanded && (
            <div className="mt-4 space-y-4 border-t border-border/50 pt-4">
              {/* Creator details */}
              {profile.role === "creator" && cp && (
                <div className="space-y-3">
                  {cp.bio && <p className="text-sm text-muted-foreground">{cp.bio}</p>}
                  <div className="flex flex-wrap gap-2">
                    {platforms.map((p) => (
                      <span key={p} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {PLATFORM_LABELS[p]} {formatFollowers(getFollowerCount(cp, p))}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {cp.niches?.map((n) => (
                      <Badge key={n} variant="secondary" className="text-xs">
                        {NICHE_LABELS[n as Niche] ?? n}
                      </Badge>
                    ))}
                  </div>
                  {socialLinks.length > 0 && (
                    <div className="flex gap-3">
                      {socialLinks.map((link) => (
                        <a
                          key={link.platform}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="size-3" /> {link.platform}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Brand details */}
              {profile.role === "brand" && bp && (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building2 className="size-3.5" /> {bp.company_name}
                  </div>
                  {bp.website && (
                    <a
                      href={bp.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted/80"
                    >
                      <Globe className="size-3.5" />
                      {bp.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                  {bp.industry && <p className="text-muted-foreground">Industry: {bp.industry}</p>}
                  {bp.target_markets && bp.target_markets.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted-foreground/70">
                        {bp.target_markets.length} target {bp.target_markets.length === 1 ? "market" : "markets"}:
                      </span>
                      {bp.target_markets.map((m) => (
                        <Badge key={m} variant="secondary" className="text-xs">
                          {getMarketLabel(m as Market, locale)}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {profile.waitlist_reason && (
                    <div className="rounded-md bg-muted/50 px-3 py-2">
                      <p className="mb-0.5 text-xs font-medium text-muted-foreground/70">Reason for joining</p>
                      <p className="text-sm text-foreground">{profile.waitlist_reason}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 border-t border-border/50 pt-3">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setRejectDialogOpen(true)}
                  disabled={actionLoading}
                >
                  <XCircle className="size-3.5" /> Reject
                </Button>
                <Button
                  size="sm"
                  onClick={handleApprove}
                  disabled={actionLoading}
                >
                  <CheckCircle className="size-3.5" /> Approve
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {profile.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Provide a reason for rejection. This will be sent to the user.
            </p>
            <Textarea
              rows={3}
              placeholder="Reason for rejection..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={actionLoading || !rejectReason.trim()}
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminApprovalsPage() {
  const { locale } = useI18n();
  const [profiles, setProfiles] = useState<PendingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState("");

  async function loadProfiles() {
    setLoading(true);
    setProfiles(await fetchPendingProfiles());
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;

    void fetchPendingProfiles().then((nextProfiles) => {
      if (cancelled) return;
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
    loadProfiles();
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
    loadProfiles();
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
        <h1 className="text-2xl font-bold text-foreground">Approval Queue</h1>
        <p className="text-sm text-muted-foreground">
          {profiles.length} pending{overdue.length > 0 ? ` · ${overdue.length} overdue` : ""}
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(String(value));
          setSelectedIds(new Set());
        }}
      >
        <div className="mb-6 flex items-center justify-between">
          <TabsList variant="line">
            <TabsTrigger value="all">All ({profiles.length})</TabsTrigger>
            <TabsTrigger value="creators">Creators ({creators.length})</TabsTrigger>
            <TabsTrigger value="brands">Brands ({brands.length})</TabsTrigger>
            {overdue.length > 0 && (
              <TabsTrigger value="overdue">Overdue ({overdue.length})</TabsTrigger>
            )}
          </TabsList>
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
          <ProfileList profiles={profiles} locale={locale} onAction={loadProfiles} selectedIds={selectedIds} onToggle={handleToggle} />
        </TabsContent>
        <TabsContent value="creators">
          <ProfileList profiles={creators} locale={locale} onAction={loadProfiles} selectedIds={selectedIds} onToggle={handleToggle} />
        </TabsContent>
        <TabsContent value="brands">
          <ProfileList profiles={brands} locale={locale} onAction={loadProfiles} selectedIds={selectedIds} onToggle={handleToggle} />
        </TabsContent>
        <TabsContent value="overdue">
          <ProfileList profiles={overdue} locale={locale} onAction={loadProfiles} selectedIds={selectedIds} onToggle={handleToggle} />
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
    <div className="space-y-4">
      {profiles.map((p) => (
        <ApplicantCard key={p.id} profile={p} locale={locale} onAction={onAction} selected={selectedIds.has(p.id)} onToggle={onToggle} />
      ))}
    </div>
  );
}
