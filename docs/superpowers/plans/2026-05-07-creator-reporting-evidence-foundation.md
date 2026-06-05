# Creator Reporting Evidence Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working creator reporting evidence foundation: seven reporting templates, campaign-defined evidence requirements, eligibility preview data, sparse metric values, AI extraction confirmation scaffolding, and report source labels.

**Architecture:** Keep the existing reporting spine (`campaign_reporting_plans`, `campaign_report_tasks`, `content_performance`, `content_performance_evidence`) and add a platform-template layer on top. Product platform support remains TikTok, Instagram, Snapchat, YouTube, and Facebook, while reporting templates add X and Generic without turning them into OAuth/profile platforms. AI extraction records are stored separately and never become report truth until creator confirmation writes metric values.

**Tech Stack:** Next.js App Router, Server Actions, Supabase Postgres with RLS, Supabase Storage metadata, TypeScript, Zod, Vitest, Tailwind, shadcn/ui.

---

## Scope

This plan implements the foundation slice from [creator reporting evidence templates design](/Users/swiftpanda/Developer/popsdrops/docs/superpowers/specs/2026-05-07-creator-reporting-evidence-templates-design.md).

Included:

- Seven reporting platform templates: Instagram, TikTok, YouTube, Facebook, Snapchat, X, Generic.
- Database tables for metric definitions, campaign reporting requirements, sparse metric values, and AI extraction attempts.
- RLS tests for cross-brand and cross-creator boundaries.
- Campaign action support for saving reporting requirements.
- Eligibility helper and public apply API payload.
- Report task generator support for `per_post`.
- Performance submission support for sparse metric values.
- Creator confirmation action for seeded AI extraction records.
- Report aggregation support for metric values and source labels.

Deferred to a later plan:

- Live Gemini API call and queue orchestration.
- Rich chart redesign around sparse metric values.
- Full binary file upload UI for evidence. This plan keeps current evidence metadata compatible with private bucket upload, while the visible creator form can still accept the existing screenshot URL until the upload UI is built.
- PPT/PDF report redesign around source labels.

## Existing Context

Important existing files:

- `/Users/swiftpanda/Developer/popsdrops/DESIGN.md`: Canonical design guide. Must remain the quality bar for Hermes, Chanel, Lisa from BLACKPINK, and Lionel Messi level campaigns.
- `/Users/swiftpanda/Developer/popsdrops/src/lib/platform-metrics.ts`: Current five-platform metric config used by `PerformanceForm`.
- `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/task-schedule.ts`: Generates final, weekly, daily, and custom report tasks.
- `/Users/swiftpanda/Developer/popsdrops/src/lib/supabase/privileged.ts`: Creates report tasks after application acceptance and marks tasks submitted.
- `/Users/swiftpanda/Developer/popsdrops/src/app/actions/content.ts`: Creator content and performance submissions.
- `/Users/swiftpanda/Developer/popsdrops/src/app/actions/campaigns.ts`: Brand campaign creation.
- `/Users/swiftpanda/Developer/popsdrops/src/app/api/public/campaigns/[id]/route.ts`: Public apply page campaign payload.
- `/Users/swiftpanda/Developer/popsdrops/src/app/(site)/apply/[id]/page.tsx`: Public creator application page.
- `/Users/swiftpanda/Developer/popsdrops/src/components/shared/performance-form.tsx`: Creator performance form.
- `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/campaign-report-metrics.ts`: Report aggregation helpers.
- `/Users/swiftpanda/Developer/popsdrops/src/types/database.ts`: Manual database type definitions.

## File Structure

Create:

- `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/platform-templates.ts`: Canonical reporting platform and metric template definitions.
- `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/platform-templates.test.ts`: Template coverage and validation tests.
- `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/requirements.ts`: Requirement validation, default requirement generation, source labels.
- `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/requirements.test.ts`: Requirement helper tests.
- `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/eligibility.ts`: Creator eligibility state helper for apply surfaces.
- `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/eligibility.test.ts`: Eligibility helper tests.
- `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/metric-values.ts`: Sparse metric value normalization and rollup helpers.
- `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/metric-values.test.ts`: Metric value helper tests.
- `/Users/swiftpanda/Developer/popsdrops/src/lib/supabase/reporting-evidence-templates-migration.test.ts`: Migration source tests for tables, constraints, and RLS.
- `/Users/swiftpanda/Developer/popsdrops/supabase/migrations/20260507010000_reporting_evidence_templates.sql`: Database, seed definitions, RLS.
- `/Users/swiftpanda/Developer/popsdrops/src/app/actions/reporting-evidence.ts`: Server actions for AI extraction confirmation and future evidence value flow.
- `/Users/swiftpanda/Developer/popsdrops/src/app/actions/reporting-evidence.test.ts`: Source-level action contract tests.

Modify:

- `/Users/swiftpanda/Developer/popsdrops/src/lib/platform-metrics.ts`: Re-export current platform metrics from reporting templates for backward compatibility.
- `/Users/swiftpanda/Developer/popsdrops/src/lib/validations.ts`: Add reporting requirement and metric value schemas.
- `/Users/swiftpanda/Developer/popsdrops/shared/validations.ts`: Mirror report task and metric value schema inputs used by mobile/shared code.
- `/Users/swiftpanda/Developer/popsdrops/src/types/database.ts`: Add new table and enum types.
- `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/task-schedule.ts`: Add `per_post` cadence behavior.
- `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/task-schedule.test.ts`: Add `per_post` behavior tests.
- `/Users/swiftpanda/Developer/popsdrops/src/lib/supabase/privileged.ts`: Add per-post task creation helper and select requirement fields.
- `/Users/swiftpanda/Developer/popsdrops/src/app/actions/campaigns.ts`: Persist reporting requirements and plan fields during campaign creation.
- `/Users/swiftpanda/Developer/popsdrops/src/app/actions/content.ts`: Insert sparse metric values and create per-post task when content is published.
- `/Users/swiftpanda/Developer/popsdrops/src/app/api/public/campaigns/[id]/route.ts`: Include application-visible reporting requirements.
- `/Users/swiftpanda/Developer/popsdrops/src/app/(site)/apply/[id]/page.tsx`: Show eligibility preview before application CTA.
- `/Users/swiftpanda/Developer/popsdrops/src/components/shared/performance-form.tsx`: Render required metric template and submit sparse metric values.
- `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/campaign-report-metrics.ts`: Include sparse metric values in report reads and source labels.
- `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/campaign-report-metrics.test.ts`: Verify source labels and Generic/X metric handling.

## Task 1: Reporting Platform Templates

**Files:**

- Create: `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/platform-templates.ts`
- Create: `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/platform-templates.test.ts`
- Modify: `/Users/swiftpanda/Developer/popsdrops/src/lib/platform-metrics.ts`

- [ ] **Step 1: Write failing template coverage tests**

Create `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/platform-templates.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  DEFAULT_REQUIRED_EVIDENCE,
  REPORTING_PLATFORM_LABELS,
  REPORTING_PLATFORMS,
  getDefaultReportingRequirement,
  getReportingMetricTemplate,
  getReportingPlatformLabel,
  isReportingPlatform,
} from "./platform-templates";

describe("reporting platform templates", () => {
  it("defines six named platforms plus generic", () => {
    expect(REPORTING_PLATFORMS).toEqual([
      "instagram",
      "tiktok",
      "youtube",
      "facebook",
      "snapchat",
      "x",
      "generic",
    ]);
    expect(Object.keys(REPORTING_PLATFORM_LABELS)).toEqual(REPORTING_PLATFORMS);
  });

  it("keeps X and Generic as reporting platforms without requiring OAuth support", () => {
    expect(isReportingPlatform("x")).toBe(true);
    expect(isReportingPlatform("generic")).toBe(true);
    expect(getReportingPlatformLabel("x")).toBe("X");
    expect(getReportingPlatformLabel("generic")).toBe("Generic");
  });

  it("ships default metric templates for each platform", () => {
    for (const platform of REPORTING_PLATFORMS) {
      const metrics = getReportingMetricTemplate(platform);
      expect(metrics.length).toBeGreaterThanOrEqual(5);
      expect(metrics.every((metric) => metric.metricKey.length > 0)).toBe(true);
    }

    expect(getReportingMetricTemplate("instagram").map((metric) => metric.metricKey)).toEqual(
      expect.arrayContaining(["views", "reach", "likes", "comments", "shares", "saves"]),
    );
    expect(getReportingMetricTemplate("x").map((metric) => metric.metricKey)).toEqual(
      expect.arrayContaining(["impressions", "likes", "reposts", "replies", "bookmarks"]),
    );
    expect(getReportingMetricTemplate("generic").map((metric) => metric.metricKey)).toEqual(
      expect.arrayContaining(["views", "engagements", "clicks", "custom_1"]),
    );
  });

  it("creates intentional default requirements for campaign setup", () => {
    const instagram = getDefaultReportingRequirement("instagram", "reel");
    expect(instagram).toMatchObject({
      platform: "instagram",
      platformLabel: null,
      contentFormat: "reel",
      accountRequirement: "native_insights_required",
      evidenceTypes: DEFAULT_REQUIRED_EVIDENCE,
      aiExtractionAllowed: true,
      creatorConfirmationRequired: true,
    });
    expect(instagram.requiredMetricKeys).toEqual(
      expect.arrayContaining(["views", "reach", "likes", "comments"]),
    );

    const generic = getDefaultReportingRequirement("generic", "custom");
    expect(generic.platformLabel).toBe("");
    expect(generic.accountRequirement).toBe("brand_defined");
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npx vitest run src/lib/reporting/platform-templates.test.ts
```

Expected: fail because `platform-templates.ts` does not exist.

- [ ] **Step 3: Implement templates**

Create `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/platform-templates.ts`:

