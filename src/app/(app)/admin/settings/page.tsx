import {
  Settings,
  Globe,
  Smartphone,
  BookOpen,
  Calendar,
  BarChart3,
  ToggleLeft,
  Save,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  PLATFORM_LABELS,
  MARKET_LABELS,
} from "@/lib/constants";
import type { Platform, Market } from "@/lib/constants";

const enabledMarkets: Market[] = ["us", "uk", "uae", "saudi_arabia", "france", "germany", "japan", "brazil", "india", "indonesia"];
const disabledMarkets: Market[] = ["argentina", "chile", "colombia", "kenya", "nigeria", "pakistan", "bangladesh", "vietnam", "uzbekistan"];
const enabledPlatforms: Platform[] = ["tiktok", "instagram", "snapchat", "youtube"];
const disabledPlatforms: Platform[] = ["facebook"];

const playbooks = [
  { name: "Product Seeding Review", campaigns: 12, active: true },
  { name: "Brand Awareness Launch", campaigns: 8, active: true },
  { name: "Conversion Campaign", campaigns: 5, active: true },
  { name: "UGC Collection", campaigns: 3, active: true },
  { name: "Event / Launch Day", campaigns: 2, active: true },
];

const culturalCalendar = [
  { event: "Ramadan 2026", start: "Feb 18", end: "Mar 19", markets: "All MENA", status: "past" },
  { event: "Eid Al-Fitr 2026", start: "Mar 20", end: "Mar 22", markets: "All MENA", status: "past" },
  { event: "Eid Al-Adha 2026", start: "May 27", end: "May 30", markets: "All MENA", status: "upcoming" },
  { event: "Saudi National Day", start: "Sep 23", end: "Sep 23", markets: "Saudi Arabia", status: "upcoming" },
  { event: "UAE National Day", start: "Dec 2", end: "Dec 2", markets: "UAE", status: "upcoming" },
  { event: "Morocco Independence Day", start: "Nov 18", end: "Nov 18", markets: "Morocco", status: "upcoming" },
];

const featureFlags = [
  { name: "auto_translation", label: "Auto-Translation (DeepL)", description: "Automatically translate campaign briefs", enabled: true },
  { name: "look_alike_discovery", label: "Look-Alike Discovery", description: "Suggest similar creators based on audience overlap", enabled: true },
  { name: "timing_intelligence", label: "Timing Intelligence", description: "Show optimal posting times per market/platform", enabled: true },
  { name: "campaign_reports", label: "Campaign Intelligence Reports", description: "AI-powered post-campaign analytics", enabled: true },
  { name: "public_profiles", label: "Public Creator Profiles", description: "Allow creators to share their /c/slug profile", enabled: true },
  { name: "rate_card_builder", label: "Rate Card Builder", description: "Creator toolkit for building rate cards", enabled: false },
  { name: "stripe_payments", label: "Stripe Payments", description: "Enable subscription billing for brands", enabled: false },
  { name: "video_preview", label: "Video Content Preview", description: "In-app video preview for submitted content", enabled: false },
];

