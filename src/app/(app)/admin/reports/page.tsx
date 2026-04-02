"use client";

import {
  AlertTriangle,
  Clock,
  MessageSquare,
  CheckCircle,
  Flag,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type ReportStatus = "open" | "in_progress" | "resolved";

interface Report {
  id: string;
  type: "dispute" | "content_flag" | "user_report" | "compliance";
  title: string;
  description: string;
  reporter: { name: string; initials: string };
  reportedEntity: string;
  campaign?: string;
  status: ReportStatus;
  priority: "low" | "medium" | "high";
  createdAt: string;
  slaDeadline: string;
  slaStatus: "on_track" | "at_risk" | "overdue";
}

const slaColors: Record<string, string> = {
  on_track: "text-emerald-600",
  at_risk: "text-amber-600",
  overdue: "text-red-600",
};

const slaLabels: Record<string, string> = {
  on_track: "On track",
  at_risk: "At risk",
  overdue: "Overdue",
};

const priorityColors: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-slate-100 text-slate-600",
};

const typeIcons: Record<string, { icon: typeof AlertTriangle; color: string }> = {
  dispute: { icon: AlertTriangle, color: "bg-red-50 text-red-600" },
  content_flag: { icon: Flag, color: "bg-amber-50 text-amber-600" },
  user_report: { icon: MessageSquare, color: "bg-slate-100 text-slate-600" },
  compliance: { icon: AlertTriangle, color: "bg-slate-100 text-slate-600" },
};

const typeLabels: Record<string, string> = {
  dispute: "Dispute",
  content_flag: "Content Flag",
  user_report: "User Report",
  compliance: "Compliance",
};

const reports: Report[] = [
  {
    id: "r1",
    type: "dispute",
    title: "Payment disagreement — Eid Gift Guide",
    description: "Creator claims agreed rate was $200 but brand only paid $150. Conversation screenshots provided.",
    reporter: { name: "Nora Al-Rashid", initials: "NR" },
    reportedEntity: "Luxe Beauty Co.",
    campaign: "Eid Gift Guide",
    status: "open",
    priority: "high",
    createdAt: "Mar 26, 2026",
    slaDeadline: "Mar 28, 2026",
    slaStatus: "at_risk",
  },
  {
    id: "r2",
    type: "content_flag",
    title: "Undisclosed sponsorship — potential FTC violation",
    description: "Content posted without required #ad or #sponsored disclosure. Multiple community reports.",
    reporter: { name: "System", initials: "SY" },
    reportedEntity: "Ahmed Badawi",
    campaign: "Tech Unboxing Series",
    status: "in_progress",
    priority: "high",
    createdAt: "Mar 25, 2026",
    slaDeadline: "Mar 27, 2026",
    slaStatus: "overdue",
  },
  {
    id: "r3",
    type: "user_report",
    title: "Unresponsive creator — no content delivery",
    description: "Creator accepted campaign 3 weeks ago but has not delivered any content or responded to messages.",
    reporter: { name: "Sarah Kim", initials: "SK" },
    reportedEntity: "Reda Toumi",
    campaign: "Summer Skincare Awareness",
    status: "open",
    priority: "medium",
    createdAt: "Mar 24, 2026",
    slaDeadline: "Mar 29, 2026",
    slaStatus: "on_track",
  },
  {
    id: "r4",
    type: "compliance",
    title: "Health claims in beauty content",
    description: "Creator made unverified medical claims about skincare product effectiveness. Needs content review.",
    reporter: { name: "System", initials: "SY" },
    reportedEntity: "Fatima Khalil",
    campaign: "Ramadan Beauty Collection Launch",
    status: "in_progress",
    priority: "medium",
    createdAt: "Mar 22, 2026",
    slaDeadline: "Mar 28, 2026",
    slaStatus: "at_risk",
  },
  {
    id: "r5",
    type: "dispute",
    title: "Content usage beyond agreed scope",
    description: "Brand used creator content in paid ads without paid_ads usage rights. Creator requesting additional compensation.",
    reporter: { name: "Amina Benali", initials: "AB" },
    reportedEntity: "StyleHub Arabia",
    campaign: "Spring Fashion Lookbook",
    status: "resolved",
    priority: "high",
    createdAt: "Mar 15, 2026",
    slaDeadline: "Mar 18, 2026",
    slaStatus: "on_track",
  },
  {
    id: "r6",
    type: "user_report",
    title: "Fake follower count suspicion",
    description: "Brand reported creator has suspicious follower patterns. Engagement rate inconsistent with follower count.",
    reporter: { name: "Fresh Foods MENA", initials: "FF" },
    reportedEntity: "Ahmed Badawi",
    status: "resolved",
    priority: "low",
    createdAt: "Mar 10, 2026",
    slaDeadline: "Mar 15, 2026",
    slaStatus: "on_track",
  },
];