```ts
export const REPORTING_PLATFORMS = [
  "instagram",
  "tiktok",
  "youtube",
  "facebook",
  "snapchat",
  "x",
  "generic",
] as const;

export type ReportingPlatform = (typeof REPORTING_PLATFORMS)[number];

export type ReportingMetricFieldType =
  | "integer"
  | "decimal"
  | "percentage"
  | "duration_seconds"
  | "currency"
  | "text";

export type ReportingEvidenceScope =
  | "public"
  | "native_insights"
  | "brand_defined";

export type ReportingAccountRequirement =
  | "public_post_ok"
  | "native_insights_required"
  | "business_or_creator_account_required"
  | "brand_defined";

export type ReportingEvidenceType =
  | "public_url"
  | "manual_metrics"
  | "screenshot"
  | "analytics_export"
  | "csv"
  | "document";

export type ReportingMetricDefinition = {
  platform: ReportingPlatform;
  metricKey: string;
  label: string;
  fieldType: ReportingMetricFieldType;
  evidenceScope: ReportingEvidenceScope;
  isDefault: boolean;
  isPrivateMetric: boolean;
  sortOrder: number;
};

export type ReportingRequirementDraft = {
  platform: ReportingPlatform;
  platformLabel: string | null;
  contentFormat: string;
  accountRequirement: ReportingAccountRequirement;
  evidenceTypes: ReportingEvidenceType[];
  requiredMetricKeys: string[];
  aiExtractionAllowed: boolean;
  creatorConfirmationRequired: boolean;
};

export const DEFAULT_REQUIRED_EVIDENCE: ReportingEvidenceType[] = [
  "public_url",
  "manual_metrics",
  "screenshot",
];

export const REPORTING_PLATFORM_LABELS: Record<ReportingPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  facebook: "Facebook",
  snapchat: "Snapchat",
  x: "X",
  generic: "Generic",
};

const metric = (
  platform: ReportingPlatform,
  metricKey: string,
  label: string,
  options: {
    fieldType?: ReportingMetricFieldType;
    evidenceScope?: ReportingEvidenceScope;
    isDefault?: boolean;
    isPrivateMetric?: boolean;
    sortOrder: number;
  },
): ReportingMetricDefinition => ({
  platform,
  metricKey,
  label,
  fieldType: options.fieldType ?? "integer",
  evidenceScope: options.evidenceScope ?? "public",
  isDefault: options.isDefault ?? true,
  isPrivateMetric: options.isPrivateMetric ?? false,
  sortOrder: options.sortOrder,
});

export const REPORTING_METRIC_TEMPLATES: Record<
  ReportingPlatform,
  ReportingMetricDefinition[]
> = {
  instagram: [
    metric("instagram", "views", "Views", { sortOrder: 10 }),
    metric("instagram", "reach", "Reach", {
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 20,
    }),
    metric("instagram", "impressions", "Impressions", {
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 30,
    }),
    metric("instagram", "likes", "Likes", { sortOrder: 40 }),
    metric("instagram", "comments", "Comments", { sortOrder: 50 }),
    metric("instagram", "shares", "Shares", {
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 60,
    }),
    metric("instagram", "saves", "Saves", {
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 70,
    }),
    metric("instagram", "profile_visits", "Profile visits", {
      evidenceScope: "native_insights",
      isDefault: false,
      isPrivateMetric: true,
      sortOrder: 80,
    }),
    metric("instagram", "link_clicks", "Link clicks", {
      evidenceScope: "native_insights",
      isDefault: false,
      isPrivateMetric: true,
      sortOrder: 90,
    }),
  ],
  tiktok: [
    metric("tiktok", "views", "Views", { sortOrder: 10 }),
    metric("tiktok", "likes", "Likes", { sortOrder: 20 }),
    metric("tiktok", "comments", "Comments", { sortOrder: 30 }),
    metric("tiktok", "shares", "Shares", { sortOrder: 40 }),
    metric("tiktok", "favorites", "Favorites", {
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 50,
    }),
    metric("tiktok", "avg_watch_time_seconds", "Average watch time", {
      fieldType: "duration_seconds",
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 60,
    }),
    metric("tiktok", "completion_rate", "Completion rate", {
      fieldType: "percentage",
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 70,
    }),
    metric("tiktok", "profile_views", "Profile views", {
      evidenceScope: "native_insights",
      isDefault: false,
      isPrivateMetric: true,
      sortOrder: 80,
    }),
  ],
  youtube: [
    metric("youtube", "views", "Views", { sortOrder: 10 }),
    metric("youtube", "impressions", "Impressions", {
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 20,
    }),
    metric("youtube", "impressions_click_through_rate", "Impressions CTR", {
      fieldType: "percentage",
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 30,
    }),
    metric("youtube", "watch_time_minutes", "Watch time", {
      fieldType: "decimal",
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 40,
    }),
    metric("youtube", "avg_view_duration_seconds", "Average view duration", {
      fieldType: "duration_seconds",
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 50,
    }),
    metric("youtube", "likes", "Likes", { sortOrder: 60 }),
    metric("youtube", "comments", "Comments", { sortOrder: 70 }),
    metric("youtube", "shares", "Shares", {
      evidenceScope: "native_insights",
      isDefault: false,
      isPrivateMetric: true,
      sortOrder: 80,
    }),
    metric("youtube", "subscribers_gained", "Subscribers gained", {
      evidenceScope: "native_insights",
      isDefault: false,
      isPrivateMetric: true,
      sortOrder: 90,
    }),
  ],
  facebook: [
    metric("facebook", "reach", "Reach", {
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 10,
    }),
    metric("facebook", "impressions", "Impressions", {
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 20,
    }),
    metric("facebook", "views", "Views", { sortOrder: 30 }),
    metric("facebook", "reactions", "Reactions", { sortOrder: 40 }),
    metric("facebook", "comments", "Comments", { sortOrder: 50 }),
    metric("facebook", "shares", "Shares", { sortOrder: 60 }),
    metric("facebook", "clicks", "Clicks", {
      evidenceScope: "native_insights",
      isDefault: false,
      isPrivateMetric: true,
      sortOrder: 70,
    }),
    metric("facebook", "profile_visits", "Profile visits", {
      evidenceScope: "native_insights",
      isDefault: false,
      isPrivateMetric: true,
      sortOrder: 80,
    }),
  ],
  snapchat: [
    metric("snapchat", "views", "Views", { sortOrder: 10 }),
    metric("snapchat", "viewers", "Viewers", {
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 20,
    }),
    metric("snapchat", "screenshots", "Screenshots", {
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 30,
    }),
    metric("snapchat", "shares", "Shares", {
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 40,
    }),
    metric("snapchat", "swipe_ups", "Swipe-ups", {
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 50,
    }),
    metric("snapchat", "avg_view_time_seconds", "Average view time", {
      fieldType: "duration_seconds",
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 60,
    }),
    metric("snapchat", "total_view_time_seconds", "Total view time", {
      fieldType: "duration_seconds",
      evidenceScope: "native_insights",
      isDefault: false,
      isPrivateMetric: true,
      sortOrder: 70,
    }),
    metric("snapchat", "comments", "Comments", {
      evidenceScope: "native_insights",
      isDefault: false,
      sortOrder: 80,
    }),
    metric("snapchat", "favorites", "Favorites", {
      evidenceScope: "native_insights",
      isDefault: false,
      sortOrder: 90,
    }),
  ],
  x: [
    metric("x", "impressions", "Impressions", {
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 10,
    }),
    metric("x", "likes", "Likes", { sortOrder: 20 }),
    metric("x", "replies", "Replies", { sortOrder: 30 }),
    metric("x", "reposts", "Reposts", { sortOrder: 40 }),
    metric("x", "quotes", "Quotes", { sortOrder: 50 }),
    metric("x", "bookmarks", "Bookmarks", {
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 60,
    }),
    metric("x", "clicks", "Clicks", {
      evidenceScope: "native_insights",
      isDefault: false,
      isPrivateMetric: true,
      sortOrder: 70,
    }),
    metric("x", "video_views", "Video views", {
      isDefault: false,
      sortOrder: 80,
    }),
  ],
  generic: [
    metric("generic", "views", "Views", { sortOrder: 10 }),
    metric("generic", "reach", "Reach", { isDefault: false, sortOrder: 20 }),
    metric("generic", "impressions", "Impressions", {
      isDefault: false,
      sortOrder: 30,
    }),
    metric("generic", "engagements", "Engagements", { sortOrder: 40 }),
    metric("generic", "clicks", "Clicks", { sortOrder: 50 }),
    metric("generic", "screenshots", "Screenshots", {
      isDefault: false,
      sortOrder: 60,
    }),
    metric("generic", "conversions", "Conversions", {
      isDefault: false,
      sortOrder: 70,
    }),
    metric("generic", "custom_1", "Custom metric 1", {
      fieldType: "text",
      evidenceScope: "brand_defined",
      isDefault: false,
      sortOrder: 80,
    }),
    metric("generic", "custom_2", "Custom metric 2", {
      fieldType: "text",
      evidenceScope: "brand_defined",
      isDefault: false,
      sortOrder: 90,
    }),
    metric("generic", "custom_3", "Custom metric 3", {
      fieldType: "text",
      evidenceScope: "brand_defined",
      isDefault: false,
      sortOrder: 100,
    }),
  ],
};

export function isReportingPlatform(value: string): value is ReportingPlatform {
  return REPORTING_PLATFORMS.includes(value as ReportingPlatform);
}

export function getReportingPlatformLabel(platform: ReportingPlatform): string {
  return REPORTING_PLATFORM_LABELS[platform];
}

export function getReportingMetricTemplate(
  platform: ReportingPlatform,
): ReportingMetricDefinition[] {
  return REPORTING_METRIC_TEMPLATES[platform].toSorted(
    (a, b) => a.sortOrder - b.sortOrder,
  );
}

export function getDefaultReportingRequirement(
  platform: ReportingPlatform,
  contentFormat: string,
): ReportingRequirementDraft {
  const defaultMetrics = getReportingMetricTemplate(platform)
    .filter((metricDefinition) => metricDefinition.isDefault)
    .map((metricDefinition) => metricDefinition.metricKey);

  return {
    platform,
    platformLabel: platform === "generic" ? "" : null,
    contentFormat,
    accountRequirement:
      platform === "generic"
        ? "brand_defined"
        : defaultMetrics.some((metricKey) => {
            const definition = REPORTING_METRIC_TEMPLATES[platform].find(
              (candidate) => candidate.metricKey === metricKey,
            );
            return definition?.evidenceScope === "native_insights";
          })
          ? "native_insights_required"
          : "public_post_ok",
    evidenceTypes: DEFAULT_REQUIRED_EVIDENCE,
    requiredMetricKeys: defaultMetrics,
    aiExtractionAllowed: true,
    creatorConfirmationRequired: true,
  };
}
```

- [ ] **Step 4: Keep old five-platform form imports working**

Modify `/Users/swiftpanda/Developer/popsdrops/src/lib/platform-metrics.ts` so current UI gets its five platform config from the new templates. Preserve the existing exported names:

