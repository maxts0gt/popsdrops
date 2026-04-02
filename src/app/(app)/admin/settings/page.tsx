"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Globe,
  Smartphone,
  BookOpen,
  Calendar,
  BarChart3,
  ToggleLeft,
  Save,
  Loader2,
  SlidersHorizontal,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { PLATFORM_LABELS } from "@/lib/constants";
import type { Platform } from "@/lib/constants";
import {
  getPlatformSettings,
  updatePlatformSetting,
} from "@/app/actions/admin";

// ---------------------------------------------------------------------------
// Static config (these are fine to keep hardcoded)
// ---------------------------------------------------------------------------

const enabledPlatforms: Platform[] = [
  "tiktok",
  "instagram",
  "snapchat",
  "youtube",
];
const disabledPlatforms: Platform[] = ["facebook"];

const featureFlags = [
  {
    name: "auto_translation",
    label: "Auto-Translation (Gemini)",
    description: "Automatically translate campaign briefs",
    enabled: true,
  },
  {
    name: "look_alike_discovery",
    label: "Look-Alike Discovery",
    description: "Suggest similar creators based on audience overlap",
    enabled: true,
  },
  {
    name: "timing_intelligence",
    label: "Timing Intelligence",
    description: "Show optimal posting times per market/platform",
    enabled: true,
  },
  {
    name: "campaign_reports",
    label: "Campaign Intelligence Reports",
    description: "AI-powered post-campaign analytics",
    enabled: true,
  },
  {
    name: "public_profiles",
    label: "Public Creator Profiles",
    description: "Allow creators to share their /c/slug profile",
    enabled: true,
  },
  {
    name: "rate_card_builder",
    label: "Rate Card Builder",
    description: "Creator toolkit for building rate cards",
    enabled: false,
  },
  {
    name: "video_preview",
    label: "Video Content Preview",
    description: "In-app video preview for submitted content",
    enabled: false,
  },
];

