import {
  ScrollText,
  Search,
  Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AuditEntry {
  id: string;
  timestamp: string;
  admin: string;
  action: string;
  target: string;
  details: string;
  category: "user" | "campaign" | "system" | "content" | "setting";
}

const categoryColors: Record<string, string> = {
  user: "bg-slate-100 text-slate-700",
  campaign: "bg-slate-100 text-slate-700",
  system: "bg-slate-100 text-slate-600",
  content: "bg-slate-100 text-slate-700",
  setting: "bg-slate-100 text-slate-700",
};

const auditEntries: AuditEntry[] = [
  {
    id: "a1",
    timestamp: "2026-03-28 09:15:32",
    admin: "admin@popsdrops.com",
    action: "Approved creator",
    target: "Mariam Al-Kuwaiti (mariam@example.com)",
    details: "All verification checks passed. Auto-matched to 2 active campaigns.",
    category: "user",
  },
  {
    id: "a2",
    timestamp: "2026-03-28 08:42:11",
    admin: "admin@popsdrops.com",
    action: "Rejected creator",
    target: "Ahmed Badawi (ahmed.b@example.com)",
    details: "Follower count mismatch. Claimed 50K, verified 8K. Flagged for investigation.",
    category: "user",
  },
  {
    id: "a3",
    timestamp: "2026-03-27 17:30:05",
    admin: "admin@popsdrops.com",
    action: "Approved brand",
    target: "Fresh Foods MENA (hello@freshfoods.ae)",
    details: "Website verified. Industry: Food & Beverage. Market: UAE.",
    category: "user",
  },
  {
    id: "a4",
    timestamp: "2026-03-27 15:20:44",
    admin: "admin@popsdrops.com",
    action: "Paused campaign",
    target: "Spring Fashion Lookbook (camp-7)",
    details: "Paused at brand request. Reason: product supply chain delay.",
    category: "campaign",
  },
  {
    id: "a5",
    timestamp: "2026-03-27 14:05:18",
    admin: "admin@popsdrops.com",
    action: "Flagged content",
    target: "Content submission cs-234",
    details: "Undisclosed sponsorship. Notified creator and brand. Required re-upload with #ad disclosure.",
    category: "content",
  },
  {
    id: "a6",
    timestamp: "2026-03-27 11:30:00",
    admin: "system",
    action: "Benchmark recalculation",
    target: "All markets",
    details: "Weekly benchmark recalculation completed. 1,247 data points across 8 markets.",
    category: "system",
  },
  {
    id: "a7",
    timestamp: "2026-03-26 16:45:22",
    admin: "admin@popsdrops.com",
    action: "Resolved dispute",
    target: "Dispute #r5 — Content usage rights",
    details: "Mediated between creator and brand. Brand agreed to pay additional $100 for paid ads usage.",
    category: "content",
  },
  {
    id: "a8",
    timestamp: "2026-03-26 10:12:08",
    admin: "admin@popsdrops.com",
    action: "Updated feature flag",
    target: "campaign_reports",
    details: "Enabled Campaign Intelligence Reports feature for all brands.",
    category: "setting",
  },
  {
    id: "a9",
    timestamp: "2026-03-25 09:00:00",
    admin: "system",
    action: "Sent announcement",
    target: "All users",
    details: "Sent 'Ramadan Campaign Tips' announcement to 842 users. Open rate: 34%.",
    category: "system",
  },
  {
    id: "a10",
    timestamp: "2026-03-24 14:30:55",
    admin: "admin@popsdrops.com",
    action: "Suspended user",
    target: "Ahmed Badawi (ahmed.b@example.com)",
    details: "Suspended for fake follower count. 30-day ban. Can appeal via support email.",
    category: "user",
  },
  {
    id: "a11",
    timestamp: "2026-03-24 11:15:00",
    admin: "admin@popsdrops.com",
    action: "Added cultural event",
    target: "Cultural Calendar",
    details: "Added Eid Al-Adha 2026 (May 27-30) for all MENA markets.",
    category: "setting",
  },
  {
    id: "a12",
    timestamp: "2026-03-23 16:00:33",
    admin: "admin@popsdrops.com",
    action: "Approved creator",
    target: "Omar Habib (omar@example.com)",
    details: "YouTube channel verified (78K subs). Added to travel niche pool.",
    category: "user",
  },
];

export default function AdminAuditPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
        <p className="text-sm text-slate-500">Complete history of administrative actions</p>
      </div>

      {/* Search & Filter */}
      <Card className="mb-6">
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Search actions, targets, or details..." className="pl-9" />
          </div>
          <div className="flex gap-2">
            <select className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
              <option value="">All Categories</option>
              <option value="user">User</option>
              <option value="campaign">Campaign</option>
              <option value="content">Content</option>
              <option value="setting">Setting</option>
              <option value="system">System</option>
            </select>
            <select className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
              <option value="">All Admins</option>
              <option value="admin@popsdrops.com">admin@popsdrops.com</option>
              <option value="system">System</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Audit Table */}
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap text-xs text-slate-500 font-mono">
                    {entry.timestamp}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {entry.admin === "system" ? (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">System</span>
                    ) : (
                      <span className="text-xs">{entry.admin}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${categoryColors[entry.category]}`}>
                        {entry.category}
                      </span>
                      <span className="text-sm font-medium text-slate-900">{entry.action}</span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-slate-600" title={entry.target}>
                    {entry.target}
                  </TableCell>
                  <TableCell className="max-w-[300px] truncate text-xs text-slate-500" title={entry.details}>
                    {entry.details}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
