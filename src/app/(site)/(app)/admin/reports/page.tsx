"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Clock,
  Download,
  ExternalLink,
  Flag,
  Inbox,
  Mail,
  RefreshCw,
  ShieldBan,
  Star,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { getSingleRelation } from "@/lib/supabase/relations";
import { suspendUser, extendContentDeadline } from "@/app/actions/admin";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FlaggedSubmission {
  id: string;
  revision_count: number;
  status: string;
  campaign_title: string;
  campaign_id: string;
  creator_name: string;
  creator_id: string;
  creator_email: string;
  updated_at: string;
}

interface OverdueCampaign {
  id: string;
  title: string;
  content_due_date: string;
  pending_submissions: number;
  brand_name: string;
  brand_email: string;
}

interface LowReview {
  id: string;
  rating: number;
  comment: string | null;
  reviewer_name: string;
  reviewee_name: string;
  reviewee_id: string;
  reviewee_email: string;
  campaign_title: string;
  campaign_id: string;
  created_at: string;
}

interface ProfileRelationRecord {
  id?: string | null;
  full_name: string | null;
  email?: string | null;
}

interface CampaignRelationRecord {
  id: string;
  title: string | null;
}

interface CampaignMemberRelationRecord {
  campaign:
    | CampaignRelationRecord
    | CampaignRelationRecord[]
    | null;
  creator:
    | ProfileRelationRecord
    | ProfileRelationRecord[]
    | null;
}

interface FlaggedSubmissionRow {
  id: string;
  revision_count: number;
  status: string;
  updated_at: string;
  campaign_member:
    | CampaignMemberRelationRecord
    | CampaignMemberRelationRecord[]
    | null;
}

interface OverdueCampaignRow {
  id: string;
  title: string;
  content_due_date: string;
  brand:
    | ProfileRelationRecord
    | ProfileRelationRecord[]
    | null;
}

interface CampaignMemberIdRow {
  id: string;
}