```ts
import type { Platform } from "@/lib/constants";
import {
  getReportingMetricTemplate,
  type ReportingMetricDefinition,
} from "@/lib/reporting/platform-templates";

export type MetricFieldType = "integer" | "decimal" | "percentage";

export type MetricKey =
  | "views"
  | "reach"
  | "impressions"
  | "likes"
  | "comments"
  | "shares"
  | "saves"
  | "sends"
  | "screenshots"
  | "replies"
  | "clicks"
  | "completion_rate"
  | "avg_watch_time_seconds"
  | "subscriber_gains";

export interface MetricField {
  key: MetricKey;
  label: string;
  description: string;
  required: boolean;
  type: MetricFieldType;
}

const LEGACY_KEY_MAP: Record<string, MetricKey | null> = {
  favorites: "saves",
  avg_view_duration_seconds: "avg_watch_time_seconds",
  watch_time_minutes: null,
  impressions_click_through_rate: "clicks",
  subscribers_gained: "subscriber_gains",
  reactions: "likes",
  viewers: "reach",
  swipe_ups: "clicks",
  avg_view_time_seconds: "avg_watch_time_seconds",
  total_view_time_seconds: null,
  profile_visits: "reach",
  link_clicks: "clicks",
};

function legacyField(definition: ReportingMetricDefinition): MetricField | null {
  const mapped = LEGACY_KEY_MAP[definition.metricKey] ?? definition.metricKey;
  if (!mapped) return null;
  return {
    key: mapped as MetricKey,
    label: definition.label,
    description: definition.evidenceScope === "native_insights"
      ? `${definition.label} from native platform insights`
      : `${definition.label} for the published content`,
    required: definition.isDefault,
    type: definition.fieldType === "percentage"
      ? "percentage"
      : definition.fieldType === "integer"
        ? "integer"
        : "decimal",
  };
}

function uniqueFields(fields: Array<MetricField | null>): MetricField[] {
  const seen = new Set<string>();
  return fields.filter((field): field is MetricField => {
    if (!field || seen.has(field.key)) return false;
    seen.add(field.key);
    return true;
  });
}

export const PLATFORM_METRICS: Record<Platform, MetricField[]> = {
  tiktok: uniqueFields(getReportingMetricTemplate("tiktok").map(legacyField)),
  instagram: uniqueFields(getReportingMetricTemplate("instagram").map(legacyField)),
  youtube: uniqueFields(getReportingMetricTemplate("youtube").map(legacyField)),
  snapchat: uniqueFields(getReportingMetricTemplate("snapchat").map(legacyField)),
  facebook: uniqueFields(getReportingMetricTemplate("facebook").map(legacyField)),
};

export const PLATFORM_METRIC_NOTES: Record<Platform, string> = {
  tiktok: "TikTok reporting can include public engagement plus native analytics such as watch time and completion.",
  instagram: "Instagram reporting may require professional insights for reach, impressions, saves, shares, and profile actions.",
  youtube: "YouTube reporting may require Studio analytics for impressions, watch time, and subscriber impact.",
  snapchat: "Snapchat reporting often depends on Public Profile analytics screenshots for private engagement signals.",
  facebook: "Facebook reporting may require Page or professional dashboard insights for reach, impressions, and clicks.",
};
```

- [ ] **Step 5: Run template tests**

Run:

```bash
npx vitest run src/lib/reporting/platform-templates.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit task 1**

Run:

```bash
git add src/lib/reporting/platform-templates.ts src/lib/reporting/platform-templates.test.ts src/lib/platform-metrics.ts
git commit -m "feat: add reporting platform templates"
```

## Task 2: Database Migration and RLS Contract

**Files:**

- Create: `/Users/swiftpanda/Developer/popsdrops/supabase/migrations/20260507010000_reporting_evidence_templates.sql`
- Create: `/Users/swiftpanda/Developer/popsdrops/src/lib/supabase/reporting-evidence-templates-migration.test.ts`

- [ ] **Step 1: Write migration contract tests**

Create `/Users/swiftpanda/Developer/popsdrops/src/lib/supabase/reporting-evidence-templates-migration.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../../supabase/migrations/20260507010000_reporting_evidence_templates.sql", import.meta.url),
  "utf8",
);

describe("reporting evidence templates migration", () => {
  it("adds sparse reporting evidence tables", () => {
    expect(migration).toContain("create table if not exists public.reporting_metric_definitions");
    expect(migration).toContain("create table if not exists public.campaign_reporting_requirements");
    expect(migration).toContain("create table if not exists public.content_performance_metric_values");
    expect(migration).toContain("create table if not exists public.content_performance_ai_extractions");
  });

  it("supports all reporting platforms including X and Generic", () => {
    for (const platform of ["instagram", "tiktok", "youtube", "facebook", "snapchat", "x", "generic"]) {
      expect(migration).toContain(`'${platform}'`);
    }
  });

  it("extends reporting cadence with per_post", () => {
    expect(migration).toContain("campaign_reporting_plans_cadence_check");
    expect(migration).toContain("'per_post'");
  });

  it("enforces generic platform label and controlled source states", () => {
    expect(migration).toContain("campaign_reporting_requirements_generic_label_check");
    expect(migration).toContain("source_type in (");
    expect(migration).toContain("'creator_manual'");
    expect(migration).toContain("'ai_extracted'");
    expect(migration).toContain("'creator_confirmed'");
    expect(migration).toContain("'brand_verified'");
    expect(migration).toContain("'platform_api'");
  });

  it("enables RLS and policies on all new public tables", () => {
    for (const table of [
      "reporting_metric_definitions",
      "campaign_reporting_requirements",
      "content_performance_metric_values",
      "content_performance_ai_extractions",
    ]) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }

    expect(migration).toContain("campaign_reporting_requirements_select_access");
    expect(migration).toContain("content_performance_metric_values_select_access");
    expect(migration).toContain("content_performance_ai_extractions_select_access");
  });
});
```

- [ ] **Step 2: Run the failing migration test**

Run:

```bash
npx vitest run src/lib/supabase/reporting-evidence-templates-migration.test.ts
```

Expected: fail because the migration does not exist.

- [ ] **Step 3: Add migration**

Create `/Users/swiftpanda/Developer/popsdrops/supabase/migrations/20260507010000_reporting_evidence_templates.sql` with these sections:

```sql
-- Reporting evidence templates, campaign requirements, sparse metric values,
-- and AI extraction audit records.

alter table public.campaign_reporting_plans
  drop constraint if exists campaign_reporting_plans_cadence_check;

alter table public.campaign_reporting_plans
  add constraint campaign_reporting_plans_cadence_check check (
    cadence in ('final_only', 'weekly', 'daily_launch_window', 'custom', 'per_post')
  );

create table if not exists public.reporting_metric_definitions (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  metric_key text not null,
  label text not null,
  field_type text not null,
  evidence_scope text not null,
  is_default boolean not null default false,
  is_private_metric boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint reporting_metric_definitions_platform_check check (
    platform in ('instagram', 'tiktok', 'youtube', 'facebook', 'snapchat', 'x', 'generic')
  ),
  constraint reporting_metric_definitions_field_type_check check (
    field_type in ('integer', 'decimal', 'percentage', 'duration_seconds', 'currency', 'text')
  ),
  constraint reporting_metric_definitions_evidence_scope_check check (
    evidence_scope in ('public', 'native_insights', 'brand_defined')
  ),
  constraint reporting_metric_definitions_unique unique (platform, metric_key)
);

comment on table public.reporting_metric_definitions is
  'Canonical reporting metric templates used by campaign requirements, creator evidence forms, AI extraction schemas, and report labels.';

create table if not exists public.campaign_reporting_requirements (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  platform text not null,
  platform_label text,
  content_format text not null,
  account_requirement text not null default 'public_post_ok',
  evidence_types text[] not null default array['public_url', 'manual_metrics', 'screenshot']::text[],
  required_metric_keys text[] not null default '{}'::text[],
  ai_extraction_allowed boolean not null default true,
  creator_confirmation_required boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_reporting_requirements_platform_check check (
    platform in ('instagram', 'tiktok', 'youtube', 'facebook', 'snapchat', 'x', 'generic')
  ),
  constraint campaign_reporting_requirements_account_check check (
    account_requirement in (
      'public_post_ok',
      'native_insights_required',
      'business_or_creator_account_required',
      'brand_defined'
    )
  ),
  constraint campaign_reporting_requirements_generic_label_check check (
    platform <> 'generic' or nullif(trim(coalesce(platform_label, '')), '') is not null
  )
);

comment on table public.campaign_reporting_requirements is
  'Campaign-specific proof requirements used before application, during report task submission, and in final report completeness.';

create table if not exists public.content_performance_metric_values (
  id uuid primary key default gen_random_uuid(),
  performance_id uuid not null references public.content_performance(id) on delete cascade,
  report_task_id uuid references public.campaign_report_tasks(id) on delete cascade,
  platform text not null,
  metric_key text not null,
  metric_label text not null,
  metric_value numeric,
  metric_text text,
  source_type text not null default 'creator_manual',
  extraction_confidence numeric,
  confirmed_by_creator boolean not null default false,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_performance_metric_values_platform_check check (
    platform in ('instagram', 'tiktok', 'youtube', 'facebook', 'snapchat', 'x', 'generic')
  ),
  constraint content_performance_metric_values_source_check check (
    source_type in (
      'creator_manual',
      'ai_extracted',
      'creator_confirmed',
      'brand_verified',
      'platform_api'
    )
  ),
  constraint content_performance_metric_values_value_check check (
    metric_value is not null or nullif(trim(coalesce(metric_text, '')), '') is not null
  ),
  constraint content_performance_metric_values_confidence_check check (
    extraction_confidence is null or (extraction_confidence >= 0 and extraction_confidence <= 1)
  ),
  constraint content_performance_metric_values_unique unique (performance_id, metric_key)
);

comment on table public.content_performance_metric_values is
  'Sparse metric values submitted or confirmed for a content performance read. Supports platform-specific and Generic metrics without schema bloat.';

create table if not exists public.content_performance_ai_extractions (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.content_performance_evidence(id) on delete cascade,
  report_task_id uuid not null references public.campaign_report_tasks(id) on delete cascade,
  platform text not null,
  model text not null,
  input_sha256 text not null,
  extracted_metrics jsonb not null,
  confidence_summary jsonb not null default '{}'::jsonb,
  status text not null default 'pending_confirmation',
  created_at timestamptz not null default now(),
  constraint content_performance_ai_extractions_platform_check check (
    platform in ('instagram', 'tiktok', 'youtube', 'facebook', 'snapchat', 'x', 'generic')
  ),
  constraint content_performance_ai_extractions_status_check check (
    status in (
      'pending_confirmation',
      'accepted_by_creator',
      'edited_by_creator',
      'rejected_by_creator',
      'superseded'
    )
  )
);

