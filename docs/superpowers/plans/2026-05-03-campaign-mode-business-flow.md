# Campaign Mode Business Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist and verify the Private vs Sourced campaign operating model so pricing, sourcing expectations, UI copy, and future Stripe Checkout work all depend on server-derived business rules.

**Architecture:** Extract campaign service packages into a shared library, validate campaign mode in the campaign schema, derive billing/sourcing fields inside the server action, persist those fields on `campaigns`, and have the campaign builder render package details from the same catalog. This gives us one source of truth before adding Stripe Checkout.

**Tech Stack:** Next.js Server Actions, Supabase Postgres migrations, TypeScript, Zod, Vitest, Tailwind/shadcn UI, static i18n bundles.

---

## File Structure

- Create `src/lib/campaign-service-packages.ts`: campaign mode catalog, prices, included scope, and server-safe persistence helpers.
- Create `src/lib/campaign-service-packages.test.ts`: unit tests for package prices, sourcing flags, and insert-field derivation.
- Create `supabase/migrations/023_campaign_service_packages.sql`: add `campaign_mode_type` enum and campaign service fee/status/snapshot columns.
- Modify `src/types/database.ts`: add `CampaignModeType` and campaign column types matching the migration.
- Modify `src/lib/validations.ts`: accept `campaign_mode` and reject invalid values before Server Action work.
- Modify `src/app/actions/campaigns.ts`: derive service fee fields from `campaign_mode` server-side and persist them.
- Modify `src/app/(site)/(app)/b/campaigns/new/page.tsx`: replace local package definitions with the shared package catalog and submit `campaign_mode`.
- Modify `src/lib/i18n/strings.ts` and `src/lib/i18n/generated/platform-bundles/en.json`: update signed-in brand package copy to show real service fees and scope.

## Task 1: Encode Campaign Service Packages

**Files:**
- Create: `src/lib/campaign-service-packages.ts`
- Create: `src/lib/campaign-service-packages.test.ts`

- [ ] **Step 1: Write the failing package tests**

```ts
import { describe, expect, it } from "vitest";

import {
  CAMPAIGN_SERVICE_PACKAGES,
  getCampaignServiceInsertFields,
  getCampaignServicePackage,
} from "./campaign-service-packages";

describe("campaign service packages", () => {
  it("defines private and sourced packages with launch prices", () => {
    expect(CAMPAIGN_SERVICE_PACKAGES.private.feeCents).toBe(14_900);
    expect(CAMPAIGN_SERVICE_PACKAGES.sourced.feeCents).toBe(49_900);
  });

  it("marks sourced campaigns as requiring creator sourcing", () => {
    expect(getCampaignServicePackage("private").creatorSourcingRequired).toBe(false);
    expect(getCampaignServicePackage("sourced").creatorSourcingRequired).toBe(true);
  });

  it("derives immutable insert fields from the selected mode", () => {
    expect(getCampaignServiceInsertFields("private")).toMatchObject({
      campaign_mode: "private",
      creator_sourcing_required: false,
      service_fee_cents: 14_900,
      service_fee_currency: "usd",
      service_fee_status: "pending",
    });
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run src/lib/campaign-service-packages.test.ts`

Expected: FAIL because `src/lib/campaign-service-packages.ts` does not exist.

- [ ] **Step 3: Add the package catalog**

```ts
export const CAMPAIGN_MODES = ["private", "sourced"] as const;

export type CampaignMode = (typeof CAMPAIGN_MODES)[number];

type CampaignServicePackage = {
  mode: CampaignMode;
  feeCents: number;
  currency: "usd";
  creatorSourcingRequired: boolean;
  titleKey: string;
  descKey: string;
  feeKey: string;
  scopeKeys: readonly string[];
};

export const CAMPAIGN_SERVICE_PACKAGES: Record<CampaignMode, CampaignServicePackage> = {
  private: {
    mode: "private",
    feeCents: 14_900,
    currency: "usd",
    creatorSourcingRequired: false,
    titleKey: "mode.private",
    descKey: "mode.private.desc",
    feeKey: "mode.private.fee",
    scopeKeys: [
      "mode.private.scope.workspace",
      "mode.private.scope.invite",
      "mode.private.scope.report",
    ],
  },
  sourced: {
    mode: "sourced",
    feeCents: 49_900,
    currency: "usd",
    creatorSourcingRequired: true,
    titleKey: "mode.sourced",
    descKey: "mode.sourced.desc",
    feeKey: "mode.sourced.fee",
    scopeKeys: [
      "mode.sourced.scope.shortlist",
      "mode.sourced.scope.workspace",
      "mode.sourced.scope.report",
    ],
  },
};

export function getCampaignServicePackage(mode: CampaignMode) {
  return CAMPAIGN_SERVICE_PACKAGES[mode];
}

export function formatCampaignServiceFee(feeCents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(feeCents / 100);
}

export function getCampaignServiceInsertFields(mode: CampaignMode) {
  const servicePackage = getCampaignServicePackage(mode);

  return {
    campaign_mode: servicePackage.mode,
    creator_sourcing_required: servicePackage.creatorSourcingRequired,
    service_fee_cents: servicePackage.feeCents,
    service_fee_currency: servicePackage.currency,
    service_fee_status: "pending" as const,
    service_package_snapshot: {
      mode: servicePackage.mode,
      feeCents: servicePackage.feeCents,
      currency: servicePackage.currency,
      creatorSourcingRequired: servicePackage.creatorSourcingRequired,
      scopeKeys: [...servicePackage.scopeKeys],
    },
  };
}
```

