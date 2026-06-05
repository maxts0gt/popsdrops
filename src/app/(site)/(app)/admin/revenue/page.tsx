import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  DollarSign,
  ReceiptText,
} from "lucide-react";
import { updateCampaignServiceFeeStatus } from "@/app/actions/admin";
import { getUser } from "@/app/actions/auth";
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
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { CampaignModeType, PaymentStatusType } from "@/types/database";

type RevenueCampaignRow = {
  id: string;
  title: string;
  brand: {
    full_name: string | null;
    email: string | null;
  } | null;
  campaign_mode: CampaignModeType;
  max_creators: number | null;
  service_fee_cents: number;
  service_fee_currency: string;
  service_fee_checkout_session_id: string | null;
  service_fee_last_event_at: string | null;
  service_fee_last_event_id: string | null;
  service_fee_last_event_type: string | null;
  service_fee_payment_intent_id: string | null;
  service_fee_status: PaymentStatusType;
  service_package_snapshot: Record<string, unknown> | null;
  created_at: string;
  latest_payment_event: RevenuePaymentEventRow | null;
  payment_events: RevenuePaymentEventRow[];
};

type RevenueCampaignQueryRow = Omit<
  RevenueCampaignRow,
  "brand" | "latest_payment_event" | "payment_events"
> & {
  brand: RevenueCampaignRow["brand"] | RevenueCampaignRow["brand"][];
};

type RevenuePaymentEventRow = {
  amount_cents: number | null;
  campaign_id: string;
  charge_id: string | null;
  checkout_session_id: string | null;
  currency: string | null;
  event_id: string;
  event_type: string;
  payment_intent_id: string | null;
  received_at: string;
  service_fee_status: PaymentStatusType | null;
};

type RevenuePaymentEventView = RevenuePaymentEventRow & {
  brandLabel: string;
  campaignTitle: string;
};

type RevenueSortKey =
  | "created_at"
  | "title"
  | "brand"
  | "campaign_mode"
  | "service_fee_status"
  | "service_fee_cents";
type SortDir = "asc" | "desc";
type SearchParams = Promise<
  Record<string, string | string[] | undefined> | undefined
>;

const paymentStatuses: PaymentStatusType[] = [
  "pending",
  "invoiced",
  "paid",
  "overdue",
  "failed",
  "refunded",
  "disputed",
];

const packageLabels: Record<CampaignModeType, string> = {
  private: "Private campaigns",
  sourced: "Enterprise Concierge",
};

const revenueSortLabels: Record<RevenueSortKey, string> = {
  created_at: "Created",
  title: "Campaign",
  brand: "Brand",
  campaign_mode: "Package",
  service_fee_status: "Status",
  service_fee_cents: "Fee",
};

function emptyMoneyBucket() {
  return { count: 0, cents: 0 };
}