comment on table public.content_performance_ai_extractions is
  'Audit record for AI extraction attempts. These rows never become report truth until a creator confirms or edits the values.';

create index if not exists reporting_metric_definitions_platform_sort_idx
  on public.reporting_metric_definitions (platform, sort_order);

create index if not exists campaign_reporting_requirements_campaign_sort_idx
  on public.campaign_reporting_requirements (campaign_id, sort_order);

create index if not exists content_performance_metric_values_performance_idx
  on public.content_performance_metric_values (performance_id);

create index if not exists content_performance_metric_values_report_task_idx
  on public.content_performance_metric_values (report_task_id);

create index if not exists content_performance_ai_extractions_task_status_idx
  on public.content_performance_ai_extractions (report_task_id, status);

alter table public.reporting_metric_definitions enable row level security;
alter table public.campaign_reporting_requirements enable row level security;
alter table public.content_performance_metric_values enable row level security;
alter table public.content_performance_ai_extractions enable row level security;

drop policy if exists reporting_metric_definitions_read_all on public.reporting_metric_definitions;
create policy reporting_metric_definitions_read_all
  on public.reporting_metric_definitions
  for select
  using (true);

drop policy if exists campaign_reporting_requirements_select_access
  on public.campaign_reporting_requirements;
create policy campaign_reporting_requirements_select_access
  on public.campaign_reporting_requirements
  for select
  using (
    app_private.current_user_is_admin()
    or app_private.is_campaign_brand(campaign_id)
    or app_private.is_campaign_member(campaign_id)
    or exists (
      select 1
        from public.campaigns
       where campaigns.id = campaign_reporting_requirements.campaign_id
         and campaigns.status = 'recruiting'
    )
  );

drop policy if exists campaign_reporting_requirements_insert_brand
  on public.campaign_reporting_requirements;
create policy campaign_reporting_requirements_insert_brand
  on public.campaign_reporting_requirements
  for insert
  to authenticated
  with check (app_private.is_campaign_brand(campaign_id));

drop policy if exists campaign_reporting_requirements_update_brand
  on public.campaign_reporting_requirements;
create policy campaign_reporting_requirements_update_brand
  on public.campaign_reporting_requirements
  for update
  to authenticated
  using (app_private.is_campaign_brand(campaign_id))
  with check (app_private.is_campaign_brand(campaign_id));

drop policy if exists campaign_reporting_requirements_delete_brand
  on public.campaign_reporting_requirements;
create policy campaign_reporting_requirements_delete_brand
  on public.campaign_reporting_requirements
  for delete
  to authenticated
  using (app_private.is_campaign_brand(campaign_id));

drop policy if exists content_performance_metric_values_select_access
  on public.content_performance_metric_values;
create policy content_performance_metric_values_select_access
  on public.content_performance_metric_values
  for select
  to authenticated
  using (
    app_private.current_user_is_admin()
    or (
      report_task_id is not null
      and exists (
        select 1
          from public.campaign_report_tasks task
         where task.id = content_performance_metric_values.report_task_id
           and (
             app_private.is_campaign_brand(task.campaign_id)
             or app_private.is_campaign_member_record(task.campaign_member_id)
           )
      )
    )
    or app_private.is_performance_creator(performance_id)
  );

drop policy if exists content_performance_metric_values_insert_creator
  on public.content_performance_metric_values;
create policy content_performance_metric_values_insert_creator
  on public.content_performance_metric_values
  for insert
  to authenticated
  with check (
    app_private.is_performance_creator(performance_id)
    and (
      report_task_id is null
      or app_private.is_report_task_creator(report_task_id)
    )
  );

drop policy if exists content_performance_metric_values_update_creator
  on public.content_performance_metric_values;
create policy content_performance_metric_values_update_creator
  on public.content_performance_metric_values
  for update
  to authenticated
  using (app_private.is_performance_creator(performance_id))
  with check (app_private.is_performance_creator(performance_id));

drop policy if exists content_performance_ai_extractions_select_access
  on public.content_performance_ai_extractions;
create policy content_performance_ai_extractions_select_access
  on public.content_performance_ai_extractions
  for select
  to authenticated
  using (
    app_private.current_user_is_admin()
    or app_private.is_report_task_creator(report_task_id)
    or exists (
      select 1
        from public.campaign_report_tasks task
       where task.id = content_performance_ai_extractions.report_task_id
         and app_private.is_campaign_brand(task.campaign_id)
    )
  );

drop policy if exists content_performance_ai_extractions_update_creator
  on public.content_performance_ai_extractions;
create policy content_performance_ai_extractions_update_creator
  on public.content_performance_ai_extractions
  for update
  to authenticated
  using (app_private.is_report_task_creator(report_task_id))
  with check (app_private.is_report_task_creator(report_task_id));
```

Add seed inserts after the policies. Use the values from `REPORTING_METRIC_TEMPLATES` and `on conflict (platform, metric_key) do update` so the migration is idempotent.

- [ ] **Step 4: Run migration contract tests**

Run:

```bash
npx vitest run src/lib/supabase/reporting-evidence-templates-migration.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit task 2**

Run:

```bash
git add supabase/migrations/20260507010000_reporting_evidence_templates.sql src/lib/supabase/reporting-evidence-templates-migration.test.ts
git commit -m "feat: add reporting evidence schema"
```

## Task 3: Database Types and Validation Schemas

**Files:**

- Modify: `/Users/swiftpanda/Developer/popsdrops/src/types/database.ts`
- Modify: `/Users/swiftpanda/Developer/popsdrops/src/lib/validations.ts`
- Modify: `/Users/swiftpanda/Developer/popsdrops/shared/validations.ts`
- Create: `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/requirements.ts`
- Create: `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/requirements.test.ts`

- [ ] **Step 1: Write requirements helper tests**

Create `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/requirements.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  buildDefaultCampaignReportingRequirements,
  validateRequirementMetricKeys,
} from "./requirements";

describe("campaign reporting requirements", () => {
  it("builds default reporting requirements from deliverables", () => {
    const requirements = buildDefaultCampaignReportingRequirements([
      { platform: "instagram", content_type: "reel", quantity: 1 },
      { platform: "tiktok", content_type: "short_video", quantity: 2 },
    ]);

    expect(requirements).toHaveLength(2);
    expect(requirements[0]).toMatchObject({
      platform: "instagram",
      contentFormat: "reel",
      platformLabel: null,
      aiExtractionAllowed: true,
      creatorConfirmationRequired: true,
    });
    expect(requirements[1].requiredMetricKeys).toContain("views");
  });

  it("allows X and Generic requirements without product OAuth support", () => {
    expect(
      validateRequirementMetricKeys({
        platform: "x",
        platformLabel: null,
        requiredMetricKeys: ["impressions", "likes", "bookmarks"],
      }),
    ).toEqual([]);

    expect(
      validateRequirementMetricKeys({
        platform: "generic",
        platformLabel: "Retail partner dashboard",
        requiredMetricKeys: ["views", "engagements", "custom_1"],
      }),
    ).toEqual([]);
  });

  it("rejects unknown metric keys for named platforms", () => {
    expect(
      validateRequirementMetricKeys({
        platform: "instagram",
        platformLabel: null,
        requiredMetricKeys: ["views", "video_breathing_rate"],
      }),
    ).toEqual(["video_breathing_rate"]);
  });

  it("requires a label for Generic requirements", () => {
    expect(
      validateRequirementMetricKeys({
        platform: "generic",
        platformLabel: "",
        requiredMetricKeys: ["views"],
      }),
    ).toEqual(["platform_label"]);
  });
});
```

- [ ] **Step 2: Run failing requirements tests**

Run:

```bash
npx vitest run src/lib/reporting/requirements.test.ts
```

Expected: fail because helper does not exist.

- [ ] **Step 3: Implement requirements helper**

Create `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/requirements.ts`:

```ts
import {
  REPORTING_METRIC_TEMPLATES,
  getDefaultReportingRequirement,
  isReportingPlatform,
  type ReportingPlatform,
  type ReportingRequirementDraft,
} from "./platform-templates";

type DeliverableLike = {
  platform: string;
  content_type: string;
  quantity: number;
};

export type CampaignReportingRequirementInput = ReportingRequirementDraft & {
  sortOrder?: number;
};

export function buildDefaultCampaignReportingRequirements(
  deliverables: DeliverableLike[],
): CampaignReportingRequirementInput[] {
  const seen = new Set<string>();
  const requirements: CampaignReportingRequirementInput[] = [];

  for (const deliverable of deliverables) {
    if (!isReportingPlatform(deliverable.platform)) continue;
    const key = `${deliverable.platform}:${deliverable.content_type}`;
    if (seen.has(key)) continue;
    seen.add(key);

    requirements.push({
      ...getDefaultReportingRequirement(
        deliverable.platform as ReportingPlatform,
        deliverable.content_type,
      ),
      sortOrder: requirements.length,
    });
  }

  return requirements;
}

export function validateRequirementMetricKeys(input: {
  platform: ReportingPlatform;
  platformLabel: string | null;
  requiredMetricKeys: string[];
}): string[] {
  const invalid: string[] = [];

  if (input.platform === "generic" && !input.platformLabel?.trim()) {
    invalid.push("platform_label");
  }

  const allowed = new Set(
    REPORTING_METRIC_TEMPLATES[input.platform].map((metric) => metric.metricKey),
  );

  for (const key of input.requiredMetricKeys) {
    if (!allowed.has(key)) invalid.push(key);
  }

  return invalid;
}

export function getMetricLabel(platform: ReportingPlatform, metricKey: string): string {
  return (
    REPORTING_METRIC_TEMPLATES[platform].find((metric) => metric.metricKey === metricKey)
      ?.label ?? metricKey
  );
}
```

- [ ] **Step 4: Update database types**

Modify `/Users/swiftpanda/Developer/popsdrops/src/types/database.ts`:

```ts
export type ReportingPlatform =
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'facebook'
  | 'snapchat'
  | 'x'
  | 'generic';

export type ReportingFieldType =
  | 'integer'
  | 'decimal'
  | 'percentage'
  | 'duration_seconds'
  | 'currency'
  | 'text';

export type ReportingEvidenceScope =
  | 'public'
  | 'native_insights'
  | 'brand_defined';

export type ReportingAccountRequirement =
  | 'public_post_ok'
  | 'native_insights_required'
  | 'business_or_creator_account_required'
  | 'brand_defined';

export type ReportingMetricSourceType =
  | 'creator_manual'
  | 'ai_extracted'
  | 'creator_confirmed'
  | 'brand_verified'
  | 'platform_api';

export type PerformanceAiExtractionStatus =
  | 'pending_confirmation'
  | 'accepted_by_creator'
  | 'edited_by_creator'
  | 'rejected_by_creator'
  | 'superseded';
```