// All available markets for the toggleable checklist
const ALL_MARKETS = [
  "us", "gb", "ae", "sa", "kw", "qa", "bh", "om", "eg", "jo",
  "ma", "iq", "tr", "kz", "uz", "de", "fr", "nl", "se", "jp",
  "kr", "id", "my", "th", "ph", "vn", "br", "mx", "ng", "ke",
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlaybookRow {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
}

interface CulturalEvent {
  id: string;
  event_name: string;
  start_date: string;
  end_date: string;
  market: string;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminSettingsPage() {
  // DB-backed settings state
  const [enabledMarkets, setEnabledMarkets] = useState<string[]>([]);
  const [minFollowers, setMinFollowers] = useState<number>(500);
  const [maxRevisions, setMaxRevisions] = useState<number>(3);
  const [slaHours, setSlaHours] = useState<number>(24);
  const [autoApproveCreators, setAutoApproveCreators] = useState(false);

  // Read-only display data
  const [playbooks, setPlaybooks] = useState<PlaybookRow[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CulturalEvent[]>([]);
  const [benchmarkCount, setBenchmarkCount] = useState<number>(0);

  const [loading, setLoading] = useState(true);
  const [savingMarkets, startSavingMarkets] = useTransition();
  const [savingRules, startSavingRules] = useTransition();

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const [settingsResult, playbookResult, calendarResult, benchmarkResult] =
        await Promise.all([
          getPlatformSettings(),
          supabase
            .from("playbooks")
            .select("id, name, description, sort_order")
            .order("sort_order", { ascending: true }),
          supabase
            .from("cultural_calendar")
            .select("id, event_name, start_date, end_date, market")
            .order("start_date", { ascending: true })
            .limit(50),
          supabase
            .from("market_benchmarks")
            .select("id", { count: "exact", head: true }),
        ]);

      // Hydrate settings
      const s = settingsResult;
      if (Array.isArray(s.enabled_markets)) {
        setEnabledMarkets(s.enabled_markets as string[]);
      }
      if (typeof s.creator_min_followers === "number") {
        setMinFollowers(s.creator_min_followers);
      }
      if (typeof s.max_revisions_per_submission === "number") {
        setMaxRevisions(s.max_revisions_per_submission);
      }
      if (typeof s.sla_approval_hours === "number") {
        setSlaHours(s.sla_approval_hours);
      }
      if (typeof s.auto_approve_creators === "boolean") {
        setAutoApproveCreators(s.auto_approve_creators);
      }

      setPlaybooks(playbookResult.data ?? []);
      setCalendarEvents(calendarResult.data ?? []);
      setBenchmarkCount(benchmarkResult.count ?? 0);

      setLoading(false);
    }
    load();
  }, []);

  function toggleMarket(market: string) {
    setEnabledMarkets((prev) =>
      prev.includes(market)
        ? prev.filter((m) => m !== market)
        : [...prev, market].sort()
    );
  }

  function handleSaveMarkets() {
    startSavingMarkets(async () => {
      try {
        await updatePlatformSetting("enabled_markets", enabledMarkets);
        toast.success("Enabled markets saved");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to save markets"
        );
      }
    });
  }

  function handleSaveRules() {
    startSavingRules(async () => {
      try {
        await Promise.all([
          updatePlatformSetting("creator_min_followers", minFollowers),
          updatePlatformSetting(
            "max_revisions_per_submission",
            maxRevisions
          ),
          updatePlatformSetting("sla_approval_hours", slaHours),
          updatePlatformSetting("auto_approve_creators", autoApproveCreators),
        ]);
        toast.success("Platform rules saved");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to save rules"
        );
      }
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          Platform Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure platform-wide settings and feature flags
        </p>
      </div>

      <div className="space-y-6">
        {/* Markets (DB-backed, toggleable) */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="size-5 text-muted-foreground" />
              <CardTitle>Enabled Markets</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <>
                <div className="grid grid-cols-3 gap-x-6 gap-y-2 sm:grid-cols-5">
                  {ALL_MARKETS.map((m) => (
                    <label
                      key={m}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={enabledMarkets.includes(m)}
                        onChange={() => toggleMarket(m)}
                        className="size-4 rounded border-border accent-primary"
                      />
                      <span className="uppercase">{m}</span>
                    </label>
                  ))}
                </div>
                <Button onClick={handleSaveMarkets} disabled={savingMarkets}>
                  {savingMarkets ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}{" "}
                  Save Markets
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Platform Rules (DB-backed) */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="size-5 text-muted-foreground" />
              <CardTitle>Platform Rules</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <Label htmlFor="minFollowers">
                      Min Followers for Visibility
                    </Label>
                    <Input
                      id="minFollowers"
                      type="number"
                      min={0}
                      value={minFollowers}
                      onChange={(e) =>
                        setMinFollowers(parseInt(e.target.value, 10) || 0)
                      }
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxRevisions">
                      Max Revisions per Submission
                    </Label>
                    <Input
                      id="maxRevisions"
                      type="number"
                      min={1}
                      max={10}
                      value={maxRevisions}
                      onChange={(e) =>
                        setMaxRevisions(parseInt(e.target.value, 10) || 1)
                      }
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="slaHours">SLA Approval Hours</Label>
                    <Input
                      id="slaHours"
                      type="number"
                      min={1}
                      value={slaHours}
                      onChange={(e) =>
                        setSlaHours(parseInt(e.target.value, 10) || 1)
                      }
                      className="mt-1.5"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={autoApproveCreators}
                    onChange={(e) =>
                      setAutoApproveCreators(e.target.checked)
                    }
                    className="size-4 rounded border-border accent-primary"
                  />
                  Auto-approve new creator accounts
                </label>
                <Button onClick={handleSaveRules} disabled={savingRules}>
                  {savingRules ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}{" "}
                  Save Rules
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Platforms (static config) */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Smartphone className="size-5 text-muted-foreground" />
              <CardTitle>Platforms</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {enabledPlatforms.map((p) => (
                <span
                  key={p}
                  className="rounded-lg border border-primary/10 bg-primary px-3 py-1.5 text-sm font-medium text-white"
                >
                  {PLATFORM_LABELS[p]}
                </span>
              ))}
              {disabledPlatforms.map((p) => (
                <span
                  key={p}
                  className="rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground/70 line-through"
                >
                  {PLATFORM_LABELS[p]}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Playbooks (real data) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="size-5 text-muted-foreground" />
              <CardTitle>Playbooks</CardTitle>
            </div>
            <Button variant="outline" size="sm" disabled>
              Add Playbook
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : playbooks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-8 text-center">
                <BookOpen className="mx-auto mb-3 size-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  No playbooks configured
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Playbooks define reusable campaign templates
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {playbooks.map((pb) => (
                  <div
                    key={pb.id}
                    className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5"
                  >
                    <div>
                      <span className="text-sm font-medium text-foreground">
                        {pb.name}
                      </span>
                      {pb.description && (
                        <span className="ml-2 text-xs text-muted-foreground/70">
                          {pb.description}
                        </span>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      Active
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cultural Calendar (real data) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="size-5 text-muted-foreground" />
              <CardTitle>Cultural Calendar</CardTitle>
            </div>
            <Button variant="outline" size="sm" disabled>
              Add Event
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : calendarEvents.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-8 text-center">
                <Calendar className="mx-auto mb-3 size-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  No cultural events configured
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Add market-specific events to help with campaign timing
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                      <th className="pb-3 pr-4">Event</th>
                      <th className="pb-3 pr-4">Dates</th>
                      <th className="pb-3 pr-4">Market</th>
                      <th className="pb-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calendarEvents.map((event) => {
                      const isPast =
                        new Date(event.end_date) < new Date();
                      return (
                        <tr
                          key={event.id}
                          className="border-b border-border/50 last:border-0"
                        >
                          <td className="py-2.5 pr-4 font-medium text-foreground">
                            {event.event_name}
                          </td>
                          <td className="py-2.5 pr-4 text-muted-foreground">
                            {new Date(event.start_date).toLocaleDateString()} -{" "}
                            {new Date(event.end_date).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 pr-4 capitalize text-muted-foreground">
                            {event.market.replace(/_/g, " ")}
                          </td>
                          <td className="py-2.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                isPast
                                  ? "bg-muted text-muted-foreground"
                                  : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {isPast ? "Past" : "Upcoming"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Benchmarks (real data) */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="size-5 text-muted-foreground" />
              <CardTitle>Benchmarks</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-16 w-full" />
            ) : benchmarkCount === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-8 text-center">
                <BarChart3 className="mx-auto mb-3 size-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  No benchmark data yet
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Benchmarks are calculated from aggregated campaign performance
                  data
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-muted/50 px-4 py-2">
                  <p className="text-xs text-muted-foreground">Data points</p>
                  <p className="text-sm font-medium text-foreground">
                    {benchmarkCount.toLocaleString()}
                  </p>
                </div>
                <Button variant="outline" size="sm" disabled>
                  Recalculate Now
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Feature Flags (static config) */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ToggleLeft className="size-5 text-muted-foreground" />
              <CardTitle>Feature Flags</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {featureFlags.map((flag) => (
                <div
                  key={flag.name}
                  className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {flag.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {flag.description}
                    </p>
                  </div>
                  <div
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      flag.enabled
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {flag.enabled ? "Enabled" : "Disabled"}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
