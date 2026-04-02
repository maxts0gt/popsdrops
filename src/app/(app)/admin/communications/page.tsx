import {
  MessageSquare,
  Send,
  FileText,
  Plus,
  Bell,
  Mail,
  Users,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const announcements = [
  {
    id: "ann-1",
    title: "Platform Maintenance — March 30",
    audience: "All Users",
    status: "scheduled",
    scheduledFor: "Mar 29, 2026 at 6:00 PM",
    content: "PopsDrops will undergo scheduled maintenance on March 30 from 2:00-4:00 AM GMT. During this time, the platform may be temporarily unavailable.",
  },
  {
    id: "ann-2",
    title: "New Feature: Campaign Intelligence Reports",
    audience: "Brands",
    status: "sent",
    sentAt: "Mar 20, 2026",
    content: "We are excited to announce Campaign Intelligence Reports, available for all completed campaigns. Get insights on creator performance, optimal posting times, and AI-powered recommendations.",
  },
  {
    id: "ann-3",
    title: "Ramadan Campaign Tips",
    audience: "All Users",
    status: "sent",
    sentAt: "Mar 1, 2026",
    content: "Ramadan is here! Check out our guide for best practices on content creation and campaign timing during the holy month.",
  },
];

const templates = [
  { id: "t1", name: "Welcome — Creator", type: "email", trigger: "On creator approval", lastUpdated: "Feb 15, 2026" },
  { id: "t2", name: "Welcome — Brand", type: "email", trigger: "On brand approval", lastUpdated: "Feb 15, 2026" },
  { id: "t3", name: "New Campaign Match", type: "email + push", trigger: "On campaign publish (matching creators)", lastUpdated: "Mar 5, 2026" },
  { id: "t4", name: "Application Accepted", type: "email + push", trigger: "On application acceptance", lastUpdated: "Feb 20, 2026" },
  { id: "t5", name: "Application Rejected", type: "email", trigger: "On application rejection", lastUpdated: "Feb 20, 2026" },
  { id: "t6", name: "Content Submitted", type: "email", trigger: "On content submission", lastUpdated: "Mar 1, 2026" },
  { id: "t7", name: "Content Approved", type: "email + push", trigger: "On content approval", lastUpdated: "Mar 1, 2026" },
  { id: "t8", name: "Revision Requested", type: "email + push", trigger: "On revision request", lastUpdated: "Mar 1, 2026" },
  { id: "t9", name: "Campaign Completed", type: "email", trigger: "On campaign status change to completed", lastUpdated: "Mar 10, 2026" },
  { id: "t10", name: "Deadline Reminder", type: "email + push", trigger: "48h before content deadline", lastUpdated: "Mar 8, 2026" },
];

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  sent: "bg-emerald-100 text-emerald-700",
  draft: "bg-slate-100 text-slate-600",
};

export default function AdminCommunicationsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Communications</h1>
        <p className="text-sm text-slate-500">Manage announcements and notification templates</p>
      </div>

      {/* Announcements */}
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="size-5 text-slate-500" />
            <CardTitle>Announcements</CardTitle>
          </div>
          <Button size="sm">
            <Plus className="size-3.5" /> New Announcement
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {announcements.map((ann) => (
              <div key={ann.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-slate-900">{ann.title}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColors[ann.status]}`}>
                        {ann.status}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                      <Users className="size-3" /> {ann.audience}
                      <span className="text-slate-300">|</span>
                      <Clock className="size-3" />
                      {ann.status === "scheduled" ? `Scheduled: ${ann.scheduledFor}` : `Sent: ${ann.sentAt}`}
                    </div>
                  </div>
                  <Button variant="outline" size="sm">Edit</Button>
                </div>
                <p className="mt-2 text-sm text-slate-600">{ann.content}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Email Templates */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="size-5 text-slate-500" />
            <CardTitle>Notification Templates</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium text-slate-500">
                  <th className="pb-3 pr-4">Template Name</th>
                  <th className="pb-3 pr-4">Type</th>
                  <th className="pb-3 pr-4">Trigger</th>
                  <th className="pb-3 pr-4">Last Updated</th>
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <FileText className="size-3.5 text-slate-400" />
                        <span className="font-medium text-slate-900">{t.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4">
                      <Badge variant="secondary" className="text-xs">{t.type}</Badge>
                    </td>
                    <td className="py-2.5 pr-4 text-slate-500">{t.trigger}</td>
                    <td className="py-2.5 pr-4 text-slate-400">{t.lastUpdated}</td>
                    <td className="py-2.5">
                      <Button variant="ghost" size="sm">Edit</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
