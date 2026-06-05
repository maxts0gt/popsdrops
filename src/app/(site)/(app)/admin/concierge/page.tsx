import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BriefcaseBusiness,
} from "lucide-react";
import {
  quoteEnterpriseConciergeRequest,
  updateEnterpriseConciergeRequestStatus,
} from "@/app/actions/admin";
import { getUser } from "@/app/actions/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  getMarketLabel,
  getPlatformLabel,
} from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { CampaignModeType } from "@/types/database";

type SearchParams = Promise<
  Record<string, string | string[] | undefined> | undefined
>;

type EnterpriseConciergeRequestStatus =
  | "requested"
  | "reviewing"
  | "quoted"
  | "closed";

type ConciergeSortKey =
  | "created_at"
  | "campaign_title"
  | "company_name"
  | "requested_creator_count"
  | "market_count"
  | "investment_cents"
  | "status";

type SortDir = "asc" | "desc";

type ConciergeRequestRow = {
  id: string;
  brand_id: string;
  campaign_title: string;
  campaign_mode: CampaignModeType;
  requested_creator_count: number;
  market_count: number;
  markets: string[];
  platforms: string[];
  creator_budget_cents: number;
  product_value_cents: number;
  fulfillment_budget_cents: number;
  service_estimate: Record<string, unknown>;
  note: string | null;
  status: string;
  quoted_service_fee_cents: number | null;
  quoted_service_fee_currency: string;
  quote_note: string | null;
  quoted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type BrandProfileRow = {
  profile_id: string;
  company_name: string;
  contact_email: string | null;
};

type BrandUserRow = {
  id: string;
  full_name: string;
  email: string;
};

type ConciergeRequest = ConciergeRequestRow & {
  status: EnterpriseConciergeRequestStatus;
  company_name: string;
  brand_email: string;
  brand_name: string;
  investment_cents: number;
};

const requestStatuses = [
  "requested",
  "reviewing",
  "quoted",
  "closed",
] as const satisfies readonly EnterpriseConciergeRequestStatus[];

const requestStatusLabels: Record<EnterpriseConciergeRequestStatus, string> = {
  requested: "Requested",
  reviewing: "Reviewing",
  quoted: "Quoted",
  closed: "Closed",
};

const conciergeSortLabels: Record<ConciergeSortKey, string> = {
  created_at: "Requested",
  campaign_title: "Campaign",
  company_name: "Brand",
  requested_creator_count: "Creators",
  market_count: "Markets",
  investment_cents: "Investment",
  status: "Status",
};

function getSearchParam(
  params: Record<string, string | string[] | undefined> | undefined,
  key: string,
) {
  const value = params?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function parseSortDir(value: string | undefined): SortDir {
  return value === "asc" || value === "desc" ? value : "desc";
}

function parseConciergeSortKey(value: string | undefined): ConciergeSortKey {
  return value && value in conciergeSortLabels
    ? (value as ConciergeSortKey)
    : "created_at";
}

function parseStatusFilter(
  value: string | undefined,
): EnterpriseConciergeRequestStatus | "all" {
  return value && requestStatuses.includes(value as EnterpriseConciergeRequestStatus)
    ? (value as EnterpriseConciergeRequestStatus)
    : "all";
}

function normalizeStatus(value: string): EnterpriseConciergeRequestStatus {
  return requestStatuses.includes(value as EnterpriseConciergeRequestStatus)
    ? (value as EnterpriseConciergeRequestStatus)
    : "requested";
}

function compareText(a: string, b: string) {
  return a.localeCompare(b, "en-US", { numeric: true, sensitivity: "base" });
}

function compareRequests(
  a: ConciergeRequest,
  b: ConciergeRequest,
  sortKey: ConciergeSortKey,
  sortDir: SortDir,
) {
  const direction = sortDir === "asc" ? 1 : -1;

  if (sortKey === "created_at") {
    return (
      (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) *
      direction
    );
  }

  if (
    sortKey === "requested_creator_count" ||
    sortKey === "market_count" ||
    sortKey === "investment_cents"
  ) {
    return (a[sortKey] - b[sortKey]) * direction;
  }

  return compareText(String(a[sortKey]), String(b[sortKey])) * direction;
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(cents / 100);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

function formatList(values: readonly string[], formatter: (value: string) => string) {
  if (values.length === 0) return "Not set";

  const visible = values.slice(0, 3).map(formatter);
  const extraCount = values.length - visible.length;
  return extraCount > 0 ? `${visible.join(", ")} +${extraCount}` : visible.join(", ");
}

function getConciergeRequestTypeLabel(request: ConciergeRequest) {
  return request.campaign_mode === "private"
    ? "Private capacity review"
    : "Concierge sourcing";
}

function conciergeHref({
  status,
  sort,
  dir,
}: {
  status: EnterpriseConciergeRequestStatus | "all";
  sort: ConciergeSortKey;
  dir: SortDir;
}) {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  params.set("sort", sort);
  params.set("dir", dir);
  return `/admin/concierge?${params.toString()}#request-queue`;
}

function statusBadgeClass(status: EnterpriseConciergeRequestStatus) {
  if (status === "requested") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "reviewing") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "quoted") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-border bg-white text-muted-foreground";
}

function getStatusActions(status: EnterpriseConciergeRequestStatus) {
  if (status === "requested") {
    return [
      { label: "Start review", status: "reviewing", variant: "default" },
      { label: "Close", status: "closed", variant: "outline" },
    ] as const;
  }

  if (status === "reviewing") {
    return [
      { label: "Close", status: "closed", variant: "outline" },
    ] as const;
  }

  if (status === "quoted") {
    return [
      { label: "Review again", status: "reviewing", variant: "outline" },
      { label: "Close", status: "closed", variant: "outline" },
    ] as const;
  }

  return [
    { label: "Reopen", status: "reviewing", variant: "outline" },
  ] as const;
}

function ConciergeSortableHead({
  currentDir,
  currentKey,
  label,
  sortKey,
  status,
  align = "start",
}: {
  currentDir: SortDir;
  currentKey: ConciergeSortKey;
  label: string;
  sortKey: ConciergeSortKey;
  status: EnterpriseConciergeRequestStatus | "all";
  align?: "start" | "end";
}) {
  const isActive = currentKey === sortKey;
  const nextDir = isActive && currentDir === "asc" ? "desc" : "asc";
  const alignClass = align === "end" ? "text-end" : "text-start";

  return (
    <TableHead
      className={alignClass}
      aria-sort={
        isActive ? (currentDir === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <Link
        href={conciergeHref({ status, sort: sortKey, dir: nextDir })}
        data-testid="admin-concierge-sort-header"
        className={`inline-flex items-center gap-1 transition-colors hover:text-foreground ${
          align === "end" ? "justify-end" : ""
        }`}
      >
        {label}
        {isActive ? (
          currentDir === "asc" ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          )
        ) : (
          <ArrowUpDown className="size-3 opacity-35" />
        )}
      </Link>
    </TableHead>
  );
}

function StatusFilterLinks({
  activeStatus,
  sortDir,
  sortKey,
  statusCounts,
}: {
  activeStatus: EnterpriseConciergeRequestStatus | "all";
  sortDir: SortDir;
  sortKey: ConciergeSortKey;
  statusCounts: Record<EnterpriseConciergeRequestStatus, number>;
}) {
  const filters = [
    {
      label: "All",
      status: "all" as const,
      count: requestStatuses.reduce((sum, status) => sum + statusCounts[status], 0),
    },
    ...requestStatuses.map((status) => ({
      label: requestStatusLabels[status],
      status,
      count: statusCounts[status],
    })),
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => {
        const active = activeStatus === filter.status;
        return (
          <Link
            key={filter.status}
            href={conciergeHref({
              status: filter.status,
              sort: sortKey,
              dir: sortDir,
            })}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              active
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-border bg-white text-muted-foreground hover:text-foreground"
            }`}
          >
            {filter.label} {filter.count}
          </Link>
        );
      })}
    </div>
  );
}

function MetricStrip({
  statusCounts,
  totalInvestmentCents,
}: {
  statusCounts: Record<EnterpriseConciergeRequestStatus, number>;
  totalInvestmentCents: number;
}) {
  const metrics = [
    { label: "Requested", value: statusCounts.requested },
    { label: "Reviewing", value: statusCounts.reviewing },
    { label: "Quoted", value: statusCounts.quoted },
    { label: "Open investment", value: formatCurrency(totalInvestmentCents) },
  ];

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="rounded-xl border border-border bg-white px-4 py-3 shadow-sm"
        >
          <p className="text-xs font-medium text-muted-foreground">
            {metric.label}
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {metric.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function ConciergeQuoteForm({ request }: { request: ConciergeRequest }) {
  return (
    <form
      action={quoteEnterpriseConciergeRequest}
      className="mt-3 grid gap-2 rounded-lg border border-border bg-white p-2"
    >
      <input type="hidden" name="request_id" value={request.id} />
      <label
        htmlFor={`quote-${request.id}`}
        className="text-xs font-medium text-muted-foreground"
      >
        PopsDrops quote
      </label>
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute inset-y-0 start-2 flex items-center text-xs font-semibold text-muted-foreground">
            $
          </span>
          <Input
            id={`quote-${request.id}`}
            name="quoted_service_fee_dollars"
            type="text"
            inputMode="numeric"
            pattern="[0-9,$ ]+"
            required
            defaultValue={
              request.quoted_service_fee_cents
                ? request.quoted_service_fee_cents / 100
                : ""
            }
            className="h-8 ps-5 text-sm font-semibold tabular-nums"
            placeholder="Fee"
          />
        </div>
        <Button type="submit" size="xs">
          Mark quoted
        </Button>
      </div>
      <Input
        name="quote_note"
        defaultValue={request.quote_note ?? ""}
        className="h-8 text-xs"
        placeholder="Optional note"
      />
    </form>
  );
}

async function assertAdmin() {
  const user = await getUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") notFound();
}

async function fetchConciergeQueue({
  statusFilter,
  sortDir,
  sortKey,
}: {
  statusFilter: EnterpriseConciergeRequestStatus | "all";
  sortDir: SortDir;
  sortKey: ConciergeSortKey;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("enterprise_concierge_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rawRequests = (data ?? []) as ConciergeRequestRow[];
  const brandIds = Array.from(
    new Set(rawRequests.map((request) => request.brand_id)),
  );

  const [brandProfilesResult, brandUsersResult] =
    brandIds.length > 0
      ? await Promise.all([
          admin
            .from("brand_profiles")
            .select("profile_id, company_name, contact_email")
            .in("profile_id", brandIds),
          admin
            .from("profiles")
            .select("id, full_name, email")
            .in("id", brandIds),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];

  if (brandProfilesResult.error) {
    throw new Error(brandProfilesResult.error.message);
  }
  if (brandUsersResult.error) {
    throw new Error(brandUsersResult.error.message);
  }

  const brandProfiles = new Map(
    ((brandProfilesResult.data ?? []) as BrandProfileRow[]).map((profile) => [
      profile.profile_id,
      profile,
    ]),
  );
  const brandUsers = new Map(
    ((brandUsersResult.data ?? []) as BrandUserRow[]).map((profile) => [
      profile.id,
      profile,
    ]),
  );

  const requests = rawRequests.map((request) => {
    const brandProfile = brandProfiles.get(request.brand_id);
    const brandUser = brandUsers.get(request.brand_id);
    const investmentCents =
      request.creator_budget_cents +
      request.product_value_cents +
      request.fulfillment_budget_cents;

    return {
      ...request,
      status: normalizeStatus(request.status),
      company_name:
        brandProfile?.company_name || brandUser?.full_name || "Unknown brand",
      brand_name: brandUser?.full_name || "Brand contact",
      brand_email:
        brandProfile?.contact_email || brandUser?.email || "No email",
      investment_cents: investmentCents,
    };
  });

  const statusCounts = Object.fromEntries(
    requestStatuses.map((status) => [
      status,
      requests.filter((request) => request.status === status).length,
    ]),
  ) as Record<EnterpriseConciergeRequestStatus, number>;

  const filteredRequests =
    statusFilter === "all"
      ? requests
      : requests.filter((request) => request.status === statusFilter);

  filteredRequests.sort((a, b) =>
    compareRequests(a, b, sortKey, sortDir),
  );

  const totalInvestmentCents = requests
    .filter((request) => request.status !== "closed")
    .reduce((sum, request) => sum + request.investment_cents, 0);

  return { filteredRequests, statusCounts, totalInvestmentCents };
}

export default async function AdminConciergePage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  await assertAdmin();
  const params = await searchParams;
  const statusFilter = parseStatusFilter(getSearchParam(params, "status"));
  const sortKey = parseConciergeSortKey(getSearchParam(params, "sort"));
  const sortDir = parseSortDir(getSearchParam(params, "dir"));
  const queue = await fetchConciergeQueue({ statusFilter, sortDir, sortKey });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Enterprise Concierge
          </h1>
          <p className="text-sm text-muted-foreground">
            Concierge requests that need scoped pricing before launch
          </p>
        </div>
      </div>

      <MetricStrip
        statusCounts={queue.statusCounts}
        totalInvestmentCents={queue.totalInvestmentCents}
      />

      <Card id="request-queue">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle>Request queue</CardTitle>
            <StatusFilterLinks
              activeStatus={statusFilter}
              sortDir={sortDir}
              sortKey={sortKey}
              statusCounts={queue.statusCounts}
            />
          </div>
        </CardHeader>
        <CardContent>
          {queue.filteredRequests.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <ConciergeSortableHead
                      label="Campaign"
                      sortKey="campaign_title"
                      currentKey={sortKey}
                      currentDir={sortDir}
                      status={statusFilter}
                    />
                    <ConciergeSortableHead
                      label="Brand"
                      sortKey="company_name"
                      currentKey={sortKey}
                      currentDir={sortDir}
                      status={statusFilter}
                    />
                    <ConciergeSortableHead
                      label="Scope"
                      sortKey="requested_creator_count"
                      currentKey={sortKey}
                      currentDir={sortDir}
                      status={statusFilter}
                    />
                    <ConciergeSortableHead
                      label="Investment"
                      sortKey="investment_cents"
                      currentKey={sortKey}
                      currentDir={sortDir}
                      status={statusFilter}
                      align="end"
                    />
                    <ConciergeSortableHead
                      label="Status"
                      sortKey="status"
                      currentKey={sortKey}
                      currentDir={sortDir}
                      status={statusFilter}
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queue.filteredRequests.map((request) => (
                    <TableRow key={request.id}>
                    <TableCell className="min-w-56 align-top">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {request.campaign_title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatList(request.platforms, getPlatformLabel)}
                        </p>
                        <p className="mt-1 text-xs font-medium text-slate-700">
                          {getConciergeRequestTypeLabel(request)}
                        </p>
                        {request.note && (
                          <p className="mt-2 line-clamp-2 max-w-md text-xs text-muted-foreground">
                            {request.note}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-40 align-top">
                      <p className="font-medium text-foreground">
                        {request.company_name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {request.brand_email}
                      </p>
                    </TableCell>
                    <TableCell className="min-w-36 align-top">
                      <p className="font-semibold text-foreground">
                        {request.requested_creator_count.toLocaleString("en-US")} creators
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {request.market_count.toLocaleString("en-US")} markets ·{" "}
                        {formatList(request.markets, getMarketLabel)}
                      </p>
                    </TableCell>
                    <TableCell className="text-end align-top">
                      <p className="font-mono font-semibold text-foreground">
                        {formatCurrency(request.investment_cents)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Creator, product, fulfillment
                      </p>
                    </TableCell>
                    <TableCell className="min-w-52 align-top">
                      <Badge
                        variant="outline"
                        className={`capitalize ${statusBadgeClass(request.status)}`}
                      >
                        {requestStatusLabels[request.status]}
                      </Badge>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {formatDate(request.created_at)}
                      </p>
                      {request.status === "quoted" &&
                        request.quoted_service_fee_cents !== null && (
                          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5">
                            <p className="text-xs font-semibold text-emerald-900">
                              {formatCurrency(request.quoted_service_fee_cents)}
                            </p>
                            {request.quote_note && (
                              <p className="mt-1 line-clamp-2 text-xs text-emerald-800">
                                {request.quote_note}
                              </p>
                            )}
                          </div>
                        )}
                      {request.status === "reviewing" && (
                        <ConciergeQuoteForm request={request} />
                      )}
                      <div className="mt-3 flex flex-col items-start gap-2">
                        {getStatusActions(request.status).map((action) => (
                          <form
                            key={action.status}
                            action={updateEnterpriseConciergeRequestStatus}
                          >
                            <input
                              type="hidden"
                              name="request_id"
                              value={request.id}
                            />
                            <input
                              type="hidden"
                              name="status"
                              value={action.status}
                            />
                            <Button
                              type="submit"
                              size="xs"
                              variant={action.variant}
                            >
                              {action.label}
                            </Button>
                          </form>
                        ))}
                      </div>
                    </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
              <BriefcaseBusiness className="mx-auto mb-3 size-7 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                No Enterprise Concierge requests
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Requests appear when brands ask PopsDrops to scope high-touch sourcing help.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
