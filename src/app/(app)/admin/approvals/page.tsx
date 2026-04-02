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

// ---------------------------------------------------------------------------
// ApplicantCard
// ---------------------------------------------------------------------------

function ApplicantCard({
  profile,
  locale,
  onAction,
}: {
  profile: PendingProfile;
  locale: string;
  onAction: () => void;
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
              <Avatar size="lg">
                <AvatarFallback>{getInitials(profile.full_name)}</AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-slate-900">{profile.full_name}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {profile.role === "creator" ? "Creator" : "Brand"}
                  </Badge>
                  {isOverdue && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertTriangle className="me-1 size-3" /> Overdue
                    </Badge>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                  {cp?.primary_market && (
                    <>
                      <MapPin className="size-3" /> {getMarketLabel(cp.primary_market as Market, locale)}
                      <span className="text-slate-300">|</span>
                    </>
                  )}
                  {profile.email}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs">
                  <Clock className={`size-3 ${isOverdue ? "text-amber-500" : "text-slate-400"}`} />
                  <span className={isOverdue ? "font-medium text-amber-600" : "text-slate-500"}>
                    Waiting {hours}h
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              {expanded ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
            </button>
          </div>

          {expanded && (
            <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
              {/* Creator details */}
              {profile.role === "creator" && cp && (
                <div className="space-y-3">
                  {cp.bio && <p className="text-sm text-slate-600">{cp.bio}</p>}
                  <div className="flex flex-wrap gap-2">
                    {platforms.map((p) => (
                      <span key={p} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                        {PLATFORM_LABELS[p]}
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
                          className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"
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
                  <div className="flex items-center gap-2 text-slate-600">
                    <Building2 className="size-3.5" /> {bp.company_name}
                  </div>
                  {bp.website && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Globe className="size-3.5" />
                      <a href={bp.website} target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-slate-900 hover:underline">
                        {bp.website}
                      </a>
                    </div>
                  )}
                  {bp.industry && <p className="text-slate-500">Industry: {bp.industry}</p>}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
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
            <p className="text-sm text-slate-500">
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

  async function loadProfiles() {
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

    if (data) {
      setProfiles(
        data.map((p: any) => ({
          ...p,
          creator_profile: p.creator_profiles?.[0] ?? p.creator_profiles ?? null,
          brand_profile: p.brand_profiles?.[0] ?? p.brand_profiles ?? null,
        }))
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    loadProfiles();
  }, []);

  const creators = profiles.filter((p) => p.role === "creator");
  const brands = profiles.filter((p) => p.role === "brand");
  const overdue = profiles.filter((p) => hoursAgo(p.created_at) > 24);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-100" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Approval Queue</h1>
        <p className="text-sm text-slate-500">
          {profiles.length} pending{overdue.length > 0 ? ` · ${overdue.length} overdue` : ""}
        </p>
      </div>

      <Tabs defaultValue="all">
        <TabsList variant="line" className="mb-6">
          <TabsTrigger value="all">All ({profiles.length})</TabsTrigger>
          <TabsTrigger value="creators">Creators ({creators.length})</TabsTrigger>
          <TabsTrigger value="brands">Brands ({brands.length})</TabsTrigger>
          {overdue.length > 0 && (
            <TabsTrigger value="overdue">Overdue ({overdue.length})</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="all">
          <ProfileList profiles={profiles} locale={locale} onAction={loadProfiles} />
        </TabsContent>
        <TabsContent value="creators">
          <ProfileList profiles={creators} locale={locale} onAction={loadProfiles} />
        </TabsContent>
        <TabsContent value="brands">
          <ProfileList profiles={brands} locale={locale} onAction={loadProfiles} />
        </TabsContent>
        <TabsContent value="overdue">
          <ProfileList profiles={overdue} locale={locale} onAction={loadProfiles} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProfileList({
  profiles,
  locale,
  onAction,
}: {
  profiles: PendingProfile[];
  locale: string;
  onAction: () => void;
}) {
  if (profiles.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 py-12 text-center">
        <ShieldCheck className="mx-auto mb-3 size-8 text-slate-300" />
        <p className="text-sm font-medium text-slate-700">All clear</p>
        <p className="text-xs text-slate-400">No pending approvals</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {profiles.map((p) => (
        <ApplicantCard key={p.id} profile={p} locale={locale} onAction={onAction} />
      ))}
    </div>
  );
}