export default function AdminSettingsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Platform Settings</h1>
        <p className="text-sm text-slate-500">Configure platform-wide settings and feature flags</p>
      </div>

      <div className="space-y-6">
        {/* General */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="size-5 text-slate-500" />
              <CardTitle>General</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="platformName">Platform Name</Label>
                <Input id="platformName" defaultValue="PopsDrops" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="supportEmail">Support Email</Label>
                <Input id="supportEmail" defaultValue="support@popsdrops.com" className="mt-1.5" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="notifEmail">Notification From Email</Label>
                <Input id="notifEmail" defaultValue="notifications@popsdrops.com" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="approvalSla">Approval SLA (hours)</Label>
                <Input id="approvalSla" type="number" defaultValue="24" className="mt-1.5" />
              </div>
            </div>
            <Button>
              <Save className="size-4" /> Save
            </Button>
          </CardContent>
        </Card>

        {/* Markets */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="size-5 text-slate-500" />
              <CardTitle>Markets</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-3">
              <p className="mb-2 text-xs font-medium text-slate-500">Enabled Markets</p>
              <div className="flex flex-wrap gap-2">
                {enabledMarkets.map((m) => (
                  <span key={m} className="rounded-lg border border-slate-900/10 bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">
                    {MARKET_LABELS[m]}
                  </span>
                ))}
              </div>
            </div>
            <Separator className="my-4" />
            <div>
              <p className="mb-2 text-xs font-medium text-slate-500">Disabled / Coming Soon</p>
              <div className="flex flex-wrap gap-2">
                {disabledMarkets.map((m) => (
                  <span key={m} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-400">
                    {MARKET_LABELS[m]}
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Platforms */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Smartphone className="size-5 text-slate-500" />
              <CardTitle>Platforms</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {enabledPlatforms.map((p) => (
                <span key={p} className="rounded-lg border border-slate-900/10 bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">
                  {PLATFORM_LABELS[p]}
                </span>
              ))}
              {disabledPlatforms.map((p) => (
                <span key={p} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-400 line-through">
                  {PLATFORM_LABELS[p]}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Playbooks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="size-5 text-slate-500" />
              <CardTitle>Playbooks</CardTitle>
            </div>
            <Button variant="outline" size="sm">Add Playbook</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {playbooks.map((pb) => (
                <div key={pb.name} className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-2.5">
                  <div>
                    <span className="text-sm font-medium text-slate-900">{pb.name}</span>
                    <span className="ml-2 text-xs text-slate-400">{pb.campaigns} campaigns used</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">{pb.active ? "Active" : "Inactive"}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Cultural Calendar */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="size-5 text-slate-500" />
              <CardTitle>Cultural Calendar</CardTitle>
            </div>
            <Button variant="outline" size="sm">Add Event</Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium text-slate-500">
                    <th className="pb-3 pr-4">Event</th>
                    <th className="pb-3 pr-4">Dates</th>
                    <th className="pb-3 pr-4">Markets</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {culturalCalendar.map((event) => (
                    <tr key={event.event} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 pr-4 font-medium text-slate-900">{event.event}</td>
                      <td className="py-2.5 pr-4 text-slate-600">{event.start} - {event.end}</td>
                      <td className="py-2.5 pr-4 text-slate-500">{event.markets}</td>
                      <td className="py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          event.status === "past" ? "bg-slate-100 text-slate-500" : "bg-blue-100 text-blue-700"
                        }`}>
                          {event.status === "past" ? "Past" : "Upcoming"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Benchmarks */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="size-5 text-slate-500" />
              <CardTitle>Benchmarks</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-slate-500">
              Market benchmarks are recalculated weekly from aggregated campaign data.
            </p>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-slate-50 px-4 py-2">
                <p className="text-xs text-slate-500">Last calculated</p>
                <p className="text-sm font-medium text-slate-900">Mar 24, 2026</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-4 py-2">
                <p className="text-xs text-slate-500">Data points</p>
                <p className="text-sm font-medium text-slate-900">1,247</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-4 py-2">
                <p className="text-xs text-slate-500">Markets covered</p>
                <p className="text-sm font-medium text-slate-900">8</p>
              </div>
              <Button variant="outline" size="sm">Recalculate Now</Button>
            </div>
          </CardContent>
        </Card>

        {/* Feature Flags */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ToggleLeft className="size-5 text-slate-500" />
              <CardTitle>Feature Flags</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {featureFlags.map((flag) => (
                <div key={flag.name} className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{flag.label}</p>
                    <p className="text-xs text-slate-500">{flag.description}</p>
                  </div>
                  <div className={`rounded-full px-3 py-1 text-xs font-medium ${
                    flag.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                  }`}>
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