Add table entries under `Database["public"]["Tables"]` matching the migration:

```ts
reporting_metric_definitions: {
  Row: {
    id: string;
    platform: ReportingPlatform;
    metric_key: string;
    label: string;
    field_type: ReportingFieldType;
    evidence_scope: ReportingEvidenceScope;
    is_default: boolean;
    is_private_metric: boolean;
    sort_order: number;
    created_at: string;
  };
  Insert: {
    id?: string;
    platform: ReportingPlatform;
    metric_key: string;
    label: string;
    field_type: ReportingFieldType;
    evidence_scope: ReportingEvidenceScope;
    is_default?: boolean;
    is_private_metric?: boolean;
    sort_order?: number;
    created_at?: string;
  };
  Update: {
    id?: string;
    platform?: ReportingPlatform;
    metric_key?: string;
    label?: string;
    field_type?: ReportingFieldType;
    evidence_scope?: ReportingEvidenceScope;
    is_default?: boolean;
    is_private_metric?: boolean;
    sort_order?: number;
    created_at?: string;
  };
};
```

Add equivalent definitions for:

- `campaign_reporting_requirements`
- `content_performance_metric_values`
- `content_performance_ai_extractions`

Also update `CampaignReportingCadence`:

```ts
export type CampaignReportingCadence =
  | 'final_only'
  | 'weekly'
  | 'daily_launch_window'
  | 'custom'
  | 'per_post';
```

- [ ] **Step 5: Add Zod schemas**

Modify `/Users/swiftpanda/Developer/popsdrops/src/lib/validations.ts`:

```ts
import { REPORTING_PLATFORMS } from "./reporting/platform-templates";
```

Add:

```ts
const reportingPlatformEnum = z.enum(REPORTING_PLATFORMS);
const reportingEvidenceTypeEnum = z.enum([
  "public_url",
  "manual_metrics",
  "screenshot",
  "analytics_export",
  "csv",
  "document",
]);
const reportingAccountRequirementEnum = z.enum([
  "public_post_ok",
  "native_insights_required",
  "business_or_creator_account_required",
  "brand_defined",
]);

export const campaignReportingRequirementSchema = z.object({
  platform: reportingPlatformEnum,
  platformLabel: z.string().trim().max(80).nullable(),
  contentFormat: z.string().trim().min(1).max(80),
  accountRequirement: reportingAccountRequirementEnum,
  evidenceTypes: z.array(reportingEvidenceTypeEnum).min(1).max(6),
  requiredMetricKeys: z.array(z.string().trim().min(1).max(80)).min(1).max(20),
  aiExtractionAllowed: z.boolean().default(true),
  creatorConfirmationRequired: z.boolean().default(true),
});

export const performanceMetricValueSchema = z.object({
  platform: reportingPlatformEnum,
  metricKey: z.string().trim().min(1).max(80),
  metricLabel: z.string().trim().min(1).max(120),
  metricValue: z.coerce.number().nonnegative().optional(),
  metricText: z.string().trim().max(500).optional(),
}).refine((value) => value.metricValue != null || Boolean(value.metricText), {
  message: "Enter a metric value",
  path: ["metricValue"],
});
```

Add to `createCampaignSchema`:

```ts
reporting_requirements: z.array(campaignReportingRequirementSchema).max(30).optional(),
reporting_cadence: z
  .enum(["final_only", "weekly", "daily_launch_window", "custom", "per_post"])
  .default("final_only"),
```

Add to `submitPerformanceSchema`:

```ts
metric_values: z.array(performanceMetricValueSchema).max(40).optional(),
```

Mirror the performance `report_task_id` and `metric_values` schema changes in `/Users/swiftpanda/Developer/popsdrops/shared/validations.ts`.

- [ ] **Step 6: Run helper and validation tests**

Run:

```bash
npx vitest run src/lib/reporting/requirements.test.ts src/lib/validations.test.ts src/app/actions/content-report-tasks.test.ts
```

Expected: pass after updating import/type errors.

- [ ] **Step 7: Commit task 3**

Run:

```bash
git add src/types/database.ts src/lib/validations.ts shared/validations.ts src/lib/reporting/requirements.ts src/lib/reporting/requirements.test.ts
git commit -m "feat: add reporting requirement validation"
```

## Task 4: Report Task Scheduling for Per-Post Reporting

**Files:**

- Modify: `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/task-schedule.ts`
- Modify: `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/task-schedule.test.ts`
- Modify: `/Users/swiftpanda/Developer/popsdrops/src/lib/supabase/privileged.ts`
- Modify: `/Users/swiftpanda/Developer/popsdrops/src/app/actions/content.ts`

- [ ] **Step 1: Add task schedule tests**

Append to `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/task-schedule.test.ts`:

```ts
it("does not create member-level tasks for per-post cadence", () => {
  const tasks = generateReportTaskDrafts({
    campaignId,
    campaignMemberId: memberId,
    performanceDueDate: "2026-05-31T23:59:59.999Z",
    reportingPlan: {
      cadence: "per_post",
      gracePeriodHours: 24,
      customDueDates: [],
      startsAt: null,
      endsAt: null,
    },
  });

  expect(tasks).toEqual([]);
});
```

Add a new test for a new helper:

```ts
import { createPerPostReportTaskDraft } from "./task-schedule";

it("creates a stable per-post task key for published content", () => {
  expect(
    createPerPostReportTaskDraft({
      campaignId,
      campaignMemberId: memberId,
      submissionId: "33333333-3333-3333-3333-333333333333",
      dueAt: "2026-05-18T23:59:59.999Z",
    }),
  ).toEqual({
    campaign_id: campaignId,
    campaign_member_id: memberId,
    task_key: "post:33333333-3333-3333-3333-333333333333",
    period_start: null,
    period_end: null,
    due_at: "2026-05-18T23:59:59.999Z",
    status: "pending",
  });
});
```

- [ ] **Step 2: Run failing schedule tests**

Run:

```bash
npx vitest run src/lib/reporting/task-schedule.test.ts
```

Expected: fail because `createPerPostReportTaskDraft` does not exist.

- [ ] **Step 3: Implement per-post scheduling**

Modify `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/task-schedule.ts`:

```ts
if (cadence === "per_post") {
  return [];
}
```

Add:

```ts
export function createPerPostReportTaskDraft(input: {
  campaignId: string;
  campaignMemberId: string;
  submissionId: string;
  dueAt: string;
}): ReportTaskDraft {
  return createDraft(
    {
      campaignId: input.campaignId,
      campaignMemberId: input.campaignMemberId,
    },
    `post:${input.submissionId}`,
    null,
    null,
    input.dueAt,
  );
}
```

- [ ] **Step 4: Add privileged per-post task creation**

Modify `/Users/swiftpanda/Developer/popsdrops/src/lib/supabase/privileged.ts`:

```ts
import {
  createPerPostReportTaskDraft,
  generateReportTaskDrafts,
} from "@/lib/reporting/task-schedule";
```

Add:

```ts
export async function createPrivilegedReportTaskForSubmission(input: {
  submissionId: string;
  campaignId: string;
  campaignMemberId: string;
}) {
  const admin = createAdminClient();

  const { data: reportingPlan, error: planError } = await admin
    .from("campaign_reporting_plans")
    .select("cadence")
    .eq("campaign_id", input.campaignId)
    .maybeSingle();

  if (planError) throw new Error(planError.message);
  if (reportingPlan?.cadence !== "per_post") return null;

  const { data: campaign, error: campaignError } = await admin
    .from("campaigns")
    .select("performance_due_date")
    .eq("id", input.campaignId)
    .single();

  if (campaignError) throw new Error(campaignError.message);
  if (!campaign?.performance_due_date) return null;

  const draft = createPerPostReportTaskDraft({
    campaignId: input.campaignId,
    campaignMemberId: input.campaignMemberId,
    submissionId: input.submissionId,
    dueAt: campaign.performance_due_date,
  });

  const { data, error } = await admin
    .from("campaign_report_tasks")
    .upsert(draft satisfies CampaignReportTaskInsert, {
      onConflict: "campaign_member_id,task_key",
      ignoreDuplicates: true,
    })
    .select("id, campaign_id, campaign_member_id, due_at, status")
    .single();

  if (error) throw new Error(error.message);
  return data;
}
```

- [ ] **Step 5: Call per-post task helper when creator publishes content**

Modify `/Users/swiftpanda/Developer/popsdrops/src/app/actions/content.ts` import:

```ts
import {
  createPrivilegedReportTaskForSubmission,
  markPrivilegedReportTaskSubmitted,
} from "@/lib/supabase/privileged";
```

In the publish URL action after `content_submissions` update succeeds:

```ts
await createPrivilegedReportTaskForSubmission({
  submissionId,
  campaignId: member.campaign_id,
  campaignMemberId: submission.campaign_member_id,
});
```

- [ ] **Step 6: Run schedule and action contract tests**

Run:

```bash
npx vitest run src/lib/reporting/task-schedule.test.ts src/app/actions/content-report-tasks.test.ts
```

Expected: pass. If `content-report-tasks.test.ts` needs a new assertion, add:

```ts
expect(contentActionsSource).toContain("createPrivilegedReportTaskForSubmission");
expect(privilegedSource).toContain("export async function createPrivilegedReportTaskForSubmission");
```

- [ ] **Step 7: Commit task 4**

Run:

```bash
git add src/lib/reporting/task-schedule.ts src/lib/reporting/task-schedule.test.ts src/lib/supabase/privileged.ts src/app/actions/content.ts src/app/actions/content-report-tasks.test.ts
git commit -m "feat: support per-post report tasks"
```

## Task 5: Campaign Creation Persists Reporting Requirements

**Files:**

- Modify: `/Users/swiftpanda/Developer/popsdrops/src/app/actions/campaigns.ts`
- Create: `/Users/swiftpanda/Developer/popsdrops/src/app/actions/campaigns-reporting-requirements.test.ts`
- Modify: `/Users/swiftpanda/Developer/popsdrops/src/app/(site)/(app)/b/campaigns/new/page.tsx`

- [ ] **Step 1: Write source contract test**