- [ ] **Step 4: Run the test and verify GREEN**

Run: `npx vitest run src/lib/campaign-service-packages.test.ts`

Expected: PASS.

## Task 2: Add Database Persistence

**Files:**
- Create: `supabase/migrations/023_campaign_service_packages.sql`
- Modify: `src/types/database.ts`

- [ ] **Step 1: Add the migration**

```sql
CREATE TYPE campaign_mode_type AS ENUM ('private', 'sourced');

ALTER TABLE campaigns
  ADD COLUMN campaign_mode campaign_mode_type NOT NULL DEFAULT 'sourced',
  ADD COLUMN creator_sourcing_required boolean NOT NULL DEFAULT true,
  ADD COLUMN service_fee_cents integer NOT NULL DEFAULT 49900 CHECK (service_fee_cents >= 0),
  ADD COLUMN service_fee_currency text NOT NULL DEFAULT 'usd' CHECK (service_fee_currency = lower(service_fee_currency)),
  ADD COLUMN service_fee_status payment_status_type NOT NULL DEFAULT 'pending',
  ADD COLUMN service_package_snapshot jsonb NOT NULL DEFAULT '{"mode":"sourced","feeCents":49900,"currency":"usd","creatorSourcingRequired":true,"scopeKeys":[]}'::jsonb;

CREATE INDEX idx_campaigns_campaign_mode ON campaigns(campaign_mode);
CREATE INDEX idx_campaigns_service_fee_status ON campaigns(service_fee_status);

COMMENT ON COLUMN campaigns.campaign_mode IS 'PopsDrops operating model: private means brand brings creators; sourced means PopsDrops helps source creators.';
COMMENT ON COLUMN campaigns.creator_sourcing_required IS 'True when PopsDrops sourcing work is part of the campaign service package.';
COMMENT ON COLUMN campaigns.service_fee_cents IS 'PopsDrops platform service fee in minor currency units, derived server-side from campaign_mode at creation time.';
COMMENT ON COLUMN campaigns.service_fee_status IS 'Payment status for PopsDrops platform service fee. This does not represent creator payout handling.';
COMMENT ON COLUMN campaigns.service_package_snapshot IS 'Immutable launch package details captured when the campaign was created.';
```

- [ ] **Step 2: Update generated database types manually**

Add `export type CampaignModeType = 'private' | 'sourced';` near the enum aliases.

Add these fields to `campaigns.Row`:

```ts
campaign_mode: CampaignModeType;
creator_sourcing_required: boolean;
service_fee_cents: number;
service_fee_currency: string;
service_fee_status: PaymentStatusType;
service_package_snapshot: Record<string, unknown>;
```

Add optional versions of the same fields to `campaigns.Insert` and `campaigns.Update`.

Add `campaign_mode_type: CampaignModeType;` to `Database["public"]["Enums"]`.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

## Task 3: Validate and Persist Campaign Mode

**Files:**
- Modify: `src/lib/validations.ts`
- Modify: `src/app/actions/campaigns.ts`
- Create: `src/lib/validations.test.ts` if no existing validation test is suitable.

- [ ] **Step 1: Write failing validation tests**