interface LowReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer:
    | ProfileRelationRecord
    | ProfileRelationRecord[]
    | null;
  reviewee:
    | ProfileRelationRecord
    | ProfileRelationRecord[]
    | null;
  campaign:
    | CampaignRelationRecord
    | CampaignRelationRecord[]
    | null;
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ message, detail }: { message: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border py-12 text-center">
      <Inbox className="mx-auto mb-3 size-8 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">{message}</p>
      {detail && (
        <p className="mt-1 text-xs text-muted-foreground/70">{detail}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CSV Export
// ---------------------------------------------------------------------------

function exportCSV(
  flagged: FlaggedSubmission[],
  overdue: OverdueCampaign[],
  lowReviews: LowReview[]
) {
  const headers = ["Category", "Title", "Detail", "Person", "Email", "Date"];
  const rows: string[][] = [];

  for (const item of flagged) {
    rows.push([
      "Flagged Content",
      `${item.revision_count} revisions`,
      item.campaign_title,
      item.creator_name,
      item.creator_email,
      new Date(item.updated_at).toISOString(),
    ]);
  }

  for (const item of overdue) {
    rows.push([
      "Overdue Campaign",
      item.title,
      `${item.pending_submissions} pending submissions`,
      item.brand_name,
      item.brand_email,
      item.content_due_date,
    ]);
  }

  for (const item of lowReviews) {
    rows.push([
      "Low Review",
      `${item.rating}/5 - ${item.campaign_title}`,
      item.comment ?? "",
      `${item.reviewer_name} rated ${item.reviewee_name}`,
      item.reviewee_email,
      new Date(item.created_at).toISOString(),
    ]);
  }

  const csv = [headers, ...rows]
    .map((r) =>
      r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `reports-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminReportsPage() {
  const [flagged, setFlagged] = useState<FlaggedSubmission[]>([]);
  const [overdue, setOverdue] = useState<OverdueCampaign[]>([]);
  const [lowReviews, setLowReviews] = useState<LowReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Suspend dialog state
  const [suspendTarget, setSuspendTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendSubmitting, setSuspendSubmitting] = useState(false);

  // Extend deadline dialog state
  const [deadlineTarget, setDeadlineTarget] = useState<{
    id: string;
    title: string;
    currentDeadline: string;
  } | null>(null);
  const [newDeadline, setNewDeadline] = useState("");
  const [deadlineSubmitting, setDeadlineSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    // 1. Flagged content: revision_requested submissions with revision_count >= 2
    const { data: flaggedData } = await supabase
      .from("content_submissions")
      .select(
        `id, revision_count, status, updated_at,
         campaign_member:campaign_members!inner(
           campaign:campaigns!inner(id, title),
           creator:profiles!campaign_members_creator_id_fkey(id, full_name, email)
         )`
      )
      .eq("status", "revision_requested")
      .gte("revision_count", 2)
      .order("updated_at", { ascending: false })
      .limit(50);

    const flaggedRows: FlaggedSubmission[] = (flaggedData ?? []).map((row) => {
      const submission = row as FlaggedSubmissionRow;
      const member = getSingleRelation(submission.campaign_member);
      const campaign = getSingleRelation(member?.campaign);
      const creator = getSingleRelation(member?.creator);

      return {
        id: submission.id,
        revision_count: submission.revision_count,
        status: submission.status,
        campaign_title: campaign?.title ?? "Unknown",
        campaign_id: campaign?.id ?? "",
        creator_name: creator?.full_name ?? "Unknown",
        creator_id: creator?.id ?? "",
        creator_email: creator?.email ?? "",
        updated_at: submission.updated_at,
      };
    });
    setFlagged(flaggedRows);

    // 2. Overdue campaigns: content_due_date < now, with pending/submitted content
    const now = new Date().toISOString();
    const { data: overdueCampaigns } = await supabase
      .from("campaigns")
      .select(
        `id, title, content_due_date,
         brand:profiles!campaigns_brand_id_fkey(full_name, email)`
      )
      .lt("content_due_date", now)
      .not("status", "in", '("completed","cancelled")')
      .order("content_due_date", { ascending: true })
      .limit(50);

    const overdueRows: OverdueCampaign[] = [];
    for (const camp of (overdueCampaigns ?? []) as OverdueCampaignRow[]) {
      const brand = getSingleRelation(camp.brand);
      const { data: memberRows } = await supabase
        .from("campaign_members")
        .select("id")
        .eq("campaign_id", camp.id);

      const { count } = await supabase
        .from("content_submissions")
        .select("id", { count: "exact", head: true })
        .in("status", ["draft", "submitted", "revision_requested"])
        .in(
          "campaign_member_id",
          ((memberRows ?? []) as CampaignMemberIdRow[]).map(
            (member) => member.id,
          ),
        );

      if ((count ?? 0) > 0) {
        overdueRows.push({
          id: camp.id,
          title: camp.title,
          content_due_date: camp.content_due_date,
          pending_submissions: count ?? 0,
          brand_name: brand?.full_name ?? "Unknown",
          brand_email: brand?.email ?? "",
        });
      }
    }
    setOverdue(overdueRows);

    // 3. Low-rated reviews (rating <= 2)
    const { data: lowReviewData } = await supabase
      .from("reviews")
      .select(
        `id, rating, comment, created_at,
         reviewer:profiles!reviews_reviewer_id_fkey(full_name),
         reviewee:profiles!reviews_reviewee_id_fkey(id, full_name, email),
         campaign:campaigns!inner(id, title)`
      )
      .lte("rating", 2)
      .order("created_at", { ascending: false })
      .limit(50);

    const lowRows: LowReview[] = (lowReviewData ?? []).map((row) => {
      const review = row as LowReviewRow;
      const reviewer = getSingleRelation(review.reviewer);
      const reviewee = getSingleRelation(review.reviewee);
      const campaign = getSingleRelation(review.campaign);

      return {
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        reviewer_name: reviewer?.full_name ?? "Unknown",
        reviewee_name: reviewee?.full_name ?? "Unknown",
        reviewee_id: reviewee?.id ?? "",
        reviewee_email: reviewee?.email ?? "",
        campaign_title: campaign?.title ?? "Unknown",
        campaign_id: campaign?.id ?? "",
        created_at: review.created_at,
      };
    });
    setLowReviews(lowRows);

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleRefresh() {
    setRefreshKey((k) => k + 1);
  }

  async function handleSuspend() {
    if (!suspendTarget || !suspendReason.trim()) return;
    setSuspendSubmitting(true);
    try {
      await suspendUser(suspendTarget.id, suspendReason.trim());
      toast.success(`${suspendTarget.name} suspended`);
      setSuspendTarget(null);
      setSuspendReason("");
      handleRefresh();
    } catch {
      toast.error("Failed to suspend user");
    } finally {
      setSuspendSubmitting(false);
    }
  }

  async function handleExtendDeadline() {
    if (!deadlineTarget || !newDeadline) return;
    setDeadlineSubmitting(true);
    try {
      await extendContentDeadline(deadlineTarget.id, newDeadline);
      toast.success(`Deadline extended for "${deadlineTarget.title}"`);
      setDeadlineTarget(null);
      setNewDeadline("");
      handleRefresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to extend deadline",
      );
    } finally {
      setDeadlineSubmitting(false);
    }
  }

  const totalActive = flagged.length + overdue.length + lowReviews.length;
  const hasData =
    flagged.length > 0 || overdue.length > 0 || lowReviews.length > 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Reports & Disputes
          </h1>
          <div className="text-sm text-muted-foreground">
            {loading ? (
              <Skeleton className="inline-block h-4 w-32" />
            ) : (
              `${totalActive} item${totalActive !== 1 ? "s" : ""} requiring attention`
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCSV(flagged, overdue, lowReviews)}
            disabled={loading || !hasData}
          >
            <Download className="me-1.5 size-4" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw
              className={`me-1.5 size-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="flagged">
        <TabsList variant="line" className="mb-6">
          <TabsTrigger value="flagged">
            Flagged Content ({loading ? "..." : flagged.length})
          </TabsTrigger>
          <TabsTrigger value="overdue">
            Overdue ({loading ? "..." : overdue.length})
          </TabsTrigger>
          <TabsTrigger value="low_reviews">
            Low Reviews ({loading ? "..." : lowReviews.length})
          </TabsTrigger>
        </TabsList>

        {/* Flagged Content */}
        <TabsContent value="flagged">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          ) : flagged.length === 0 ? (
            <EmptyState
              message="No flagged content"
              detail="Submissions with 2+ revisions requested will appear here"
            />
          ) : (
            <div className="space-y-4">
              {flagged.map((item) => (
                <Card key={item.id}>
                  <CardContent>
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                        <Flag className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-foreground">
                            {item.revision_count} revisions requested
                          </h3>
                          <Badge variant="secondary" className="text-xs">
                            {item.revision_count} revisions
                          </Badge>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{item.creator_name}</span>
                          <span className="text-muted-foreground/50">|</span>
                          <span>{item.campaign_title}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground/70">
                          Last updated{" "}
                          {new Date(item.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {item.creator_email && (
                          <a
                            className={buttonVariants({
                              variant: "ghost",
                              size: "sm",
                            })}
                            href={`mailto:${item.creator_email}?subject=${encodeURIComponent(`Content Submission Reminder - ${item.campaign_title}`)}&body=${encodeURIComponent(`Hi ${item.creator_name},\n\nThis is a reminder regarding your content submission for "${item.campaign_title}". Your submission has had ${item.revision_count} revision requests.\n\nPlease review the feedback and submit your revised content at your earliest convenience.\n\nBest regards,\nPopsDrops Team`)}`}
                          >
                            <Mail className="me-1.5 size-4" />
                            Contact Creator
                          </a>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() =>
                            setSuspendTarget({
                              id: item.creator_id,
                              name: item.creator_name,
                            })
                          }
                        >
                          <ShieldBan className="me-1.5 size-4" />
                          Suspend
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Overdue Campaigns */}
        <TabsContent value="overdue">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          ) : overdue.length === 0 ? (
            <EmptyState
              message="No overdue content"
              detail="Campaigns past their content due date with pending submissions will appear here"
            />
          ) : (
            <div className="space-y-4">
              {overdue.map((item) => (
                <Card key={item.id}>
                  <CardContent>
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
                        <Clock className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-foreground">
                          {item.title}
                        </h3>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>
                            Due{" "}
                            {new Date(
                              item.content_due_date
                            ).toLocaleDateString()}
                          </span>
                          <span className="text-muted-foreground/50">|</span>
                          <span className="text-red-600">
                            {item.pending_submissions} pending submission
                            {item.pending_submissions !== 1 ? "s" : ""}
                          </span>
                          <span className="text-muted-foreground/50">|</span>
                          <span>{item.brand_name}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setDeadlineTarget({
                              id: item.id,
                              title: item.title,
                              currentDeadline: item.content_due_date,
                            })
                          }
                        >
                          <Clock className="me-1.5 size-4" />
                          Extend Deadline
                        </Button>
                        {item.brand_email && (
                          <a
                            className={buttonVariants({
                              variant: "ghost",
                              size: "sm",
                            })}
                            href={`mailto:${item.brand_email}?subject=${encodeURIComponent(`Campaign Update - ${item.title}`)}&body=${encodeURIComponent(`Hi ${item.brand_name},\n\nWe wanted to follow up regarding your campaign "${item.title}". The content due date of ${new Date(item.content_due_date).toLocaleDateString()} has passed and there are still ${item.pending_submissions} pending submission(s).\n\nPlease let us know how you would like to proceed.\n\nBest regards,\nPopsDrops Team`)}`}
                          >
                            <Mail className="me-1.5 size-4" />
                            Contact Brand
                          </a>
                        )}
                        <LinkButton
                          href="/admin/campaigns"
                          variant="ghost"
                          size="sm"
                        >
                          <ExternalLink className="me-1.5 size-4" />
                          View Campaign
                        </LinkButton>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Low Reviews */}
        <TabsContent value="low_reviews">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          ) : lowReviews.length === 0 ? (
            <EmptyState
              message="No low-rated reviews"
              detail="Reviews with a rating of 2 or below will appear here"
            />
          ) : (
            <div className="space-y-4">
              {lowReviews.map((item) => (
                <Card key={item.id}>
                  <CardContent>
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
                        <Star className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-foreground">
                            {item.rating}/5 rating
                          </h3>
                          <Badge variant="secondary" className="text-xs">
                            {item.campaign_title}
                          </Badge>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{item.reviewer_name}</span>
                          <span className="text-muted-foreground/50">
                            rated
                          </span>
                          <span>{item.reviewee_name}</span>
                        </div>
                        {item.comment && (
                          <p className="mt-1.5 text-sm text-muted-foreground">
                            &ldquo;{item.comment}&rdquo;
                          </p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground/70">
                          {new Date(item.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <LinkButton
                          href="/admin/campaigns"
                          variant="ghost"
                          size="sm"
                        >
                          <ExternalLink className="me-1.5 size-4" />
                          View Campaign
                        </LinkButton>
                        <LinkButton
                          href="/admin/users"
                          variant="ghost"
                          size="sm"
                        >
                          <ExternalLink className="me-1.5 size-4" />
                          View User
                        </LinkButton>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() =>
                            setSuspendTarget({
                              id: item.reviewee_id,
                              name: item.reviewee_name,
                            })
                          }
                        >
                          <ShieldBan className="me-1.5 size-4" />
                          Suspend
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Suspend Dialog */}
      <Dialog
        open={suspendTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSuspendTarget(null);
            setSuspendReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend {suspendTarget?.name}</DialogTitle>
            <DialogDescription>
              This will suspend the user, withdraw their pending applications,
              and notify affected parties. Provide a reason for the suspension.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Reason for suspension..."
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSuspendTarget(null);
                setSuspendReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleSuspend}
              disabled={!suspendReason.trim() || suspendSubmitting}
            >
              {suspendSubmitting ? "Suspending..." : "Suspend User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend Deadline Dialog */}
      <Dialog
        open={deadlineTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeadlineTarget(null);
            setNewDeadline("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend Deadline</DialogTitle>
            <DialogDescription>
              Extend the content due date for &ldquo;{deadlineTarget?.title}
              &rdquo;. Current deadline:{" "}
              {deadlineTarget
                ? new Date(
                    deadlineTarget.currentDeadline
                  ).toLocaleDateString()
                : ""}
            </DialogDescription>
          </DialogHeader>
          <Input
            type="date"
            value={newDeadline}
            min={new Date().toISOString().split("T")[0]}
            onChange={(e) => setNewDeadline(e.target.value)}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeadlineTarget(null);
                setNewDeadline("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleExtendDeadline}
              disabled={!newDeadline || deadlineSubmitting}
            >
              {deadlineSubmitting ? "Extending..." : "Extend Deadline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