function ReportCard({ report }: { report: Report }) {
  const typeInfo = typeIcons[report.type];
  const Icon = typeInfo.icon;

  return (
    <Card>
      <CardContent>
        <div className="flex items-start gap-3">
          <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${typeInfo.color}`}>
            <Icon className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-slate-900">{report.title}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityColors[report.priority]}`}>
                    {report.priority}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                  <span>{typeLabels[report.type]}</span>
                  <span className="text-slate-300">|</span>
                  <span>vs {report.reportedEntity}</span>
                  {report.campaign && (
                    <>
                      <span className="text-slate-300">|</span>
                      <span>{report.campaign}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <p className="mt-2 text-sm text-slate-600">{report.description}</p>

            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <div className="flex items-center gap-1">
                  <Avatar size="sm">
                    <AvatarFallback className="text-[10px]">{report.reporter.initials}</AvatarFallback>
                  </Avatar>
                  {report.reporter.name}
                </div>
                <span>{report.createdAt}</span>
                <div className="flex items-center gap-1">
                  <Clock className={`size-3 ${slaColors[report.slaStatus]}`} />
                  <span className={slaColors[report.slaStatus]}>
                    SLA: {slaLabels[report.slaStatus]} (due {report.slaDeadline})
                  </span>
                </div>
              </div>
              {report.status !== "resolved" && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">Assign</Button>
                  <Button size="sm">
                    {report.status === "open" ? "Investigate" : "Resolve"}
                  </Button>
                </div>
              )}
              {report.status === "resolved" && (
                <Badge variant="secondary" className="text-xs">
                  <CheckCircle className="mr-1 size-3" /> Resolved
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReportList({ items }: { items: Report[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 py-12 text-center">
        <CheckCircle className="mx-auto mb-3 size-8 text-slate-300" />
        <p className="text-sm text-slate-500">No reports in this category</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {items.map((r) => (
        <ReportCard key={r.id} report={r} />
      ))}
    </div>
  );
}

export default function AdminReportsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Reports & Disputes</h1>
        <p className="text-sm text-slate-500">
          {reports.filter((r) => r.status !== "resolved").length} active reports &middot;{" "}
          {reports.filter((r) => r.slaStatus === "overdue").length} overdue
        </p>
      </div>

      <Tabs defaultValue="open">
        <TabsList variant="line" className="mb-6">
          <TabsTrigger value="open">Open ({reports.filter((r) => r.status === "open").length})</TabsTrigger>
          <TabsTrigger value="in_progress">In Progress ({reports.filter((r) => r.status === "in_progress").length})</TabsTrigger>
          <TabsTrigger value="resolved">Resolved ({reports.filter((r) => r.status === "resolved").length})</TabsTrigger>
        </TabsList>

        <TabsContent value="open">
          <ReportList items={reports.filter((r) => r.status === "open")} />
        </TabsContent>
        <TabsContent value="in_progress">
          <ReportList items={reports.filter((r) => r.status === "in_progress")} />
        </TabsContent>
        <TabsContent value="resolved">
          <ReportList items={reports.filter((r) => r.status === "resolved")} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