Create `/Users/swiftpanda/Developer/popsdrops/src/app/actions/campaigns-reporting-requirements.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const campaignsSource = readFileSync(
  new URL("./campaigns.ts", import.meta.url),
  "utf8",
);
const newCampaignSource = readFileSync(
  new URL("../(site)/(app)/b/campaigns/new/page.tsx", import.meta.url),
  "utf8",
);

describe("campaign reporting requirements creation", () => {
  it("builds defaults from deliverables when explicit requirements are absent", () => {
    expect(campaignsSource).toContain("buildDefaultCampaignReportingRequirements");
    expect(campaignsSource).toContain("reporting_requirements");
    expect(campaignsSource).toContain(".from(\"campaign_reporting_requirements\")");
  });

  it("creates a campaign reporting plan during campaign creation", () => {
    expect(campaignsSource).toContain(".from(\"campaign_reporting_plans\")");
    expect(campaignsSource).toContain("reporting_cadence");
  });

  it("passes reporting requirements from the campaign builder payload", () => {
    expect(newCampaignSource).toContain("reporting_requirements");
    expect(newCampaignSource).toContain("reporting_cadence");
  });
});
```

- [ ] **Step 2: Run failing contract test**

Run:

```bash
npx vitest run src/app/actions/campaigns-reporting-requirements.test.ts
```

Expected: fail.

- [ ] **Step 3: Persist requirements in server action**

Modify `/Users/swiftpanda/Developer/popsdrops/src/app/actions/campaigns.ts`:

```ts
import {
  buildDefaultCampaignReportingRequirements,
  validateRequirementMetricKeys,
} from "@/lib/reporting/requirements";
```

Change destructuring:

```ts
const {
  deliverables,
  campaign_mode,
  reporting_requirements,
  reporting_cadence,
  ...campaignData
} = parsed.data;
```

After deliverables are inserted, add:

```ts
const reportingRequirements =
  reporting_requirements?.length
    ? reporting_requirements
    : buildDefaultCampaignReportingRequirements(deliverables);

if (reportingRequirements.length > 0) {
  const invalidRequirement = reportingRequirements.find((requirement) =>
    validateRequirementMetricKeys({
      platform: requirement.platform,
      platformLabel: requirement.platformLabel,
      requiredMetricKeys: requirement.requiredMetricKeys,
    }).length > 0,
  );

  if (invalidRequirement) {
    throw new Error("Reporting requirement contains unsupported metrics.");
  }

  const { error: requirementError } = await supabase
    .from("campaign_reporting_requirements")
    .insert(
      reportingRequirements.map((requirement, index) => ({
        campaign_id: campaign.id,
        platform: requirement.platform,
        platform_label: requirement.platformLabel,
        content_format: requirement.contentFormat,
        account_requirement: requirement.accountRequirement,
        evidence_types: requirement.evidenceTypes,
        required_metric_keys: requirement.requiredMetricKeys,
        ai_extraction_allowed: requirement.aiExtractionAllowed,
        creator_confirmation_required: requirement.creatorConfirmationRequired,
        sort_order: requirement.sortOrder ?? index,
      })),
    );

  if (requirementError) throw new Error(requirementError.message);
}

const { error: planError } = await supabase
  .from("campaign_reporting_plans")
  .upsert({
    campaign_id: campaign.id,
    cadence: reporting_cadence ?? "final_only",
    required_evidence: ["post_url", "manual_metrics", "screenshot"],
    required_metrics: {},
    grace_period_hours: 24,
    starts_at: campaignData.posting_window_start ?? null,
    ends_at: campaignData.performance_due_date ?? null,
  });

if (planError) throw new Error(planError.message);
```

- [ ] **Step 4: Send default requirements from builder**

Modify `/Users/swiftpanda/Developer/popsdrops/src/app/(site)/(app)/b/campaigns/new/page.tsx`:

```ts
import { buildDefaultCampaignReportingRequirements } from "@/lib/reporting/requirements";
```

Inside `buildCampaignInput()`:

```ts
const mappedDeliverables = deliverables.map((d) => ({
  platform: platforms[0] || "tiktok",
  content_type: d.format as ContentFormat,
  quantity: d.quantity,
}));

return {
  ...
  deliverables: mappedDeliverables,
  reporting_cadence: "final_only",
  reporting_requirements: buildDefaultCampaignReportingRequirements(mappedDeliverables),
};
```

This is intentionally minimal UI. A richer platform matrix comes after the foundation works.

- [ ] **Step 5: Run campaign requirement tests**

Run:

```bash
npx vitest run src/app/actions/campaigns-reporting-requirements.test.ts src/lib/reporting/requirements.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit task 5**

Run:

```bash
git add src/app/actions/campaigns.ts src/app/actions/campaigns-reporting-requirements.test.ts 'src/app/(site)/(app)/b/campaigns/new/page.tsx'
git commit -m "feat: save campaign reporting requirements"
```

## Task 6: Creator Eligibility Preview Data and UI

**Files:**

- Create: `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/eligibility.ts`
- Create: `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/eligibility.test.ts`
- Modify: `/Users/swiftpanda/Developer/popsdrops/src/app/api/public/campaigns/[id]/route.ts`
- Modify: `/Users/swiftpanda/Developer/popsdrops/src/app/(site)/apply/[id]/page.tsx`
- Modify: `/Users/swiftpanda/Developer/popsdrops/src/app/(site)/apply/[id]/page-flow.test.ts`

- [ ] **Step 1: Write eligibility tests**

Create `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/eligibility.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { getCreatorReportingEligibility } from "./eligibility";

describe("creator reporting eligibility", () => {
  it("marks creator eligible when required platform is declared", () => {
    expect(
      getCreatorReportingEligibility({
        creatorPlatforms: ["instagram"],
        requirements: [
          {
            platform: "instagram",
            platformLabel: null,
            accountRequirement: "public_post_ok",
            evidenceTypes: ["public_url", "manual_metrics"],
            requiredMetricKeys: ["views", "likes"],
            contentFormat: "reel",
          },
        ],
      }),
    ).toMatchObject({ status: "eligible" });
  });

  it("asks for confirmation when native insights are required", () => {
    expect(
      getCreatorReportingEligibility({
        creatorPlatforms: ["instagram"],
        requirements: [
          {
            platform: "instagram",
            platformLabel: null,
            accountRequirement: "native_insights_required",
            evidenceTypes: ["screenshot"],
            requiredMetricKeys: ["reach"],
            contentFormat: "reel",
          },
        ],
      }),
    ).toMatchObject({
      status: "needs_confirmation",
      missingPlatforms: [],
    });
  });

  it("blocks application when a required named platform is missing", () => {
    expect(
      getCreatorReportingEligibility({
        creatorPlatforms: ["tiktok"],
        requirements: [
          {
            platform: "instagram",
            platformLabel: null,
            accountRequirement: "public_post_ok",
            evidenceTypes: ["public_url"],
            requiredMetricKeys: ["views"],
            contentFormat: "reel",
          },
        ],
      }),
    ).toMatchObject({
      status: "not_eligible",
      missingPlatforms: ["instagram"],
    });
  });

  it("lets generic requirements proceed with confirmation", () => {
    expect(
      getCreatorReportingEligibility({
        creatorPlatforms: [],
        requirements: [
          {
            platform: "generic",
            platformLabel: "Retail partner dashboard",
            accountRequirement: "brand_defined",
            evidenceTypes: ["screenshot"],
            requiredMetricKeys: ["views"],
            contentFormat: "dashboard",
          },
        ],
      }),
    ).toMatchObject({ status: "needs_confirmation" });
  });
});
```

- [ ] **Step 2: Run failing eligibility tests**

Run:

```bash
npx vitest run src/lib/reporting/eligibility.test.ts
```

Expected: fail.

- [ ] **Step 3: Implement eligibility helper**

Create `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/eligibility.ts`:

```ts
import type {
  ReportingAccountRequirement,
  ReportingEvidenceType,
  ReportingPlatform,
} from "./platform-templates";

export type EligibilityRequirement = {
  platform: ReportingPlatform;
  platformLabel: string | null;
  contentFormat: string;
  accountRequirement: ReportingAccountRequirement;
  evidenceTypes: ReportingEvidenceType[];
  requiredMetricKeys: string[];
};

export type CreatorReportingEligibility = {
  status: "eligible" | "needs_confirmation" | "not_eligible";
  missingPlatforms: ReportingPlatform[];
  confirmationReasons: string[];
};