function formatCurrency(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    currency: currency.toUpperCase(),
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

function formatDateTime(value: string | null) {
  if (!value) return "No event";
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function formatStatusLabel(status: string | null) {
  return status ? status[0].toUpperCase() + status.slice(1) : "Unknown";
}

function compactStripeId(value: string | null) {
  if (!value) return "No Stripe reference";
  if (value.length <= 24) return value;
  return `${value.slice(0, 12)}...${value.slice(-7)}`;
}

function getStripeReference(
  campaign: RevenueCampaignRow,
): { label: string; value: string | null } {
  const latest = campaign.latest_payment_event;

  if (campaign.service_fee_payment_intent_id || latest?.payment_intent_id) {
    return {
      label: "Payment intent",
      value: campaign.service_fee_payment_intent_id ?? latest?.payment_intent_id ?? null,
    };
  }
  if (campaign.service_fee_checkout_session_id || latest?.checkout_session_id) {
    return {
      label: "Checkout session",
      value:
        campaign.service_fee_checkout_session_id ??
        latest?.checkout_session_id ??
        null,
    };
  }

  return {
    label: "Last event",
    value: campaign.service_fee_last_event_id ?? latest?.event_id ?? null,
  };
}

function getSnapshotNumber(
  snapshot: Record<string, unknown> | null,
  key: string,
  fallback: number | null = null,
) {
  const value = snapshot?.[key];
  return Number.isFinite(value) ? Number(value) : fallback;
}

function getRevenueCampaignScope(campaign: RevenueCampaignRow) {
  const snapshot = campaign.service_package_snapshot;

  return {
    activeDays: getSnapshotNumber(snapshot, "estimatedActiveDays"),
    creatorCapacity: getSnapshotNumber(
      snapshot,
      "estimatedMaxCreators",
      campaign.max_creators,
    ),
    reportingDays: getSnapshotNumber(snapshot, "estimatedReportingDays"),
  };
}

function getRevenueServiceFeePaidCents(campaign: RevenueCampaignRow) {
  const paidFromEvents = campaign.payment_events.reduce((sum, event) => {
    if (event.service_fee_status !== "paid") return sum;
    return sum + (event.amount_cents ?? 0);
  }, 0);

  if (paidFromEvents > 0) return paidFromEvents;
  if (campaign.service_fee_status === "paid") return campaign.service_fee_cents ?? 0;

  return getSnapshotNumber(campaign.service_package_snapshot, "paidCents", 0) ?? 0;
}

function getRevenueServiceFeeMoney(campaign: RevenueCampaignRow) {
  const totalCents = campaign.service_fee_cents ?? 0;
  const paidCents = Math.min(totalCents, getRevenueServiceFeePaidCents(campaign));
  const snapshotBalanceDueCents = getSnapshotNumber(
    campaign.service_package_snapshot,
    "balanceDueCents",
  );
  const balanceDueCents = Math.max(
    0,
    snapshotBalanceDueCents ??
      (campaign.service_fee_status === "paid" ? 0 : totalCents - paidCents),
  );

  return {
    "totalCents": totalCents,
    "paidCents": paidCents,
    "balanceDueCents": balanceDueCents,
  };
}

function barWidth(value: number, max: number) {
  if (value <= 0 || max <= 0) return "0%";
  return `${Math.max(8, Math.round((value / max) * 100))}%`;
}

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

function parseRevenueSortKey(value: string | undefined): RevenueSortKey {
  return value && value in revenueSortLabels
    ? (value as RevenueSortKey)
    : "created_at";
}

function parsePaymentStatusFilter(
  value: string | undefined,
): PaymentStatusType | "all" {
  return value && paymentStatuses.includes(value as PaymentStatusType)
    ? (value as PaymentStatusType)
    : "all";
}

function compareText(a: string, b: string) {
  return a.localeCompare(b, "en-US", { numeric: true, sensitivity: "base" });
}

function compareCampaigns(
  a: RevenueCampaignRow,
  b: RevenueCampaignRow,
  sortKey: RevenueSortKey,
  sortDir: SortDir,
) {
  const direction = sortDir === "asc" ? 1 : -1;

  if (sortKey === "created_at") {
    return (
      (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) *
      direction
    );
  }
  if (sortKey === "service_fee_cents") {
    return (a.service_fee_cents - b.service_fee_cents) * direction;
  }
  if (sortKey === "brand") {
    return (
      compareText(
        a.brand?.full_name ?? a.brand?.email ?? "",
        b.brand?.full_name ?? b.brand?.email ?? "",
      ) * direction
    );
  }
  return compareText(String(a[sortKey]), String(b[sortKey])) * direction;
}

function normalizeRevenueBrand(
  brand: RevenueCampaignQueryRow["brand"],
): RevenueCampaignRow["brand"] {
  return Array.isArray(brand) ? brand[0] ?? null : brand;
}

function revenueHref({
  campaignId,
  status,
  sort,
  dir,
}: {
  campaignId?: string | null;
  status: PaymentStatusType | "all";
  sort: RevenueSortKey;
  dir: SortDir;
}) {
  const params = new URLSearchParams();
  if (campaignId) params.set("campaign", campaignId);
  if (status !== "all") params.set("status", status);
  params.set("sort", sort);
  params.set("dir", dir);
  return `/admin/revenue?${params.toString()}#service-fees`;
}

function getRevenueServiceFeeNextAction(status: PaymentStatusType) {
  if (status === "failed" || status === "overdue") {
    return {
      detail: "Ask the brand to pay again before launch.",
      label: "Retry checkout",
    };
  }
  if (status === "refunded") {
    return {
      detail: "Confirm the reason, then ask the brand to pay again.",
      label: "Confirm refund",
    };
  }
  if (status === "disputed") {
    return {
      detail: "Resolve the Stripe case before unlocking the campaign.",
      label: "Review Stripe dispute",
    };
  }
  if (status === "paid") {
    return {
      detail: "Fee is cleared.",
      label: "No finance action",
    };
  }
  if (status === "invoiced") {
    return {
      detail: "Checkout is open with the brand.",
      label: "Watch checkout",
    };
  }

  return {
    detail: "Payment is required before launch.",
    label: "Send checkout",
  };
}

function RevenueSortableHead({
  label,
  sortKey,
  currentKey,
  currentDir,
  status,
  focusedCampaignId,
  align = "start",
}: {
  label: string;
  sortKey: RevenueSortKey;
  currentKey: RevenueSortKey;
  currentDir: SortDir;
  status: PaymentStatusType | "all";
  focusedCampaignId?: string | null;
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
        href={revenueHref({
          campaignId: focusedCampaignId,
          status,
          sort: sortKey,
          dir: nextDir,
        })}
        data-testid="admin-revenue-sort-header"
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

async function fetchRevenueMetrics({
  statusFilter,
  sortDir,
  sortKey,
}: {
  statusFilter: PaymentStatusType | "all";
  sortDir: SortDir;
  sortKey: RevenueSortKey;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("campaigns")
    .select(
      "id,title,campaign_mode,max_creators,service_fee_cents,service_fee_currency,service_fee_checkout_session_id,service_fee_last_event_at,service_fee_last_event_id,service_fee_last_event_type,service_fee_payment_intent_id,service_fee_status,service_package_snapshot,created_at,brand:profiles!campaigns_brand_id_fkey(full_name,email)",
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const campaignRows = ((data ?? []) as RevenueCampaignQueryRow[]).map(
    (row) => ({
      ...row,
      brand: normalizeRevenueBrand(row.brand),
      latest_payment_event: null,
      payment_events: [],
    }),
  );
  const campaignIds = campaignRows.map((campaign) => campaign.id);
  const { data: eventData, error: eventError } =
    campaignIds.length > 0
      ? await admin
          .from("campaign_payment_events")
          .select(
            "campaign_id,charge_id,checkout_session_id,event_id,event_type,payment_intent_id,received_at,service_fee_status,amount_cents,currency",
          )
          .in("campaign_id", campaignIds)
          .order("received_at", { ascending: false })
          .limit(24)
      : { data: [], error: null };

  if (eventError) throw new Error(eventError.message);

  const paymentEvents = (eventData ?? []) as RevenuePaymentEventRow[];
  const latestPaymentEventByCampaign = new Map<string, RevenuePaymentEventRow>();
  const paymentEventsByCampaign = new Map<string, RevenuePaymentEventRow[]>();

  for (const event of paymentEvents) {
    const campaignEvents = paymentEventsByCampaign.get(event.campaign_id) ?? [];
    campaignEvents.push(event);
    paymentEventsByCampaign.set(event.campaign_id, campaignEvents);

    if (!latestPaymentEventByCampaign.has(event.campaign_id)) {
      latestPaymentEventByCampaign.set(event.campaign_id, event);
    }
  }

  const campaigns = campaignRows.map((campaign) => ({
    ...campaign,
    latest_payment_event:
      latestPaymentEventByCampaign.get(campaign.id) ?? null,
    payment_events: paymentEventsByCampaign.get(campaign.id) ?? [],
  }));
  const campaignLabelById = new Map(
    campaigns.map((campaign) => [
      campaign.id,
      {
        brandLabel: campaign.brand?.full_name ?? campaign.brand?.email ?? "Unknown brand",
        campaignTitle: campaign.title,
      },
    ]),
  );
  const currency = campaigns[0]?.service_fee_currency ?? "usd";
  const statusTotals = Object.fromEntries(
    paymentStatuses.map((status) => [status, emptyMoneyBucket()]),
  ) as Record<PaymentStatusType, ReturnType<typeof emptyMoneyBucket>>;
  const packageTotals = {
    private: emptyMoneyBucket(),
    sourced: emptyMoneyBucket(),
  } satisfies Record<CampaignModeType, ReturnType<typeof emptyMoneyBucket>>;

  for (const campaign of campaigns) {
    const cents = campaign.service_fee_cents ?? 0;
    statusTotals[campaign.service_fee_status].count += 1;
    statusTotals[campaign.service_fee_status].cents += cents;
    packageTotals[campaign.campaign_mode].count += 1;
    packageTotals[campaign.campaign_mode].cents += cents;
  }

  const bookedCents = campaigns.reduce(
    (sum, campaign) => sum + (campaign.service_fee_cents ?? 0),
    0,
  );
  const paidCents = campaigns.reduce(
    (sum, campaign) => sum + getRevenueServiceFeeMoney(campaign).paidCents,
    0,
  );
  const openCents = campaigns.reduce(
    (sum, campaign) =>
      sum + getRevenueServiceFeeMoney(campaign).balanceDueCents,
    0,
  );
  const overdueCents = campaigns
    .filter((campaign) => campaign.service_fee_status === "overdue")
    .reduce(
      (sum, campaign) =>
        sum + getRevenueServiceFeeMoney(campaign).balanceDueCents,
      0,
    );

  const filteredCampaigns = campaigns
    .filter(
      (campaign) =>
        statusFilter === "all" ||
        campaign.service_fee_status === statusFilter,
    )
    .sort((a, b) => compareCampaigns(a, b, sortKey, sortDir));

  return {
    bookedCents,
    currency,
    filteredCampaigns,
    openCents,
    overdueCents,
    packageTotals,
    paidCents,
    recentCampaigns: campaigns.slice(0, 6),
    recentPaymentEvents: paymentEvents.slice(0, 8).map((event) => ({
      ...event,
      brandLabel:
        campaignLabelById.get(event.campaign_id)?.brandLabel ?? "Unknown brand",
      campaignTitle:
        campaignLabelById.get(event.campaign_id)?.campaignTitle ??
        "Unknown campaign",
    })) satisfies RevenuePaymentEventView[],
    statusTotals,
    totalCampaigns: campaigns.length,
  };
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <DollarSign className="size-4 text-muted-foreground" />
        </div>
        <div>
          <p className="text-2xl font-semibold tabular-nums text-foreground">
            {value}
          </p>
          <p className="text-xs text-muted-foreground">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function RevenueBarList({
  rows,
  currency,
}: {
  rows: Array<{ label: string; count: number; cents: number }>;
  currency: string;
}) {
  const max = Math.max(...rows.map((row) => row.cents), 0);

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div key={row.label} className="space-y-2">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">
                {row.label}
              </p>
              <p className="text-xs text-muted-foreground">
                {row.count} campaign{row.count === 1 ? "" : "s"}
              </p>
            </div>
            <span className="font-mono text-sm font-semibold text-foreground">
              {formatCurrency(row.cents, currency)}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-slate-900"
              style={{ width: barWidth(row.cents, max) }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusFilterLinks({
  activeStatus,
  focusedCampaignId,
  sortDir,
  sortKey,
  statusTotals,
}: {
  activeStatus: PaymentStatusType | "all";
  focusedCampaignId?: string | null;
  sortDir: SortDir;
  sortKey: RevenueSortKey;
  statusTotals: Record<
    PaymentStatusType,
    ReturnType<typeof emptyMoneyBucket>
  >;
}) {
  const filters: Array<{
    label: string;
    status: PaymentStatusType | "all";
    count: number;
  }> = [
    {
      label: "All",
      status: "all",
      count: paymentStatuses.reduce(
        (sum, status) => sum + statusTotals[status].count,
        0,
      ),
    },
    ...paymentStatuses.map((status) => ({
      label: status[0].toUpperCase() + status.slice(1),
      status,
      count: statusTotals[status].count,
    })),
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => {
        const active = activeStatus === filter.status;
        return (
          <Link
            key={filter.status}
            href={revenueHref({
              campaignId: focusedCampaignId,
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

function ServiceFeeNextActionBlock({
  serviceFeeNextAction,
}: {
  serviceFeeNextAction: ReturnType<typeof getRevenueServiceFeeNextAction>;
}) {
  return (
    <div
      data-testid="admin-revenue-service-fee-next-action"
      data-service-fee-next-action={serviceFeeNextAction.label}
      className="max-w-52"
    >
      <p className="text-xs font-semibold text-foreground">
        {serviceFeeNextAction.label}
      </p>
      <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
        {serviceFeeNextAction.detail}
      </p>
    </div>
  );
}

function ServiceFeeScopeBlock({ campaign }: { campaign: RevenueCampaignRow }) {
  const scope = getRevenueCampaignScope(campaign);

  return (
    <div data-testid="admin-revenue-service-fee-scope" className="min-w-0">
      <p className="text-xs font-medium text-muted-foreground">
        Creator capacity
      </p>
      <p className="mt-1 font-mono text-sm font-semibold text-foreground">
        {scope.creatorCapacity ?? "Custom"}
      </p>
      <p className="mt-1 truncate text-[11px] text-muted-foreground">
        {scope.activeDays ?? "-"} active days / {scope.reportingDays ?? "-"} reporting days
      </p>
    </div>
  );
}

function ServiceFeeMoneyBlock({
  align = "start",
  campaign,
}: {
  align?: "start" | "end";
  campaign: RevenueCampaignRow;
}) {
  const money = getRevenueServiceFeeMoney(campaign);
  const alignClass = align === "end" ? "text-end" : "text-start";
  const hasPaidCredit = money.paidCents > 0 && money.balanceDueCents > 0;

  return (
    <div
      data-testid="admin-revenue-service-fee-money"
      className={alignClass}
    >
      <p className="font-mono font-semibold text-foreground">
        {formatCurrency(money.totalCents, campaign.service_fee_currency)}
      </p>
      {hasPaidCredit && (
        <p
          data-testid="admin-revenue-service-fee-paid-credit"
          className="mt-0.5 text-[11px] text-muted-foreground"
        >
          Paid credit {formatCurrency(money.paidCents, campaign.service_fee_currency)}
        </p>
      )}
      {money.balanceDueCents > 0 && (
        <p
          data-testid="admin-revenue-service-fee-balance"
          className="mt-0.5 text-[11px] font-medium text-amber-800"
        >
          Balance due {formatCurrency(money.balanceDueCents, campaign.service_fee_currency)}
        </p>
      )}
    </div>
  );
}

function ServiceFeeUpdateForm({
  campaign,
  className,
  idSuffix,
}: {
  campaign: RevenueCampaignRow;
  className: string;
  idSuffix: string;
}) {
  const statusId = `status-${campaign.id}-${idSuffix}`;
  const noteId = `note-${campaign.id}-${idSuffix}`;

  return (
    <form
      action={updateCampaignServiceFeeStatus}
      data-testid="admin-revenue-service-fee-update-form"
      className={className}
    >
      <input type="hidden" name="campaign_id" value={campaign.id} />
      <label className="sr-only" htmlFor={statusId}>
        Payment status
      </label>
      <select
        id={statusId}
        name="service_fee_status"
        data-testid="admin-revenue-service-fee-status-select"
        defaultValue={campaign.service_fee_status}
        className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm capitalize text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {paymentStatuses.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor={noteId}>
        Payment note
      </label>
      <Input
        id={noteId}
        name="note"
        data-testid="admin-revenue-service-fee-note-input"
        minLength={3}
        maxLength={500}
        placeholder="Reason"
        className="h-8 min-w-0"
        required
      />
      <Button
        size="sm"
        variant="outline"
        type="submit"
        data-testid="admin-revenue-service-fee-update-action"
        aria-label="Apply status"
        className="h-8 px-3"
      >
        Apply
      </Button>
    </form>
  );
}

function ServiceFeeCompactCard({
  campaign,
  focusedCampaignId,
}: {
  campaign: RevenueCampaignRow;
  focusedCampaignId: string | null;
}) {
  const stripeReference = getStripeReference(campaign);
  const latestEventId =
    campaign.service_fee_last_event_id ??
    campaign.latest_payment_event?.event_id ??
    null;
  const serviceFeeNextAction = getRevenueServiceFeeNextAction(
    campaign.service_fee_status,
  );
  const focused = campaign.id === focusedCampaignId;

  return (
    <article
      id={`service-fee-card-${campaign.id}`}
      data-campaign-id={campaign.id}
      data-service-fee-status={campaign.service_fee_status}
      data-stripe-reference={stripeReference.value ?? undefined}
      data-testid="admin-revenue-service-fee-card"
      className={`rounded-xl border p-4 ${
        focused ? "border-red-200 bg-red-50/60" : "border-border bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">
            {campaign.title}
          </p>
          <Link
            href={`/admin/campaigns/${campaign.id}?focus=finance#admin-finance-exception`}
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Open campaign
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
        <span className="shrink-0 rounded-full border border-border px-2.5 py-1 text-xs font-medium capitalize text-muted-foreground">
          {campaign.service_fee_status}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Brand</p>
          <p className="mt-1 truncate font-medium text-foreground">
            {campaign.brand?.full_name ?? "Unknown brand"}
          </p>
          {campaign.brand?.email && (
            <p className="truncate text-xs text-muted-foreground">
              {campaign.brand.email}
            </p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Package</p>
          <p className="mt-1 capitalize text-foreground">
            {campaign.campaign_mode}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Fee</p>
          <div className="mt-1">
            <ServiceFeeMoneyBlock campaign={campaign} />
          </div>
        </div>
        <ServiceFeeScopeBlock campaign={campaign} />
        <div>
          <p className="text-xs font-medium text-muted-foreground">Created</p>
          <p className="mt-1 text-foreground">{formatDate(campaign.created_at)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 border-t border-border/70 pt-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <ServiceFeeNextActionBlock serviceFeeNextAction={serviceFeeNextAction} />
        <div data-testid="admin-revenue-stripe-reference" className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">
            {stripeReference.label}
          </p>
          <p
            className="mt-1 truncate font-mono text-xs text-foreground"
            title={stripeReference.value ?? undefined}
          >
            {compactStripeId(stripeReference.value)}
          </p>
          <p
            className="mt-1 truncate text-[11px] text-muted-foreground"
            title={latestEventId ?? undefined}
          >
            Last event {compactStripeId(latestEventId)}
          </p>
        </div>
      </div>

      <div className="mt-4 border-t border-border/70 pt-4">
        <ServiceFeeUpdateForm
          campaign={campaign}
          idSuffix="compact"
          className="grid gap-2 sm:grid-cols-[6.5rem_minmax(8rem,1fr)_auto]"
        />
      </div>
    </article>
  );
}

export default async function AdminRevenuePage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  await assertAdmin();
  const params = await searchParams;
  const focusedCampaignId = getSearchParam(params, "campaign") ?? null;
  const statusFilter = parsePaymentStatusFilter(getSearchParam(params, "status"));
  const sortKey = parseRevenueSortKey(getSearchParam(params, "sort"));
  const sortDir = parseSortDir(getSearchParam(params, "dir"));
  const revenue = await fetchRevenueMetrics({
    statusFilter,
    sortDir,
    sortKey,
  });
  const packageRows = (Object.keys(packageLabels) as CampaignModeType[]).map(
    (mode) => ({
      label: packageLabels[mode],
      ...revenue.packageTotals[mode],
    }),
  );
  const statusRows = paymentStatuses.map((status) => ({
    label: status[0].toUpperCase() + status.slice(1),
    ...revenue.statusTotals[status],
  }));
  const focusedCampaign =
    focusedCampaignId !== null
      ? revenue.filteredCampaigns.find(
          (campaign) => campaign.id === focusedCampaignId,
        )
      : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Revenue</h1>
        <p className="text-sm text-muted-foreground">
          Campaign service fee tracking and collection status
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="Booked service fees"
          value={formatCurrency(revenue.bookedCents, revenue.currency)}
          detail={`${revenue.totalCampaigns} campaigns`}
        />
        <MetricCard
          label="Paid"
          value={formatCurrency(revenue.paidCents, revenue.currency)}
          detail={`${revenue.statusTotals.paid.count} collected`}
        />
        <MetricCard
          label="Open"
          value={formatCurrency(revenue.openCents, revenue.currency)}
          detail="Pending, invoiced, or overdue"
        />
        <MetricCard
          label="Overdue"
          value={formatCurrency(revenue.overdueCents, revenue.currency)}
          detail={`${revenue.statusTotals.overdue.count} needs action`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Revenue by package</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueBarList rows={packageRows} currency={revenue.currency} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment status</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueBarList rows={statusRows} currency={revenue.currency} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent Stripe events</CardTitle>
        </CardHeader>
        <CardContent>
          {revenue.recentPaymentEvents.length > 0 ? (
            <div className="divide-y divide-border/70">
              {revenue.recentPaymentEvents.map((event) => (
                <div
                  key={`${event.event_id}-${event.campaign_id}`}
                  data-testid="admin-revenue-payment-event"
                  className="grid gap-3 py-3 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(9rem,0.5fr)] md:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {event.campaignTitle}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {event.brandLabel}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-muted-foreground">
                      {event.event_type}
                    </p>
                    <p className="truncate font-mono text-xs text-foreground">
                      {compactStripeId(event.event_id)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 md:block md:text-end">
                    <span className="rounded-full border border-border px-2.5 py-1 text-xs font-medium capitalize text-muted-foreground">
                      {formatStatusLabel(event.service_fee_status)}
                    </span>
                    <p className="text-xs text-muted-foreground md:mt-1">
                      {formatDateTime(event.received_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center">
              <ReceiptText className="mx-auto mb-3 size-6 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                No Stripe events yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Checkout and webhook events appear here after a brand starts payment.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6" id="service-fees">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle>Service fee operations</CardTitle>
            <StatusFilterLinks
              activeStatus={statusFilter}
              focusedCampaignId={focusedCampaignId}
              sortDir={sortDir}
              sortKey={sortKey}
              statusTotals={revenue.statusTotals}
            />
          </div>
        </CardHeader>
        <CardContent>
          {focusedCampaign && (
            <div
              data-testid="admin-revenue-focused-campaign"
              className="mb-4 rounded-lg border border-red-200 bg-red-50/60 px-3 py-2"
            >
              <p className="text-sm font-semibold text-foreground">
                Focused service fee
              </p>
              <p className="text-xs text-muted-foreground">
                {focusedCampaign.title} is filtered and highlighted below.
              </p>
            </div>
          )}
          {revenue.filteredCampaigns.length > 0 ? (
            <>
              <div
                data-testid="admin-revenue-service-fee-cards"
                className="grid gap-3 xl:hidden"
              >
                {revenue.filteredCampaigns.map((campaign) => (
                  <ServiceFeeCompactCard
                    key={campaign.id}
                    campaign={campaign}
                    focusedCampaignId={focusedCampaignId}
                  />
                ))}
              </div>
              <div className="hidden xl:block">
                <Table className="min-w-[78rem]">
                  <TableHeader>
                    <TableRow>
                      <RevenueSortableHead
                        label="Campaign"
                        sortKey="title"
                        currentKey={sortKey}
                        currentDir={sortDir}
                        focusedCampaignId={focusedCampaignId}
                        status={statusFilter}
                      />
                      <RevenueSortableHead
                        label="Brand"
                        sortKey="brand"
                        currentKey={sortKey}
                        currentDir={sortDir}
                        focusedCampaignId={focusedCampaignId}
                        status={statusFilter}
                      />
                      <RevenueSortableHead
                        label="Package"
                        sortKey="campaign_mode"
                        currentKey={sortKey}
                        currentDir={sortDir}
                        focusedCampaignId={focusedCampaignId}
                        status={statusFilter}
                      />
                      <RevenueSortableHead
                        label="Status"
                        sortKey="service_fee_status"
                        currentKey={sortKey}
                        currentDir={sortDir}
                        focusedCampaignId={focusedCampaignId}
                        status={statusFilter}
                      />
                      <RevenueSortableHead
                        label="Fee"
                        sortKey="service_fee_cents"
                        currentKey={sortKey}
                        currentDir={sortDir}
                        focusedCampaignId={focusedCampaignId}
                        status={statusFilter}
                        align="end"
                      />
                      <TableHead className="text-start">Scope</TableHead>
                      <TableHead className="text-start">Stripe reference</TableHead>
                      <RevenueSortableHead
                        label="Created"
                        sortKey="created_at"
                        currentKey={sortKey}
                        currentDir={sortDir}
                        focusedCampaignId={focusedCampaignId}
                        status={statusFilter}
                      />
                      <TableHead className="min-w-[18rem] text-start">
                        Update
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revenue.filteredCampaigns.map((campaign) => {
                      const stripeReference = getStripeReference(campaign);
                      const latestEventId =
                        campaign.service_fee_last_event_id ??
                        campaign.latest_payment_event?.event_id ??
                        null;
                      const serviceFeeNextAction =
                        getRevenueServiceFeeNextAction(
                          campaign.service_fee_status,
                        );

                      return (
                        <TableRow
                          key={campaign.id}
                          id={`service-fee-${campaign.id}`}
                          data-service-fee-status={campaign.service_fee_status}
                          data-stripe-reference={
                            stripeReference.value ?? undefined
                          }
                          data-testid="admin-revenue-service-fee-row"
                          className={
                            campaign.id === focusedCampaignId
                              ? "bg-red-50/60"
                              : undefined
                          }
                        >
                          <TableCell className="w-60 max-w-60">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">
                                {campaign.title}
                              </p>
                              <Link
                                href={`/admin/campaigns/${campaign.id}?focus=finance#admin-finance-exception`}
                                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                              >
                                Open campaign
                                <ArrowUpRight className="size-3.5" />
                              </Link>
                            </div>
                          </TableCell>
                          <TableCell className="w-48 max-w-48">
                            <p className="font-medium text-foreground">
                              {campaign.brand?.full_name ?? "Unknown brand"}
                            </p>
                            {campaign.brand?.email && (
                              <p className="text-xs text-muted-foreground">
                                {campaign.brand?.email}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="capitalize text-muted-foreground">
                            {campaign.campaign_mode}
                          </TableCell>
                          <TableCell>
                            <ServiceFeeNextActionBlock
                              serviceFeeNextAction={serviceFeeNextAction}
                            />
                          </TableCell>
                          <TableCell>
                            <ServiceFeeMoneyBlock
                              campaign={campaign}
                              align="end"
                            />
                          </TableCell>
                          <TableCell className="max-w-40">
                            <ServiceFeeScopeBlock campaign={campaign} />
                          </TableCell>
                          <TableCell
                            data-testid="admin-revenue-stripe-reference"
                            className="max-w-52"
                          >
                            <p className="text-xs font-medium text-muted-foreground">
                              {stripeReference.label}
                            </p>
                            <p
                              className="truncate font-mono text-xs text-foreground"
                              title={stripeReference.value ?? undefined}
                            >
                              {compactStripeId(stripeReference.value)}
                            </p>
                            <p
                              className="mt-1 truncate text-[11px] text-muted-foreground"
                              title={latestEventId ?? undefined}
                            >
                              Last event {compactStripeId(latestEventId)}
                            </p>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(campaign.created_at)}
                          </TableCell>
                          <TableCell>
                            <ServiceFeeUpdateForm
                              campaign={campaign}
                              idSuffix="table"
                              className="grid min-w-[18rem] grid-cols-[6.5rem_minmax(6.5rem,1fr)_auto] gap-2"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
              <ReceiptText className="mx-auto mb-3 size-7 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                No service fees yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Campaign fees appear after brands create private campaign workspaces or accepted Concierge quotes.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
