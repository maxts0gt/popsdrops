"use client";

import {
  BarChart3,
  TrendingUp,
  Users,
  Heart,
  Globe,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const growthMetrics = [
  { label: "New Users (7d)", value: "42", change: "+18%", up: true },
  { label: "New Campaigns (7d)", value: "7", change: "+40%", up: true },
  { label: "Applications (7d)", value: "89", change: "+12%", up: true },
  { label: "Content Submitted (7d)", value: "34", change: "-5%", up: false },
];

const engagementMetrics = [
  { label: "Avg ER (All)", value: "5.8%", change: "+0.3%", up: true },
  { label: "Avg ER (TikTok)", value: "7.2%", change: "+0.5%", up: true },
  { label: "Avg ER (Instagram)", value: "4.1%", change: "-0.2%", up: false },
  { label: "Avg ER (Snapchat)", value: "5.5%", change: "+0.4%", up: true },
];

const healthMetrics = [
  { label: "Campaign Completion Rate", value: "87%", change: "+2%", up: true },
  { label: "Avg Response Time", value: "2.4h", change: "-0.3h", up: true },
  { label: "Dispute Rate", value: "2.1%", change: "-0.5%", up: true },
  { label: "Creator Retention (30d)", value: "76%", change: "+4%", up: true },
];

const marketMetrics = [
  { market: "Saudi Arabia", users: 218, campaigns: 8, avgER: "6.1%", avgRate: "$120" },
  { market: "UAE", users: 185, campaigns: 6, avgER: "5.4%", avgRate: "$150" },
  { market: "Egypt", users: 142, campaigns: 5, avgER: "7.2%", avgRate: "$65" },
  { market: "Morocco", users: 98, campaigns: 3, avgER: "6.8%", avgRate: "$55" },
  { market: "Kuwait", users: 72, campaigns: 2, avgER: "5.9%", avgRate: "$130" },
  { market: "Qatar", users: 45, campaigns: 1, avgER: "5.2%", avgRate: "$140" },
  { market: "Jordan", users: 38, campaigns: 1, avgER: "6.5%", avgRate: "$70" },
  { market: "Tunisia", users: 28, campaigns: 1, avgER: "7.0%", avgRate: "$45" },
  { market: "Kazakhstan", users: 16, campaigns: 0, avgER: "5.8%", avgRate: "$50" },
];

function MetricCards({ metrics }: { metrics: typeof growthMetrics }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      {metrics.map((m) => (
        <Card key={m.label}>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">{m.value}</p>
            <p className="text-xs text-slate-500">{m.label}</p>
            <span className={`inline-flex items-center text-xs font-medium ${m.up ? "text-emerald-600" : "text-red-500"}`}>
              {m.up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {m.change}
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ChartPlaceholder({ title, icon: Icon }: { title: string; icon: typeof BarChart3 }) {
  return (
    <div className="flex aspect-[16/9] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50">
      <div className="text-center">
        <Icon className="mx-auto mb-2 size-8 text-slate-300" />
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <p className="text-xs text-slate-400">Chart visualization coming soon</p>
      </div>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Platform Analytics</h1>
        <p className="text-sm text-slate-500">Platform-wide metrics and trends</p>
      </div>

      <Tabs defaultValue="growth">
        <TabsList variant="line" className="mb-6">
          <TabsTrigger value="growth">Growth</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="markets">Markets</TabsTrigger>
        </TabsList>

        <TabsContent value="growth">
          <MetricCards metrics={growthMetrics} />
          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>User Signups (30d)</CardTitle></CardHeader>
              <CardContent>
                <ChartPlaceholder title="Signup Trend Line" icon={TrendingUp} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Campaign Creation (30d)</CardTitle></CardHeader>
              <CardContent>
                <ChartPlaceholder title="Campaign Trend Line" icon={BarChart3} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>User Breakdown by Role</CardTitle></CardHeader>
              <CardContent>
                <ChartPlaceholder title="Pie Chart" icon={Users} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Application Volume</CardTitle></CardHeader>
              <CardContent>
                <ChartPlaceholder title="Bar Chart" icon={BarChart3} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="engagement">
          <MetricCards metrics={engagementMetrics} />
          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>ER by Platform (30d)</CardTitle></CardHeader>
              <CardContent>
                <ChartPlaceholder title="Grouped Bar Chart" icon={Heart} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Top Performing Content Formats</CardTitle></CardHeader>
              <CardContent>
                <ChartPlaceholder title="Horizontal Bar Chart" icon={BarChart3} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="health">
          <MetricCards metrics={healthMetrics} />
          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Completion Rate Trend</CardTitle></CardHeader>
              <CardContent>
                <ChartPlaceholder title="Line Chart" icon={Activity} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Response Time Distribution</CardTitle></CardHeader>
              <CardContent>
                <ChartPlaceholder title="Histogram" icon={BarChart3} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="markets">
          <Card>
            <CardHeader>
              <CardTitle>Market Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <ChartPlaceholder title="Market Map Visualization" icon={Globe} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs font-medium text-slate-500">
                      <th className="pb-3 pr-4">Market</th>
                      <th className="pb-3 pr-4 text-right">Users</th>
                      <th className="pb-3 pr-4 text-right">Active Campaigns</th>
                      <th className="pb-3 pr-4 text-right">Avg ER</th>
                      <th className="pb-3 text-right">Avg Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marketMetrics.map((m) => (
                      <tr key={m.market} className="border-b border-slate-100 last:border-0">
                        <td className="py-2.5 pr-4 font-medium text-slate-900">{m.market}</td>
                        <td className="py-2.5 pr-4 text-right text-slate-600">{m.users}</td>
                        <td className="py-2.5 pr-4 text-right text-slate-600">{m.campaigns}</td>
                        <td className="py-2.5 pr-4 text-right text-slate-600">{m.avgER}</td>
                        <td className="py-2.5 text-right text-slate-600">{m.avgRate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