```ts
import { describe, expect, it } from "vitest";

import { createCampaignSchema } from "./validations";

const validCampaignInput = {
  title: "Launch Campaign",
  campaign_mode: "private",
  brief_description: "A clear campaign brief for creators.",
  platforms: ["tiktok"],
  markets: ["south_korea"],
  niches: ["beauty"],
  budget_min: 100,
  budget_max: 500,
  max_creators: 3,
  application_deadline: "2026-06-01",
  content_due_date: "2026-06-15",
  usage_rights_paid_ads: false,
  max_revisions: 2,
  deliverables: [{ platform: "tiktok", content_type: "short_video", quantity: 1 }],
};

describe("createCampaignSchema campaign mode", () => {
  it("accepts a valid campaign mode", () => {
    expect(createCampaignSchema.safeParse(validCampaignInput).success).toBe(true);
  });

  it("rejects unknown campaign modes", () => {
    const result = createCampaignSchema.safeParse({
      ...validCampaignInput,
      campaign_mode: "marketplace",
    });

    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the validation test and verify RED**

Run: `npx vitest run src/lib/validations.test.ts`

Expected: FAIL because `campaign_mode` is not yet part of `createCampaignSchema`.

- [ ] **Step 3: Add campaign mode validation**

Import `CAMPAIGN_MODES` from `./campaign-service-packages`, add `const campaignModeEnum = z.enum(CAMPAIGN_MODES);`, add `campaign_mode: campaignModeEnum.default("sourced")` to `createCampaignSchema`, and export the inferred type as before.

- [ ] **Step 4: Derive service fields inside `createCampaign`**

Import `getCampaignServiceInsertFields` and `type CampaignMode`.

Change the `createCampaign` input type to include:

```ts
campaign_mode: CampaignMode;
```

When inserting `campaigns`, derive service fields server-side:

```ts
const { deliverables, campaign_mode, ...campaignData } = parsed.data;
const serviceFields = getCampaignServiceInsertFields(campaign_mode);

const { data: campaign, error: campaignError } = await supabase
  .from("campaigns")
  .insert({
    brand_id: user.id,
    ...campaignData,
    ...serviceFields,
    status: "draft",
  })
  .select("id")
  .single();
```

- [ ] **Step 5: Run tests and typecheck**

Run:

```bash
npx vitest run src/lib/campaign-service-packages.test.ts src/lib/validations.test.ts
npm run typecheck
```

Expected: PASS.

## Task 4: Wire Campaign Builder UI to the Business Catalog

**Files:**
- Modify: `src/app/(site)/(app)/b/campaigns/new/page.tsx`
- Modify: `src/lib/i18n/strings.ts`
- Modify: `src/lib/i18n/generated/platform-bundles/en.json`

- [ ] **Step 1: Replace local mode catalog**

Import:

```ts
import {
  CAMPAIGN_SERVICE_PACKAGES,
  formatCampaignServiceFee,
  type CampaignMode,
} from "@/lib/campaign-service-packages";
```

Remove the local `campaignModes` array and build UI options from `Object.values(CAMPAIGN_SERVICE_PACKAGES)`.

- [ ] **Step 2: Show price and scope in mode cards**

Each mode card should show the translated title, translated description, `formatCampaignServiceFee(mode.feeCents)`, translated fee detail, and three translated scope chips from `mode.scopeKeys`.

- [ ] **Step 3: Submit the selected mode**

Add `campaign_mode: campaignMode` to `buildCampaignInput()`.

- [ ] **Step 4: Update review warning and success copy**

Keep separate publish warnings:

- Private: creates a private campaign workspace and invite link.
- Sourced: sends the campaign into PopsDrops sourcing review before creator shortlisting.

- [ ] **Step 5: Run focused verification**

Run:

```bash
npm run typecheck
npm run test -- src/lib/campaign-service-packages.test.ts src/lib/validations.test.ts
```

Expected: PASS.

## Task 5: Full Validation and Smoke Tests

**Files:**
- No required file changes unless verification exposes a bug.

- [ ] **Step 1: Run full static verification**

Run:

```bash
npm run lint
npm run typecheck
npm run test
```

Expected: all commands exit 0.

- [ ] **Step 2: Build**

Run: `npm run build`

Expected: build exits 0 with no Next.js middleware-to-proxy deprecation warning, compile errors, or route errors.

- [ ] **Step 3: Browser smoke test desktop**

Use the in-app browser at desktop width. Visit `/dev/login`, sign in as brand, navigate to `/b/campaigns/new`, and verify:

- The page shows Private Campaign and Sourced Campaign.
- Private Campaign shows `$149`.
- Sourced Campaign shows `$499`.
- Selecting either mode keeps the selection visible when choosing a playbook.
- Review step shows the selected campaign type.

If local Supabase dev login fails because environment variables are missing, record that blocker and smoke-test the public reachable routes only.

- [ ] **Step 4: Browser smoke test mobile width**

Use the in-app browser at mobile width for `/login` and creator-facing public/auth screens. Verify the intentional luxury dark mobile styling still renders and no UI text overlaps.

- [ ] **Step 5: Completion evidence**

Before claiming completion, report exact command results, browser smoke evidence, and any blocker such as missing local Supabase service-role credentials.