export function getCreatorReportingEligibility(input: {
  creatorPlatforms: string[];
  requirements: EligibilityRequirement[];
}): CreatorReportingEligibility {
  const creatorPlatforms = new Set(input.creatorPlatforms);
  const missingPlatforms: ReportingPlatform[] = [];
  const confirmationReasons: string[] = [];

  for (const requirement of input.requirements) {
    if (requirement.platform !== "generic" && !creatorPlatforms.has(requirement.platform)) {
      missingPlatforms.push(requirement.platform);
      continue;
    }

    if (
      requirement.platform === "generic" ||
      requirement.accountRequirement !== "public_post_ok" ||
      requirement.evidenceTypes.some((type) =>
        ["screenshot", "analytics_export", "csv", "document"].includes(type),
      )
    ) {
      confirmationReasons.push(requirement.platform);
    }
  }

  if (missingPlatforms.length > 0) {
    return { status: "not_eligible", missingPlatforms, confirmationReasons };
  }

  return {
    status: confirmationReasons.length > 0 ? "needs_confirmation" : "eligible",
    missingPlatforms,
    confirmationReasons,
  };
}
```

- [ ] **Step 4: Include requirements in public campaign API**

Modify `/Users/swiftpanda/Developer/popsdrops/src/app/api/public/campaigns/[id]/route.ts` select:

```ts
campaign_reporting_requirements (
  platform,
  platform_label,
  content_format,
  account_requirement,
  evidence_types,
  required_metric_keys,
  ai_extraction_allowed,
  creator_confirmation_required,
  sort_order
)
```

Sort requirements before returning payload:

```ts
const reportingRequirements = Array.isArray(
  (campaignData as Record<string, unknown>).campaign_reporting_requirements,
)
  ? ((campaignData as Record<string, unknown>).campaign_reporting_requirements as Array<Record<string, unknown>>)
      .toSorted((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
  : [];
```

Add to payload:

```ts
reporting_requirements: reportingRequirements,
```

- [ ] **Step 5: Add compact eligibility preview to apply page**

Modify `/Users/swiftpanda/Developer/popsdrops/src/app/(site)/apply/[id]/page.tsx`:

```ts
import { getCreatorReportingEligibility } from "@/lib/reporting/eligibility";
import { getReportingPlatformLabel } from "@/lib/reporting/platform-templates";
```

Extend `CampaignPublic`:

```ts
reporting_requirements: {
  platform: string;
  platform_label: string | null;
  content_format: string;
  account_requirement: string;
  evidence_types: string[];
  required_metric_keys: string[];
}[];
```

Track creator platforms after profile load:

```ts
const [creatorPlatforms, setCreatorPlatforms] = useState<string[]>([]);
```

When logged-in user is creator, query `creator_profiles` platform columns and build a platform list from populated profile handles.

Render a section before the application CTA:

```tsx
{campaign.reporting_requirements.length > 0 && (
  <Card className="rounded-xl border-border shadow-sm">
    <CardContent className="space-y-3 p-4">
      <p className="text-sm font-semibold text-foreground">Reporting requirements</p>
      <div className="space-y-2">
        {campaign.reporting_requirements.map((requirement) => (
          <div
            key={`${requirement.platform}:${requirement.content_format}`}
            className="rounded-lg border border-border px-3 py-2"
          >
            <p className="text-sm font-medium text-foreground">
              {requirement.platform === "generic"
                ? requirement.platform_label || "Custom proof"
                : getReportingPlatformLabel(requirement.platform as never)}{" "}
              {requirement.content_format}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {requirement.evidence_types.includes("screenshot")
                ? "Screenshot evidence required"
                : "Public link and metrics required"}
            </p>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
)}
```

Use `getCreatorReportingEligibility()` to disable or label the apply CTA only when status is `not_eligible`. Keep copy short.

- [ ] **Step 6: Add apply page source smoke assertions**

Modify `/Users/swiftpanda/Developer/popsdrops/src/app/(site)/apply/[id]/page-flow.test.ts`:

```ts
expect(source).toContain("Reporting requirements");
expect(source).toContain("getCreatorReportingEligibility");
expect(source).toContain("reporting_requirements");
```

- [ ] **Step 7: Run eligibility tests**

Run:

```bash
npx vitest run src/lib/reporting/eligibility.test.ts 'src/app/(site)/apply/[id]/page-flow.test.ts'
```

Expected: pass.

- [ ] **Step 8: Commit task 6**

Run:

```bash
git add src/lib/reporting/eligibility.ts src/lib/reporting/eligibility.test.ts src/app/api/public/campaigns/'[id]'/route.ts src/app/'(site)'/apply/'[id]'/page.tsx src/app/'(site)'/apply/'[id]'/page-flow.test.ts
git commit -m "feat: show creator reporting eligibility"
```

## Task 7: Sparse Metric Values and AI Confirmation Scaffolding

**Files:**

- Create: `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/metric-values.ts`
- Create: `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/metric-values.test.ts`
- Modify: `/Users/swiftpanda/Developer/popsdrops/src/app/actions/content.ts`
- Create: `/Users/swiftpanda/Developer/popsdrops/src/app/actions/reporting-evidence.ts`
- Create: `/Users/swiftpanda/Developer/popsdrops/src/app/actions/reporting-evidence.test.ts`
- Modify: `/Users/swiftpanda/Developer/popsdrops/src/components/shared/performance-form.tsx`

- [ ] **Step 1: Write metric value tests**

Create `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/metric-values.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  buildMetricValueRows,
  mapMetricValuesToLegacyPerformanceColumns,
} from "./metric-values";

describe("reporting metric values", () => {
  it("maps common metric values into legacy report columns", () => {
    expect(
      mapMetricValuesToLegacyPerformanceColumns([
        { metricKey: "views", metricValue: 1200 },
        { metricKey: "likes", metricValue: 80 },
        { metricKey: "comments", metricValue: 12 },
        { metricKey: "shares", metricValue: 4 },
        { metricKey: "favorites", metricValue: 9 },
        { metricKey: "avg_watch_time_seconds", metricValue: 7.2 },
      ]),
    ).toEqual({
      views: 1200,
      likes: 80,
      comments: 12,
      shares: 4,
      saves: 9,
      avg_watch_time_seconds: 7.2,
    });
  });

  it("builds sparse metric rows with creator manual source", () => {
    const rows = buildMetricValueRows({
      performanceId: "performance-1",
      reportTaskId: "task-1",
      platform: "x",
      metricValues: [
        { metricKey: "impressions", metricLabel: "Impressions", metricValue: 15000 },
        { metricKey: "bookmarks", metricLabel: "Bookmarks", metricValue: 35 },
      ],
      sourceType: "creator_manual",
      confirmedByCreator: false,
    });

    expect(rows).toEqual([
      {
        performance_id: "performance-1",
        report_task_id: "task-1",
        platform: "x",
        metric_key: "impressions",
        metric_label: "Impressions",
        metric_value: 15000,
        metric_text: null,
        source_type: "creator_manual",
        confirmed_by_creator: false,
        confirmed_at: null,
      },
      {
        performance_id: "performance-1",
        report_task_id: "task-1",
        platform: "x",
        metric_key: "bookmarks",
        metric_label: "Bookmarks",
        metric_value: 35,
        metric_text: null,
        source_type: "creator_manual",
        confirmed_by_creator: false,
        confirmed_at: null,
      },
    ]);
  });
});
```

- [ ] **Step 2: Run failing metric tests**

Run:

```bash
npx vitest run src/lib/reporting/metric-values.test.ts
```

Expected: fail.

- [ ] **Step 3: Implement metric helper**

Create `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/metric-values.ts`:

```ts
import type {
  ReportingMetricSourceType,
  ReportingPlatform,
} from "@/types/database";

type SubmittedMetricValue = {
  metricKey: string;
  metricLabel?: string;
  metricValue?: number;
  metricText?: string;
};

const LEGACY_COLUMN_MAP: Record<string, string> = {
  views: "views",
  reach: "reach",
  impressions: "impressions",
  likes: "likes",
  reactions: "likes",
  comments: "comments",
  shares: "shares",
  saves: "saves",
  favorites: "saves",
  screenshots: "screenshots",
  replies: "replies",
  clicks: "clicks",
  link_clicks: "clicks",
  swipe_ups: "clicks",
  completion_rate: "completion_rate",
  avg_watch_time_seconds: "avg_watch_time_seconds",
  avg_view_duration_seconds: "avg_watch_time_seconds",
  avg_view_time_seconds: "avg_watch_time_seconds",
  subscribers_gained: "subscriber_gains",
  subscriber_gains: "subscriber_gains",
};

export function mapMetricValuesToLegacyPerformanceColumns(
  metricValues: SubmittedMetricValue[],
): Record<string, number> {
  const output: Record<string, number> = {};

  for (const metric of metricValues) {
    const legacyColumn = LEGACY_COLUMN_MAP[metric.metricKey];
    if (!legacyColumn || metric.metricValue == null) continue;
    output[legacyColumn] = metric.metricValue;
  }

  return output;
}

export function buildMetricValueRows(input: {
  performanceId: string;
  reportTaskId: string | null;
  platform: ReportingPlatform;
  metricValues: SubmittedMetricValue[];
  sourceType: ReportingMetricSourceType;
  confirmedByCreator: boolean;
}) {
  const confirmedAt = input.confirmedByCreator ? new Date().toISOString() : null;

  return input.metricValues.map((metric) => ({
    performance_id: input.performanceId,
    report_task_id: input.reportTaskId,
    platform: input.platform,
    metric_key: metric.metricKey,
    metric_label: metric.metricLabel ?? metric.metricKey,
    metric_value: metric.metricValue ?? null,
    metric_text: metric.metricText ?? null,
    source_type: input.sourceType,
    confirmed_by_creator: input.confirmedByCreator,
    confirmed_at: confirmedAt,
  }));
}
```

- [ ] **Step 4: Insert metric values on performance submit**

Modify `/Users/swiftpanda/Developer/popsdrops/src/app/actions/content.ts`:

```ts
import {
  buildMetricValueRows,
  mapMetricValuesToLegacyPerformanceColumns,
} from "@/lib/reporting/metric-values";
```

Destructure:

```ts
const { submission_id, report_task_id, metric_values, ...metrics } = input;
```

Before inserting `content_performance`:

```ts
const sparseMetricColumns = metric_values?.length
  ? mapMetricValuesToLegacyPerformanceColumns(metric_values)
  : {};
```

Insert:

```ts
...metrics,
...sparseMetricColumns,
```

After performance insert:

```ts
if (metric_values?.length) {
  const platform = submission.platform ?? "generic";
  const rows = buildMetricValueRows({
    performanceId: data.id,
    reportTaskId,
    platform: platform as never,
    metricValues: metric_values.map((metric) => ({
      metricKey: metric.metricKey,
      metricLabel: metric.metricLabel,
      metricValue: metric.metricValue,
      metricText: metric.metricText,
    })),
    sourceType: "creator_manual",
    confirmedByCreator: false,
  });

  const { error: metricValueError } = await supabase
    .from("content_performance_metric_values")
    .insert(rows);

  if (metricValueError) throw new Error(metricValueError.message);
}
```

Update the submission select to include `platform`:

```ts
.select("id, platform, campaign_member_id, campaign_members(campaign_id, creator_id)")
```

- [ ] **Step 5: Add AI extraction confirmation action**

Create `/Users/swiftpanda/Developer/popsdrops/src/app/actions/reporting-evidence.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildMetricValueRows } from "@/lib/reporting/metric-values";
import { getUser } from "./auth";

export async function confirmAiExtraction(input: {
  extractionId: string;
  performanceId: string;
  reportTaskId: string;
  platform: "instagram" | "tiktok" | "youtube" | "facebook" | "snapchat" | "x" | "generic";
  values: Array<{
    metricKey: string;
    metricLabel: string;
    metricValue?: number;
    metricText?: string;
  }>;
}) {
  const user = await getUser();
  const supabase = await createClient();

  const { data: extraction } = await supabase
    .from("content_performance_ai_extractions")
    .select("id, report_task_id, status")
    .eq("id", input.extractionId)
    .eq("report_task_id", input.reportTaskId)
    .single();

  if (!extraction) throw new Error("Extraction not found");
  if (extraction.status !== "pending_confirmation") {
    throw new Error("Extraction has already been resolved");
  }

  const rows = buildMetricValueRows({
    performanceId: input.performanceId,
    reportTaskId: input.reportTaskId,
    platform: input.platform,
    metricValues: input.values,
    sourceType: "creator_confirmed",
    confirmedByCreator: true,
  });

  const { error: upsertError } = await supabase
    .from("content_performance_metric_values")
    .upsert(rows, { onConflict: "performance_id,metric_key" });

  if (upsertError) throw new Error(upsertError.message);

  const { error: updateError } = await supabase
    .from("content_performance_ai_extractions")
    .update({
      status: "accepted_by_creator",
    })
    .eq("id", extraction.id);

  if (updateError) throw new Error(updateError.message);

  const { data: task } = await supabase
    .from("campaign_report_tasks")
    .select("campaign_id")
    .eq("id", input.reportTaskId)
    .single();

  if (task?.campaign_id) {
    revalidatePath(`/i/campaigns/${task.campaign_id}`);
    revalidatePath(`/b/campaigns/${task.campaign_id}`);
    revalidatePath(`/b/campaigns/${task.campaign_id}/report`);
  }

  return { ok: true, userId: user.id };
}
```

- [ ] **Step 6: Add action contract test**

Create `/Users/swiftpanda/Developer/popsdrops/src/app/actions/reporting-evidence.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./reporting-evidence.ts", import.meta.url),
  "utf8",
);

describe("reporting evidence actions", () => {
  it("keeps AI extraction separate until creator confirmation", () => {
    expect(source).toContain("content_performance_ai_extractions");
    expect(source).toContain("pending_confirmation");
    expect(source).toContain("creator_confirmed");
    expect(source).toContain("accepted_by_creator");
  });

  it("upserts confirmed values by performance and metric key", () => {
    expect(source).toContain(".from(\"content_performance_metric_values\")");
    expect(source).toContain("onConflict: \"performance_id,metric_key\"");
  });
});
```

- [ ] **Step 7: Update PerformanceForm payload**

Modify `/Users/swiftpanda/Developer/popsdrops/src/components/shared/performance-form.tsx` so `handleSubmit()` adds `metric_values`:

```ts
payload.metric_values = metrics
  .map((field) => {
    const val = parseMetricValue(field, values[field.key] || "");
    if (val === undefined) return null;
    return {
      platform,
      metricKey: field.key,
      metricLabel: field.label,
      metricValue: val,
    };
  })
  .filter(Boolean);
```

- [ ] **Step 8: Run metric and action tests**

Run:

```bash
npx vitest run src/lib/reporting/metric-values.test.ts src/app/actions/reporting-evidence.test.ts src/app/actions/content-report-tasks.test.ts
```

Expected: pass.

- [ ] **Step 9: Commit task 7**

Run:

```bash
git add src/lib/reporting/metric-values.ts src/lib/reporting/metric-values.test.ts src/app/actions/content.ts src/app/actions/reporting-evidence.ts src/app/actions/reporting-evidence.test.ts src/components/shared/performance-form.tsx
git commit -m "feat: record reporting metric values"
```

## Task 8: Report Aggregation Source Labels

**Files:**

- Modify: `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/campaign-report-metrics.ts`
- Modify: `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/campaign-report-metrics.test.ts`
- Modify: `/Users/swiftpanda/Developer/popsdrops/src/app/(site)/(app)/b/campaigns/[id]/report/page.tsx`
- Modify: `/Users/swiftpanda/Developer/popsdrops/src/app/(site)/(app)/b/campaigns/[id]/report/report-live-data-flow.test.ts`

- [ ] **Step 1: Add report metric source tests**

Append to `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/campaign-report-metrics.test.ts`:

```ts
it("labels report reads by strongest available data source", () => {
  const evidence = buildReportEvidenceMetric({
    reads: [
      {
        campaignMemberId: "member-1",
        platform: "instagram",
        reportedAt: "2026-05-10T10:00:00.000Z",
        views: 1000,
        likes: 80,
        comments: 10,
        shares: 5,
        screenshotUrl: "https://example.com/evidence.png",
        verificationStatus: "screenshot_verified",
        sourceType: "creator_confirmed",
      },
    ],
    tasks: [
      {
        dueAt: "2026-05-18T10:00:00.000Z",
        status: "submitted",
        submittedAt: "2026-05-17T10:00:00.000Z",
      },
    ],
  });

  expect(evidence.confidence).toBe("supported");
  expect(evidence.sourceLabels).toEqual(["AI extracted and creator confirmed"]);
});
```

- [ ] **Step 2: Run failing report metric tests**

Run:

```bash
npx vitest run src/lib/reporting/campaign-report-metrics.test.ts
```

Expected: fail because `sourceType` and `sourceLabels` are not typed.

- [ ] **Step 3: Add source label support**

Modify `/Users/swiftpanda/Developer/popsdrops/src/lib/reporting/campaign-report-metrics.ts`:

```ts
export interface CampaignReportRead {
  ...
  sourceType?: string | null;
}
```

Extend `ReportEvidenceMetric`:

```ts
sourceLabels: string[];
```

Add:

```ts
function sourceLabel(sourceType: string | null | undefined): string {
  if (sourceType === "creator_confirmed") return "AI extracted and creator confirmed";
  if (sourceType === "ai_extracted") return "AI extracted, waiting for creator";
  if (sourceType === "brand_verified") return "Brand verified";
  if (sourceType === "platform_api") return "Platform API verified";
  return "Manual entry";
}
```

Return:

```ts
sourceLabels: Array.from(new Set(reads.map((read) => sourceLabel(read.sourceType)))),
```

- [ ] **Step 4: Include source type in report page query**

Modify `/Users/swiftpanda/Developer/popsdrops/src/app/(site)/(app)/b/campaigns/[id]/report/page.tsx` where `content_performance` rows are selected. Include nested metric values:

```ts
content_performance_metric_values (
  source_type,
  metric_key,
  metric_label,
  metric_value,
  confirmed_by_creator
)
```

When mapping reads, set:

```ts
sourceType:
  Array.isArray(performance.content_performance_metric_values) &&
  performance.content_performance_metric_values.some((value) => value.source_type === "creator_confirmed")
    ? "creator_confirmed"
    : performance.data_source,
```

- [ ] **Step 5: Add report source label source test**

Modify `/Users/swiftpanda/Developer/popsdrops/src/app/(site)/(app)/b/campaigns/[id]/report/report-live-data-flow.test.ts`:

```ts
expect(reportPageSource).toContain("content_performance_metric_values");
expect(reportPageSource).toContain("source_type");
```

- [ ] **Step 6: Run report tests**

Run:

```bash
npx vitest run src/lib/reporting/campaign-report-metrics.test.ts 'src/app/(site)/(app)/b/campaigns/[id]/report/report-live-data-flow.test.ts'
```

Expected: pass.

- [ ] **Step 7: Commit task 8**

Run:

```bash
git add src/lib/reporting/campaign-report-metrics.ts src/lib/reporting/campaign-report-metrics.test.ts src/app/'(site)'/'(app)'/b/campaigns/'[id]'/report/page.tsx src/app/'(site)'/'(app)'/b/campaigns/'[id]'/report/report-live-data-flow.test.ts
git commit -m "feat: label report metric sources"
```

## Task 9: Verification and Browser Smoke

**Files:**

- Create: `/Users/swiftpanda/Developer/popsdrops/script/smoke-reporting-evidence.cjs`
- Optional screenshots: `/Users/swiftpanda/Developer/popsdrops/output/playwright/reporting-evidence-*.png`

- [ ] **Step 1: Run focused unit suite**

Run:

```bash
npx vitest run \
  src/lib/reporting/platform-templates.test.ts \
  src/lib/reporting/requirements.test.ts \
  src/lib/reporting/eligibility.test.ts \
  src/lib/reporting/metric-values.test.ts \
  src/lib/reporting/task-schedule.test.ts \
  src/lib/reporting/campaign-report-metrics.test.ts \
  src/lib/supabase/reporting-evidence-templates-migration.test.ts \
  src/app/actions/campaigns-reporting-requirements.test.ts \
  src/app/actions/content-report-tasks.test.ts \
  src/app/actions/reporting-evidence.test.ts \
  'src/app/(site)/apply/[id]/page-flow.test.ts' \
  'src/app/(site)/(app)/b/campaigns/[id]/report/report-live-data-flow.test.ts'
```

Expected: all pass.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: exit code 0.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: exit code 0.

- [ ] **Step 4: Create Playwright smoke script**

Create `/Users/swiftpanda/Developer/popsdrops/script/smoke-reporting-evidence.cjs`:

```js
const { chromium } = require("playwright");

async function main() {
  const baseUrl = process.env.POPSDROPS_BASE_URL || "http://localhost:3000";
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  await page.goto(`${baseUrl}/auth/dev-login?role=brand`, { waitUntil: "networkidle" });
  await page.goto(`${baseUrl}/b/campaigns/new`, { waitUntil: "networkidle" });
  await page.screenshot({
    path: "/Users/swiftpanda/Developer/popsdrops/output/playwright/reporting-evidence-builder.png",
    fullPage: true,
  });

  const pageText = await page.locator("body").innerText();
  if (!pageText.includes("Create Campaign")) {
    throw new Error("Campaign builder did not load");
  }

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 5: Start dev server if needed**

Run:

```bash
npm run dev
```

Expected: local Next dev server available at `http://localhost:3000`. If port 3000 is busy, use the active port and set `POPSDROPS_BASE_URL`.

- [ ] **Step 6: Run smoke script**

Run:

```bash
node script/smoke-reporting-evidence.cjs
```

Expected: script exits 0 and writes `output/playwright/reporting-evidence-builder.png`.

- [ ] **Step 7: Commit smoke script**

Run:

```bash
git add script/smoke-reporting-evidence.cjs
git commit -m "test: add reporting evidence smoke"
```

## Self-Review Checklist

- [ ] The plan implements every foundation requirement from the spec except live Gemini calls, full binary upload UI, and export redesign, which are explicitly deferred.
- [ ] The seven-template reporting model is represented in TypeScript, database seed definitions, campaign requirements, and tests.
- [ ] X and Generic are reporting templates only, not product OAuth platforms.
- [ ] AI extraction records are separate from confirmed metric values.
- [ ] Creator confirmation is required before AI values affect reports.
- [ ] Report source labels exist.
- [ ] RLS policies are present for all new tables.
- [ ] No user-facing flow depends on manual PopsDrops intervention.
- [ ] No em dash characters are introduced.
- [ ] No small-product or prototype framing is introduced.
- [ ] Every test command has an expected result.

## Execution Recommendation

Use inline execution for this plan in the current session. The working tree is already very dirty, so spawning broad parallel workers would create avoidable merge pressure. Commit after each task exactly as listed.
