"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle,
  AlertTriangle,
  Pause,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { pauseCampaign, cancelCampaign } from "@/app/actions/admin";
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminCampaignsPage() {
  const { locale } = useI18n();
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadCampaigns() {
    const supabase = createClient();

    const { data } = await supabase
      .from("campaigns")
      .select(`
        id, title, status, max_creators, markets, created_at,
        brand:profiles!campaigns_brand_id_fkey (full_name)
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (data) {
      // Fetch member counts in parallel
      const enriched = await Promise.all(
        data.map(async (c: any) => {
          const { count } = await supabase
            .from("campaign_members")
            .select("id", { count: "exact", head: true })
            .eq("campaign_id", c.id);

          return {
            ...c,
            status: c.status as CampaignStatus,
            brand_name: c.brand?.full_name ?? "Unknown",
            member_count: count ?? 0,
          };
        })
      );
      setCampaigns(enriched);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadCampaigns();
  }, []);

  async function handlePause(id: string, title: string) {
    try {
      await pauseCampaign(id, "Paused by admin");
      toast.success(`"${title}" paused`);
      loadCampaigns();
    } catch {
      toast.error("Failed to pause campaign");
    }
  }

  async function handleCancel(id: string, title: string) {
    try {
      await cancelCampaign(id, "Cancelled by admin");
      toast.success(`"${title}" cancelled`);
      loadCampaigns();
    } catch {
      toast.error("Failed to cancel campaign");
    }
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
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-96 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Campaign Oversight</h1>
        <p className="text-sm text-slate-500">{campaigns.length} campaigns across all brands</p>
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
                  <span className="text-lg font-bold text-slate-900">{count}</span>
                  <div className="flex h-24 w-full items-end justify-center">
                    <div
                      className="w-full max-w-16 rounded-t-md bg-slate-200 transition-all"
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500">{stage.label}</span>
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
                const isActive = !["draft", "completed", "cancelled", "paused"].includes(c.status);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.title}</TableCell>
                    <TableCell className="text-slate-500">{c.brand_name}</TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CAMPAIGN_STATUS_COLORS[c.status]}`}>
                        {CAMPAIGN_STATUS_LABELS[c.status]}
                      </span>
                    </TableCell>
                    <TableCell>{c.member_count}/{c.max_creators ?? "—"}</TableCell>
                    <TableCell className="text-slate-500">
                      {new Date(c.created_at).toLocaleDateString(locale, {
                        month: "short",
                        day: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-end">
                      {isActive && (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-amber-600 hover:text-amber-700"
                            onClick={() => handlePause(c.id, c.title)}
                          >
                            <Pause className="size-3.5" /> Pause
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleCancel(c.id, c.title)}
                          >
                            <XCircle className="size-3.5" /> Cancel
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {campaigns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-slate-400">
                    No campaigns yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
