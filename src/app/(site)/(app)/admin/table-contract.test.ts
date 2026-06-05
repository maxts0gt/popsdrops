import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("admin table contract", () => {
  it("keeps admin campaign data columns sortable with accessible sort state", () => {
    const source = read("./campaigns/page.tsx");

    expect(source).toContain('type CampaignSortKey =');
    expect(source).toContain('| "service_fee_status"');
    expect(source).toContain('| "service_fee_cents"');
    expect(source).toContain("aria-sort=");
    expect(source).toContain('data-testid="admin-campaigns-sort-header"');
    expect(source).toContain('<CampaignSortableHead label="Creators" sortKey="member_count"');
  });

  it("keeps service fee state visible on the admin campaign scan view", () => {
    const source = read("./campaigns/page.tsx");

    expect(source).toContain("service_fee_cents");
    expect(source).toContain("service_fee_currency");
    expect(source).toContain("service_fee_status");
    expect(source).toContain("function serviceFeeTone");
    expect(source).toContain("serviceFeeLabel,");
    expect(source).toContain('<CampaignSortableHead label="Service fee" sortKey="service_fee_status"');
    expect(source).toContain('data-testid="admin-campaigns-service-fee-status"');
    expect(source).toContain('"Service fee"');
    expect(source).toContain('"Fee status"');
  });

  it("turns admin campaign oversight into an exception queue before the full table", () => {
    const source = read("./campaigns/page.tsx");

    expect(source).toContain("type AttentionFilter = \"all\" | CampaignAttentionKind;");
    expect(source).toContain("type CampaignAttentionKind");
    expect(source).toContain(".from(\"campaign_report_tasks\")");
    expect(source).toContain(".from(\"campaign_creator_invites\")");
    expect(source).toContain(".from(\"campaign_payment_events\")");
    expect(source).toContain("getAdminCampaignAttentionItems");
    expect(source).toContain('{ key: "operations", label: "Operations" }');
    expect(source).not.toContain('label: "Payment required"');
    expect(source).not.toContain("Service fee must clear before the invite link can be used.");
    expect(source).toContain('data-testid="admin-campaign-attention-panel"');
    expect(source).toContain('data-testid="admin-campaign-attention-filter"');
    expect(source).toContain('data-testid="admin-campaign-attention-row"');
    expect(source).toContain("{item.actionLabel}");
    expect(source).toContain("href={item.href}");
  });

  it("keeps admin user data columns sortable and avoids an em dash fallback", () => {
    const source = read("./users/page.tsx");

    expect(source).toContain(
      'type SortKey = "full_name" | "email" | "role" | "status" | "primary_market" | "created_at";',
    );
    expect(source).toContain("aria-sort=");
    expect(source).toContain('data-testid="admin-users-sort-header"');
    expect(source).toContain('<SortableHead label="Market" sortKey="primary_market"');
    expect(source).not.toContain("\\u2014");
  });

  it("keeps raw admin tables sortable instead of static header-only tables", () => {
    const audit = read("./audit/page.tsx");
    const analytics = read("./analytics/page.tsx");
    const communications = read("./communications/page.tsx");
    const concierge = read("./concierge/page.tsx");
    const revenue = read("./revenue/page.tsx");
    const settings = read("./settings/page.tsx");

    expect(audit).toContain("function AuditSortableHead");
    expect(audit).toContain('data-testid="admin-audit-sort-header"');
    expect(audit).toContain("{sortedEntries.map((entry) => {");

    expect(analytics).toContain("function MarketSortableHead");
    expect(analytics).toContain('data-testid="admin-market-sort-header"');
    expect(analytics).toContain("{sortedMarkets.map((m) => (");

    expect(communications).toContain("function TemplateSortableHead");
    expect(communications).toContain('data-testid="admin-template-sort-header"');
    expect(communications).toContain("{sortedTemplates.map((t) => (");

    expect(concierge).toContain("function ConciergeSortableHead");
    expect(concierge).toContain('data-testid="admin-concierge-sort-header"');
    expect(concierge).toContain("{queue.filteredRequests.map((request) => (");

    expect(revenue).toContain("function RevenueSortableHead");
    expect(revenue).toContain('data-testid="admin-revenue-sort-header"');
    expect(revenue).toContain("{revenue.filteredCampaigns.map((campaign) => {");

    expect(settings).toContain("function CalendarSortableHead");
    expect(settings).toContain('data-testid="admin-calendar-sort-header"');
    expect(settings).toContain("{sortedCalendarEvents.map((event) => {");
  });

  it("exposes Enterprise Concierge requests in admin navigation and action audit", () => {
    const layout = read("./layout.tsx");
    const adminActions = read("../../../actions/admin.ts");
    const concierge = read("./concierge/page.tsx");

    expect(layout).toContain('href: "/admin/concierge"');
    expect(layout).toContain('label: "Concierge"');
    expect(concierge).toContain("function getConciergeRequestTypeLabel");
    expect(concierge).toContain('request.campaign_mode === "private"');
    expect(concierge).toContain("Private capacity review");
    expect(concierge).toContain("Concierge sourcing");
    expect(adminActions).toContain("updateEnterpriseConciergeRequestStatus");
    expect(adminActions).toContain("quoteEnterpriseConciergeRequest");
    expect(adminActions).toContain("update_enterprise_concierge_request_status");
    expect(adminActions).toContain("quote_enterprise_concierge_request");
    expect(adminActions).toContain('target_type: "enterprise_concierge_request"');
    expect(adminActions).toContain("quoted_service_fee_cents");
    expect(adminActions).toContain("quote_note");
  });
});
