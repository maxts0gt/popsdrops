"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle,
  AlertTriangle,
  Download,
  Pause,
  Play,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CAMPAIGN_STATUS_COLORS,
  CAMPAIGN_STATUS_LABELS,
} from "@/lib/constants";
import type { CampaignStatus } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/context";
import { createClient } from "@/lib/supabase/client";
import { getSingleRelation } from "@/lib/supabase/relations";
import { pauseCampaign, cancelCampaign, resumeCampaign } from "@/app/actions/admin";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CampaignRow {
  id: string;
  title: string;
  status: CampaignStatus;
  max_creators: number;
  markets: string[];
  created_at: string;
  brand_name: string;
  member_count: number;
}

type CampaignQueryRow = Omit<CampaignRow, "brand_name" | "member_count"> & {
  brand?: { full_name: string | null } | { full_name: string | null }[] | null;
};

async function fetchCampaignRows(): Promise<CampaignRow[]> {
  const supabase = createClient();

  const { data } = await supabase
    .from("campaigns")
    .select(`
      id, title, status, max_creators, markets, created_at,
      brand:profiles!campaigns_brand_id_fkey (full_name)
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!data) return [];

  return Promise.all(
    (data as CampaignQueryRow[]).map(async (campaign) => {
      const { count } = await supabase
        .from("campaign_members")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaign.id);

      const brand = getSingleRelation(campaign.brand);

      return {
        ...campaign,
        status: campaign.status as CampaignStatus,
        brand_name: brand?.full_name ?? "Unknown",
        member_count: count ?? 0,
      };
    }),
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminCampaignsPage() {
  const { locale } = useI18n();
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogState, setDialogState] = useState<{
    type: "pause" | "cancel" | "resume" | null;
    campaign: CampaignRow | null;
  }>({ type: null, campaign: null });
  const [reason, setReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  async function loadCampaigns() {
    setLoading(true);
    setCampaigns(await fetchCampaignRows());
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;

    void fetchCampaignRows().then((nextCampaigns) => {
      if (cancelled) return;
      setCampaigns(nextCampaigns);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function openDialog(type: "pause" | "cancel" | "resume", campaign: CampaignRow) {
    setDialogState({ type, campaign });
    setReason("");
  }

  function closeDialog() {
    setDialogState({ type: null, campaign: null });
    setReason("");
  }

  async function handleAction() {
    if (!dialogState.campaign || !dialogState.type) return;

    if ((dialogState.type === "pause" || dialogState.type === "cancel") && !reason.trim()) {
      toast.error("Please provide a reason");
      return;
    }

    setActionLoading(true);
    try {
      if (dialogState.type === "pause") {
        await pauseCampaign(dialogState.campaign.id, reason.trim());
        toast.success("Campaign paused");
      } else if (dialogState.type === "cancel") {
        await cancelCampaign(dialogState.campaign.id, reason.trim());
        toast.success("Campaign cancelled");
      } else if (dialogState.type === "resume") {
        await resumeCampaign(dialogState.campaign.id);
        toast.success("Campaign resumed");
      }
      closeDialog();
      loadCampaigns();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleExportCampaigns() {
    const supabase = createClient();
    const { data } = await supabase
      .from("campaigns")
      .select("title, status, created_at, budget_total, platforms, markets")
      .order("created_at", { ascending: false });

    if (!data || data.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = ["Title", "Status", "Created", "Budget", "Platforms", "Markets"];
    const rows = data.map((c) => [
      c.title,
      c.status,
      new Date(c.created_at).toLocaleDateString(),
      c.budget_total ?? "",
      Array.isArray(c.platforms) ? c.platforms.join("; ") : "",
      Array.isArray(c.markets) ? c.markets.join("; ") : "",
    ]);

    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campaigns-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Build funnel from real data
  const statusCounts: Record<string, number> = {};
  for (const c of campaigns) {
    statusCounts[c.status] = (statusCounts[c.status] ?? 0) + 1;
  }

  const funnelStages: { status: CampaignStatus; label: string }[] = [
    { status: "draft", label: "Draft" },
    { status: "recruiting", label: "Recruiting" },
    { status: "in_progress", label: "In Progress" },
    { status: "publishing", label: "Publishing" },
    { status: "monitoring", label: "Monitoring" },
    { status: "completed", label: "Completed" },
  ];

  const maxCount = Math.max(1, ...funnelStages.map((s) => statusCounts[s.status] ?? 0));

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
        <div className="h-96 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  const dialogOpen = dialogState.type !== null;
  const dialogCampaign = dialogState.campaign;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Campaign Oversight</h1>
          <p className="text-sm text-muted-foreground">{campaigns.length} campaigns across all brands</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCampaigns}>
          <Download className="size-4" /> Export CSV
        </Button>
      </div>

      {/* Funnel Visualization */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Campaign Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            {funnelStages.map((stage) => {
              const count = statusCounts[stage.status] ?? 0;
              const heightPct = maxCount > 0 ? Math.max(10, (count / maxCount) * 100) : 10;
              return (
                <div key={stage.status} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-lg font-bold text-foreground">{count}</span>
                  <div className="flex h-24 w-full items-end justify-center">
                    <div
                      className="w-full max-w-16 rounded-t-md bg-muted transition-all"
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{stage.label}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Campaign Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Creators</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-end">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c) => {
                const showPauseCancel = ["recruiting", "in_progress", "publishing", "monitoring"].includes(c.status);
                const showResume = c.status === "paused";
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.title}</TableCell>
                    <TableCell className="text-muted-foreground">{c.brand_name}</TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CAMPAIGN_STATUS_COLORS[c.status]}`}>
                        {CAMPAIGN_STATUS_LABELS[c.status]}
                      </span>
                    </TableCell>
                    <TableCell>{c.member_count}/{c.max_creators ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString(locale, {
                        month: "short",
                        day: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-end">
                      {showPauseCancel && (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-amber-600 hover:text-amber-700"
                            onClick={() => openDialog("pause", c)}
                          >
                            <Pause className="size-3.5" /> Pause
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => openDialog("cancel", c)}
                          >
                            <XCircle className="size-3.5" /> Cancel
                          </Button>
                        </div>
                      )}
                      {showResume && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-foreground hover:text-foreground/80"
                          onClick={() => openDialog("resume", c)}
                        >
                          <Play className="size-3.5" /> Resume
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {campaigns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground/70">
                    No campaigns yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent>
          {dialogState.type === "pause" && dialogCampaign && (
            <>
              <DialogHeader>
                <DialogTitle>Pause Campaign</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{dialogCampaign.title}</p>
                  <p>{dialogCampaign.member_count} active participant{dialogCampaign.member_count !== 1 ? "s" : ""}</p>
                  <p className="mt-2 text-amber-600">All participants will be notified.</p>
                </div>
                <Textarea
                  placeholder="Reason for pausing (required)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog} disabled={actionLoading}>
                  Cancel
                </Button>
                <Button
                  className="bg-amber-600 text-white hover:bg-amber-700"
                  onClick={handleAction}
                  disabled={actionLoading || !reason.trim()}
                >
                  {actionLoading ? "Pausing..." : "Pause Campaign"}
                </Button>
              </DialogFooter>
            </>
          )}

          {dialogState.type === "cancel" && dialogCampaign && (
            <>
              <DialogHeader>
                <DialogTitle>Cancel Campaign</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{dialogCampaign.title}</p>
                  <p>{dialogCampaign.member_count} active participant{dialogCampaign.member_count !== 1 ? "s" : ""}</p>
                  <p className="mt-2 font-semibold text-red-600">
                    This action cannot be undone. All participants will be notified.
                  </p>
                </div>
                <Textarea
                  placeholder="Reason for cancellation (required)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog} disabled={actionLoading}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleAction}
                  disabled={actionLoading || !reason.trim()}
                >
                  {actionLoading ? "Cancelling..." : "Cancel Campaign"}
                </Button>
              </DialogFooter>
            </>
          )}

          {dialogState.type === "resume" && dialogCampaign && (
            <>
              <DialogHeader>
                <DialogTitle>Resume Campaign</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{dialogCampaign.title}</p>
                  <p className="mt-2">
                    This will set the campaign back to active and notify all participants.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog} disabled={actionLoading}>
                  Cancel
                </Button>
                <Button onClick={handleAction} disabled={actionLoading}>
                  {actionLoading ? "Resuming..." : "Resume Campaign"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
