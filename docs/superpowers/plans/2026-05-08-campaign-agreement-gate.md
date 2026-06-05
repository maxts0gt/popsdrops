# Campaign Agreement Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a campaign agreement gate so accepted creators must acknowledge campaign rules or sign a brand-provided agreement before campaign room access, submissions, reporting, and private assets unlock.

**Architecture:** Supabase owns durable agreement tables, RLS, Storage, and status views. Next.js owns brand setup, public preview, creator gate UI, and thin server actions. Mobile reads the same status and blocks the same room actions so the web and Expo creator experiences stay aligned.

**Tech Stack:** Next.js App Router, Supabase Postgres/RLS/Storage, React Hook Form plus Zod-style validation, Vitest contract tests, Tailwind/shadcn, Expo React Native, Codex in-app browser smoke.

---

## Context Notes

- Approved spec: `docs/superpowers/specs/2026-05-08-campaign-agreement-gate-design.md`.
- Supabase changelog checked on 2026-05-08. New public tables may not be exposed to the Data API automatically, so every new public table/view needs explicit `GRANT` plus RLS.
- Supabase Storage policies are on `storage.objects`, so agreement file access must be backed by metadata rows and helper functions, not public bucket URLs.
- Existing helper schema `app_private` already contains campaign brand/member helpers and UUID path parsing. Reuse that pattern.
- Existing creator reporting is evidence-first. Do not add social tokens, cron jobs, token refreshers, or platform metric fetchers.
- All user-facing strings go through `src/lib/i18n/strings.ts` and generated English platform bundle.
- Do not use forbidden decorative icons. Use `ShieldCheck`, `FileText`, `CheckCircle2`, or `PenLine` only where literal.

## File Structure

Create:

- Supabase migration file created by `supabase migration new campaign_agreement_gate`: agreement tables, status view, RLS, Storage bucket, Storage policies, grants.
- `src/lib/supabase/campaign-agreement-gate-migration.test.ts`: migration contract tests.
- `src/lib/agreements/campaign-agreement.ts`: agreement rules model, default rules builder, content hash, status helpers.
- `src/lib/agreements/campaign-agreement.test.ts`: domain helper tests.
- `src/lib/agreements/agreement-upload.ts`: PDF validation, file name sanitization, Storage path helpers.
- `src/lib/agreements/agreement-upload.test.ts`: upload helper tests.
- `src/app/actions/campaign-agreements.ts`: brand draft/publish actions, upload preparation, creator acceptance, signed URL action.
- `src/app/actions/campaign-agreements.test.ts`: server-action contract tests.
- `src/components/campaigns/agreement-gate.tsx`: creator web gate UI.
- `src/components/campaigns/brand-agreement-panel.tsx`: brand setup and status UI.
- `src/components/campaigns/agreement-status-cell.tsx`: sortable status display for member tables.

Modify:

- `shared/validations.ts`: agreement schemas shared by web and mobile where practical.
- `src/lib/validations.ts`: re-export shared validation additions.
- `src/types/database.ts`: generated or hand-updated database types for new tables/view.
- `src/app/api/public/campaigns/[id]/route.ts`: return safe agreement preview fields.
- `src/app/(site)/apply/[id]/page.tsx`: show compact gate preview before application.
- `src/app/(site)/(app)/b/campaigns/[id]/page.tsx`: brand agreement panel and member agreement status.
- `src/app/(site)/(app)/b/campaigns/[id]/page-flow.test.ts`: brand workspace contract checks.
- `src/app/(site)/(app)/b/campaigns/new/page.tsx`: add Agreement Gate block in Review and Launch, immediately after the Creative Kit summary.
- `src/app/(site)/(app)/b/campaigns/new/page-flow.test.ts`: builder contract checks.
- `src/app/(site)/(app)/i/campaigns/[id]/page.tsx`: creator gate before room tabs.
- `src/app/(site)/(app)/i/campaigns/[id]/report-task-flow.test.ts`: creator gate contract checks.
- `src/app/actions/content.ts`: block submit, publish, and performance actions when agreement is pending.
- `src/app/actions/reporting-evidence.ts`: block evidence upload when agreement is pending.
- `src/lib/i18n/strings.ts`: new strings.
- `src/lib/i18n/generated/platform-bundles/en.json`: English generated bundle update for tests.
- `mobile/lib/campaign-room.ts`: load agreement status and agreement preview for accepted campaigns.
- `mobile/lib/campaign-actions.ts`: accept agreement and block direct submit/publish when unsigned.
- `mobile/app/campaign-room/[id].tsx`: render mobile gate before room tabs.
- `mobile/app/campaign/[id].tsx`: show compact requirements preview before applying.
- `mobile/lib/strings.ts` and `mobile/lib/generated/mobile-bundles/en.json`: mobile strings.

## Task 1: Database Foundation

**Files:**

- Create: `src/lib/supabase/campaign-agreement-gate-migration.test.ts`
- Create: Supabase migration file printed by `supabase migration new campaign_agreement_gate`
- Modify: `src/types/database.ts`

- [ ] **Step 1: Create migration contract tests**

Add `src/lib/supabase/campaign-agreement-gate-migration.test.ts`:

```ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = new URL("../../../supabase/migrations", import.meta.url);
const migrationSource = readdirSync(migrationsDir)
  .filter((fileName) => fileName.endsWith(".sql"))
  .map((fileName) => readFileSync(join(migrationsDir.pathname, fileName), "utf8"))
  .join("\n");

describe("campaign agreement gate migration", () => {
  it("creates versioned agreements and immutable creator acceptances", () => {
    expect(migrationSource).toContain("create table if not exists public.campaign_agreements");
    expect(migrationSource).toContain("create table if not exists public.campaign_agreement_acceptances");
    expect(migrationSource).toContain("campaign_agreement_acceptances_active_unique");
    expect(migrationSource).toContain("accepted_content_hash");
    expect(migrationSource).toContain("typed_name text not null");
  });

  it("exposes agreement tables deliberately with RLS enabled", () => {
    expect(migrationSource).toContain("alter table public.campaign_agreements enable row level security");
    expect(migrationSource).toContain("alter table public.campaign_agreement_acceptances enable row level security");
    expect(migrationSource).toContain("grant select, insert, update on table public.campaign_agreements");
    expect(migrationSource).toContain("grant select, insert on table public.campaign_agreement_acceptances");
  });

  it("uses a security invoker member status view", () => {
    expect(migrationSource).toContain("create or replace view public.campaign_member_agreement_status");
    expect(migrationSource).toContain("with (security_invoker = true)");
    expect(migrationSource).toContain("'needs_reacceptance'");
  });

  it("protects agreement files with a private Storage bucket", () => {
    expect(migrationSource).toContain("'campaign-agreements'");
    expect(migrationSource).toContain("can_read_campaign_agreement_object");
    expect(migrationSource).toContain("can_write_campaign_agreement_object");
    expect(migrationSource).toContain("campaign_agreements_objects_select");
    expect(migrationSource).toContain("campaign_agreements_objects_insert");
  });

  it("blocks protected creator work while agreement signature is pending", () => {
    expect(migrationSource).toContain("campaign_member_has_required_agreement");
    expect(migrationSource).toContain("current_user_has_campaign_agreement_access");
    expect(migrationSource).toContain("content_submissions_insert_creator");
    expect(migrationSource).toContain("content_submissions_update_creator");
    expect(migrationSource).toContain("content_performance_insert_creator");
    expect(migrationSource).toContain("content_performance_update_creator");
  });

  it("keeps private campaign assets locked until the accepted creator signs", () => {
    expect(migrationSource).toContain("campaign_assets_select_access");
    expect(migrationSource).toContain("can_read_campaign_asset_object");
    expect(migrationSource).toContain("current_user_has_campaign_agreement_access(asset.campaign_id)");
  });

  it("does not introduce cron, token refresh, or social platform fetchers", () => {
    expect(migrationSource).not.toContain("pg_cron");
    expect(migrationSource).not.toContain("refresh_tokens");
    expect(migrationSource).not.toContain("social_oauth");
  });
});
```

- [ ] **Step 2: Run migration test to verify it fails**

Run:

```bash
npm test -- src/lib/supabase/campaign-agreement-gate-migration.test.ts
```

Expected: FAIL because `campaign_agreements` does not exist yet.

- [ ] **Step 3: Create the migration file**

Run:

```bash
supabase migration new campaign_agreement_gate
```

Expected: Supabase prints a new file path under `supabase/migrations/`. Use that generated file, then paste the SQL below.

- [ ] **Step 4: Add agreement tables, helper functions, view, bucket, policies, and grants**

Add this SQL to the generated migration file:

```sql
-- Campaign agreement gate.
-- Brands configure rules and optional PDF agreements.
-- Accepted creators must sign before protected campaign work unlocks.

create schema if not exists app_private;

create table if not exists public.campaign_agreements (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  version integer not null,
  status text not null default 'draft',
  gate_mode text not null,
  title text not null,
  rules jsonb not null default '{}'::jsonb,
  agreement_body text,
  preview_enabled boolean not null default false,
  preview_summary jsonb not null default '{}'::jsonb,
  file_bucket text,
  file_path text,
  file_name text,
  file_mime_type text,
  file_size_bytes bigint,
  file_sha256 text,
  content_hash text not null,
  requires_typed_name boolean not null default true,
  requires_reacceptance boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_agreements_status_check check (
    status in ('draft', 'published', 'archived')
  ),
  constraint campaign_agreements_gate_mode_check check (
    gate_mode in (
      'rules_acknowledgement',
      'typed_signature',
      'brand_agreement',
      'rules_and_brand_agreement'
    )
  ),
  constraint campaign_agreements_version_unique unique (campaign_id, version),
  constraint campaign_agreements_id_campaign_unique unique (id, campaign_id),
  constraint campaign_agreements_bucket_check check (
    file_bucket is null or file_bucket = 'campaign-agreements'
  ),
  constraint campaign_agreements_pdf_check check (
    file_mime_type is null or file_mime_type = 'application/pdf'
  ),
  constraint campaign_agreements_file_size_check check (
    file_size_bytes is null or file_size_bytes > 0
  ),
  constraint campaign_agreements_file_path_check check (
    file_path is null or (
      app_private.uuid_path_segment(file_path, 1) = campaign_id
      and app_private.uuid_path_segment(file_path, 2) = id
    )
  )
);

comment on table public.campaign_agreements is
  'Versioned campaign rules and brand-provided agreement gate for accepted creators.';

create unique index if not exists campaign_agreements_one_published_idx
  on public.campaign_agreements (campaign_id)
  where status = 'published';

create index if not exists campaign_agreements_campaign_status_idx
  on public.campaign_agreements (campaign_id, status, version desc);

create table if not exists public.campaign_agreement_acceptances (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.campaign_agreements(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_member_id uuid references public.campaign_members(id) on delete cascade,
  application_id uuid references public.campaign_applications(id) on delete set null,
  creator_id uuid not null references public.profiles(id),
  typed_name text not null,
  accepted_rules jsonb not null default '{}'::jsonb,
  accepted_content_hash text not null,
  accepted_version integer not null,
  ip_hash text,
  user_agent text,
  accepted_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint campaign_agreement_acceptances_name_check check (length(trim(typed_name)) >= 2),
  constraint campaign_agreement_acceptances_scope_fkey foreign key (
    agreement_id,
    campaign_id
  ) references public.campaign_agreements (
    id,
    campaign_id
  ) on delete cascade
);

create unique index if not exists campaign_agreement_acceptances_active_unique
  on public.campaign_agreement_acceptances (agreement_id, creator_id)
  where revoked_at is null;

create index if not exists campaign_agreement_acceptances_campaign_creator_idx
  on public.campaign_agreement_acceptances (campaign_id, creator_id, accepted_at desc);

alter table public.campaign_agreements enable row level security;
alter table public.campaign_agreement_acceptances enable row level security;

create or replace function app_private.published_campaign_agreement(campaign_uuid uuid)
returns table (
  agreement_id uuid,
  agreement_version integer,
  agreement_hash text,
  agreement_requires_reacceptance boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id, version, content_hash, requires_reacceptance
    from public.campaign_agreements
   where campaign_id = campaign_uuid
     and status = 'published'
   order by version desc
   limit 1;
$$;

create or replace function app_private.campaign_member_has_required_agreement(member_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with member_row as (
    select id, campaign_id, creator_id
      from public.campaign_members
     where id = member_uuid
  ),
  agreement_row as (
    select *
      from app_private.published_campaign_agreement(
        (select campaign_id from member_row)
      )
  )
  select
    not exists (select 1 from agreement_row)
    or exists (
      select 1
        from public.campaign_agreement_acceptances acceptance
        join agreement_row agreement on agreement.agreement_id = acceptance.agreement_id
       where acceptance.campaign_member_id = (select id from member_row)
         and acceptance.creator_id = (select creator_id from member_row)
         and acceptance.revoked_at is null
         and acceptance.accepted_content_hash = agreement.agreement_hash
         and (
           agreement.agreement_requires_reacceptance = false
           or acceptance.accepted_version = agreement.agreement_version
         )
    );
$$;

create or replace function app_private.current_user_has_campaign_agreement_access(campaign_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.campaign_members member
     where member.campaign_id = campaign_uuid
       and member.creator_id = auth.uid()
       and app_private.campaign_member_has_required_agreement(member.id)
  )
  or not exists (
    select 1
      from public.campaign_agreements agreement
     where agreement.campaign_id = campaign_uuid
       and agreement.status = 'published'
  );
$$;

create or replace view public.campaign_member_agreement_status
with (security_invoker = true)
as
select
  member.campaign_id,
  member.id as campaign_member_id,
  member.creator_id,
  agreement.id as agreement_id,
  agreement.version as agreement_version,
  case
    when agreement.id is null then 'not_required'
    when acceptance.id is null then 'pending'
    when acceptance.accepted_content_hash <> agreement.content_hash then 'needs_reacceptance'
    when agreement.requires_reacceptance and acceptance.accepted_version <> agreement.version then 'needs_reacceptance'
    else 'signed'
  end as status,
  acceptance.accepted_at,
  acceptance.typed_name
from public.campaign_members member
left join lateral (
  select *
    from public.campaign_agreements agreement
   where agreement.campaign_id = member.campaign_id
     and agreement.status = 'published'
   order by agreement.version desc
   limit 1
) agreement on true
left join public.campaign_agreement_acceptances acceptance
  on acceptance.agreement_id = agreement.id
 and acceptance.creator_id = member.creator_id
 and acceptance.revoked_at is null;

drop policy if exists campaign_agreements_select_access on public.campaign_agreements;
create policy campaign_agreements_select_access
  on public.campaign_agreements
  for select
  to authenticated
  using (
    app_private.current_user_is_admin()
    or app_private.is_campaign_brand(campaign_id)
    or (
      status = 'published'
      and app_private.is_campaign_member(campaign_id)
    )
  );

drop policy if exists campaign_agreements_insert_brand on public.campaign_agreements;
create policy campaign_agreements_insert_brand
  on public.campaign_agreements
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and app_private.is_campaign_brand(campaign_id)
  );

drop policy if exists campaign_agreements_update_brand on public.campaign_agreements;
create policy campaign_agreements_update_brand
  on public.campaign_agreements
  for update
  to authenticated
  using (app_private.is_campaign_brand(campaign_id))
  with check (app_private.is_campaign_brand(campaign_id));

drop policy if exists campaign_agreement_acceptances_select_access on public.campaign_agreement_acceptances;
create policy campaign_agreement_acceptances_select_access
  on public.campaign_agreement_acceptances
  for select
  to authenticated
  using (
    app_private.current_user_is_admin()
    or creator_id = auth.uid()
    or app_private.is_campaign_brand(campaign_id)
  );

drop policy if exists campaign_agreement_acceptances_insert_creator on public.campaign_agreement_acceptances;
create policy campaign_agreement_acceptances_insert_creator
  on public.campaign_agreement_acceptances
  for insert
  to authenticated
  with check (
    creator_id = auth.uid()
    and exists (
      select 1
        from public.campaign_agreements agreement
       where agreement.id = agreement_id
         and agreement.campaign_id = campaign_id
         and agreement.status = 'published'
    )
    and exists (
      select 1
        from public.campaign_members member
       where member.id = campaign_member_id
         and member.campaign_id = campaign_id
         and member.creator_id = auth.uid()
    )
  );

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'campaign-agreements',
  'campaign-agreements',
  false,
  20971520,
  array['application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function app_private.can_read_campaign_agreement_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, storage, pg_temp
as $$
  select exists (
    select 1
      from public.campaign_agreements agreement
     where agreement.file_path = object_name
       and agreement.file_bucket = 'campaign-agreements'
       and (
         app_private.current_user_is_admin()
         or app_private.is_campaign_brand(agreement.campaign_id)
         or (
           agreement.status = 'published'
           and app_private.is_campaign_member(agreement.campaign_id)
         )
       )
  );
$$;

create or replace function app_private.can_write_campaign_agreement_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, storage, pg_temp
as $$
  select exists (
    select 1
      from public.campaign_agreements agreement
     where agreement.file_path = object_name
       and agreement.file_bucket = 'campaign-agreements'
       and agreement.status = 'draft'
       and app_private.is_campaign_brand(agreement.campaign_id)
  );
$$;

drop policy if exists campaign_agreements_objects_select on storage.objects;
create policy campaign_agreements_objects_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'campaign-agreements'
    and app_private.can_read_campaign_agreement_object(name)
  );

drop policy if exists campaign_agreements_objects_insert on storage.objects;
create policy campaign_agreements_objects_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'campaign-agreements'
    and app_private.uuid_path_segment(name, 1) is not null
    and app_private.uuid_path_segment(name, 2) is not null
    and app_private.can_write_campaign_agreement_object(name)
  );

drop policy if exists campaign_agreements_objects_update on storage.objects;
create policy campaign_agreements_objects_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'campaign-agreements'
    and app_private.can_write_campaign_agreement_object(name)
  )
  with check (
    bucket_id = 'campaign-agreements'
    and app_private.can_write_campaign_agreement_object(name)
  );

create or replace function app_private.can_read_campaign_asset_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, storage, pg_temp
as $$
  select exists (
    select 1
      from public.campaign_assets asset
     where asset.storage_path = object_name
       and asset.status <> 'archived'
       and (
         app_private.current_user_is_admin()
         or app_private.is_campaign_brand(asset.campaign_id)
         or (
           asset.status = 'ready'
           and asset.visibility = 'member'
           and app_private.current_user_has_campaign_agreement_access(asset.campaign_id)
         )
       )
  );
$$;

drop policy if exists campaign_assets_select_access on public.campaign_assets;
create policy campaign_assets_select_access
  on public.campaign_assets
  for select
  to authenticated
  using (
    app_private.current_user_is_admin()
    or app_private.is_campaign_brand(campaign_id)
    or (
      status = 'ready'
      and visibility = 'member'
      and app_private.current_user_has_campaign_agreement_access(campaign_id)
    )
  );

drop policy if exists content_submissions_insert_creator on public.content_submissions;
create policy content_submissions_insert_creator
  on public.content_submissions
  for insert
  to authenticated
  with check (
    exists (
      select 1
        from public.campaign_members member
       where member.id = content_submissions.campaign_member_id
         and member.creator_id = auth.uid()
         and app_private.campaign_member_has_required_agreement(member.id)
    )
  );

drop policy if exists content_submissions_update_creator on public.content_submissions;
create policy content_submissions_update_creator
  on public.content_submissions
  for update
  to authenticated
  using (
    exists (
      select 1
        from public.campaign_members member
       where member.id = content_submissions.campaign_member_id
         and member.creator_id = auth.uid()
         and app_private.campaign_member_has_required_agreement(member.id)
    )
  )
  with check (
    exists (
      select 1
        from public.campaign_members member
       where member.id = content_submissions.campaign_member_id
         and member.creator_id = auth.uid()
         and app_private.campaign_member_has_required_agreement(member.id)
    )
  );

drop policy if exists content_performance_insert_creator on public.content_performance;
create policy content_performance_insert_creator
  on public.content_performance
  for insert
  to authenticated
  with check (
    exists (
      select 1
        from public.content_submissions submission
        join public.campaign_members member
          on member.id = submission.campaign_member_id
       where submission.id = content_performance.submission_id
         and member.creator_id = auth.uid()
         and app_private.campaign_member_has_required_agreement(member.id)
    )
  );

drop policy if exists content_performance_update_creator on public.content_performance;
create policy content_performance_update_creator
  on public.content_performance
  for update
  to authenticated
  using (
    exists (
      select 1
        from public.content_submissions submission
        join public.campaign_members member
          on member.id = submission.campaign_member_id
       where submission.id = content_performance.submission_id
         and member.creator_id = auth.uid()
         and app_private.campaign_member_has_required_agreement(member.id)
    )
  )
  with check (
    exists (
      select 1
        from public.content_submissions submission
        join public.campaign_members member
          on member.id = submission.campaign_member_id
       where submission.id = content_performance.submission_id
         and member.creator_id = auth.uid()
         and app_private.campaign_member_has_required_agreement(member.id)
    )
  );

grant select, insert, update on table public.campaign_agreements
  to authenticated, service_role;
grant delete on table public.campaign_agreements
  to service_role;
grant select, insert on table public.campaign_agreement_acceptances
  to authenticated, service_role;
grant update, delete on table public.campaign_agreement_acceptances
  to service_role;
grant select on public.campaign_member_agreement_status
  to authenticated, service_role;
grant execute on all functions in schema app_private
  to anon, authenticated, service_role;
```

- [ ] **Step 5: Run migration contract tests**

Run:

```bash
npm test -- src/lib/supabase/campaign-agreement-gate-migration.test.ts
```

Expected: PASS.

- [ ] **Step 6: Update database types**

Run the repo's existing Supabase type generation command if configured. If there is no command, hand-update `src/types/database.ts` with:

```ts
campaign_agreements: {
  Row: {
    id: string;
    campaign_id: string;
    created_by: string;
    version: number;
    status: "draft" | "published" | "archived";
    gate_mode:
      | "rules_acknowledgement"
      | "typed_signature"
      | "brand_agreement"
      | "rules_and_brand_agreement";
    title: string;
    rules: Json;
    agreement_body: string | null;
    preview_enabled: boolean;
    preview_summary: Json;
    file_bucket: string | null;
    file_path: string | null;
    file_name: string | null;
    file_mime_type: string | null;
    file_size_bytes: number | null;
    file_sha256: string | null;
    content_hash: string;
    requires_typed_name: boolean;
    requires_reacceptance: boolean;
    published_at: string | null;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    campaign_id: string;
    created_by: string;
    version: number;
    status?: "draft" | "published" | "archived";
    gate_mode:
      | "rules_acknowledgement"
      | "typed_signature"
      | "brand_agreement"
      | "rules_and_brand_agreement";
    title: string;
    rules?: Json;
    agreement_body?: string | null;
    preview_enabled?: boolean;
    preview_summary?: Json;
    file_bucket?: string | null;
    file_path?: string | null;
    file_name?: string | null;
    file_mime_type?: string | null;
    file_size_bytes?: number | null;
    file_sha256?: string | null;
    content_hash: string;
    requires_typed_name?: boolean;
    requires_reacceptance?: boolean;
    published_at?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Update: Partial<Database["public"]["Tables"]["campaign_agreements"]["Insert"]>;
};
```

Also add `campaign_agreement_acceptances` and `campaign_member_agreement_status` view types with the same column names from the migration.

- [ ] **Step 7: Commit database foundation**

Run:

```bash
git add supabase/migrations src/lib/supabase/campaign-agreement-gate-migration.test.ts src/types/database.ts
git commit -m "feat: add campaign agreement gate data model"
```

## Task 2: Agreement Domain Helpers

**Files:**

- Create: `src/lib/agreements/campaign-agreement.test.ts`
- Create: `src/lib/agreements/campaign-agreement.ts`
- Create: `src/lib/agreements/agreement-upload.test.ts`
- Create: `src/lib/agreements/agreement-upload.ts`
- Modify: `shared/validations.ts`
- Modify: `src/lib/validations.ts`

- [ ] **Step 1: Write helper tests**

Add `src/lib/agreements/campaign-agreement.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildDefaultAgreementRules,
  getAgreementStatusLabelKey,
  hashAgreementContent,
  normalizeAgreementRules,
} from "./campaign-agreement";

describe("campaign agreement helpers", () => {
  it("builds default rules from campaign dates, usage rights, and reporting requirements", () => {
    const rules = buildDefaultAgreementRules({
      campaignTitle: "K-Beauty Retail Launch",
      platforms: ["instagram", "tiktok"],
      usageRightsDuration: "6 months",
      usageRightsTerritory: "worldwide",
      usageRightsPaidAds: true,
      applicationDeadline: "2026-05-08T00:00:00.000Z",
      contentDueDate: "2026-05-14T00:00:00.000Z",
      postingWindowStart: "2026-05-07T00:00:00.000Z",
      postingWindowEnd: "2026-05-15T00:00:00.000Z",
      performanceDueDate: "2026-05-18T00:00:00.000Z",
      requiredEvidence: ["public_url", "screenshot", "manual_metrics"],
    });

    expect(rules.disclosure.body).toContain("paid partnership");
    expect(rules.usageRights.body).toContain("6 months");
    expect(rules.reporting.body).toContain("screenshot");
    expect(rules.timeline.body).toContain("2026/05/14");
  });

  it("normalizes rule sections for stable hashing", () => {
    const first = normalizeAgreementRules({
      disclosure: { title: " Disclosure ", body: "  Use #ad.  " },
      reporting: { title: "Reporting", body: "Upload proof." },
    });
    const second = normalizeAgreementRules({
      reporting: { body: "Upload proof.", title: "Reporting" },
      disclosure: { body: "Use #ad.", title: "Disclosure" },
    });

    expect(first).toEqual(second);
  });

  it("hashes agreement content deterministically", () => {
    const hash = hashAgreementContent({
      campaignId: "4707edb5-dcab-4b2d-b5eb-7e79f0e1f010",
      version: 1,
      gateMode: "rules_and_brand_agreement",
      title: "Campaign Rules",
      rules: { disclosure: { title: "Disclosure", body: "Use #ad." } },
      agreementBody: "Brand agreement text",
      fileSha256: "abc123",
    });

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(
      hashAgreementContent({
        campaignId: "4707edb5-dcab-4b2d-b5eb-7e79f0e1f010",
        version: 1,
        gateMode: "rules_and_brand_agreement",
        title: "Campaign Rules",
        rules: { disclosure: { title: "Disclosure", body: "Use #ad." } },
        agreementBody: "Brand agreement text",
        fileSha256: "abc123",
      }),
    );
  });

  it("maps agreement status to i18n label keys", () => {
    expect(getAgreementStatusLabelKey("not_required")).toBe("agreement.status.notRequired");
    expect(getAgreementStatusLabelKey("pending")).toBe("agreement.status.pending");
    expect(getAgreementStatusLabelKey("signed")).toBe("agreement.status.signed");
    expect(getAgreementStatusLabelKey("needs_reacceptance")).toBe("agreement.status.needsSignature");
  });
});
```

Add `src/lib/agreements/agreement-upload.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  AGREEMENT_BUCKET_ID,
  buildAgreementStoragePath,
  getAgreementFileValidationError,
  sanitizeAgreementFileName,
} from "./agreement-upload";

describe("agreement upload helpers", () => {
  it("sanitizes PDF filenames", () => {
    expect(sanitizeAgreementFileName(" Brand NDA Final!!.PDF ")).toBe("brand-nda-final.pdf");
    expect(sanitizeAgreementFileName("...")).toBe("agreement.pdf");
  });

  it("builds scoped agreement storage paths", () => {
    expect(
      buildAgreementStoragePath({
        campaignId: "4707edb5-dcab-4b2d-b5eb-7e79f0e1f010",
        agreementId: "11111111-2222-4333-8444-555555555555",
        fileName: "Brand NDA.pdf",
      }),
    ).toBe(
      "4707edb5-dcab-4b2d-b5eb-7e79f0e1f010/11111111-2222-4333-8444-555555555555/brand-nda.pdf",
    );
  });

  it("allows only non-empty PDF files up to 20MB", () => {
    expect(AGREEMENT_BUCKET_ID).toBe("campaign-agreements");
    expect(getAgreementFileValidationError({ mimeType: "application/pdf", sizeBytes: 1024 })).toBeNull();
    expect(getAgreementFileValidationError({ mimeType: "image/png", sizeBytes: 1024 })).toBe("Upload a PDF agreement file.");
    expect(getAgreementFileValidationError({ mimeType: "application/pdf", sizeBytes: 0 })).toBe("Choose a non-empty agreement file.");
    expect(getAgreementFileValidationError({ mimeType: "application/pdf", sizeBytes: 21 * 1024 * 1024 })).toBe("Agreement files must be 20MB or smaller.");
  });
});
```

- [ ] **Step 2: Run helper tests to verify they fail**

Run:

```bash
npm test -- src/lib/agreements/campaign-agreement.test.ts src/lib/agreements/agreement-upload.test.ts
```

Expected: FAIL because helper files do not exist.

- [ ] **Step 3: Implement helpers**

Add `src/lib/agreements/agreement-upload.ts`:

```ts
export const AGREEMENT_BUCKET_ID = "campaign-agreements" as const;
export const AGREEMENT_MAX_FILE_BYTES = 20 * 1024 * 1024;
export const AGREEMENT_ALLOWED_MIME_TYPES = ["application/pdf"] as const;

export function sanitizeAgreementFileName(fileName: string): string {
  const normalized = fileName
    .trim()
    .toLowerCase()
    .replace(/\.pdf$/i, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");

  return `${normalized || "agreement"}.pdf`;
}

export function buildAgreementStoragePath(input: {
  campaignId: string;
  agreementId: string;
  fileName: string;
}): string {
  return [
    input.campaignId,
    input.agreementId,
    sanitizeAgreementFileName(input.fileName),
  ].join("/");
}

export function getAgreementStorageUri(storagePath: string): string {
  return `${AGREEMENT_BUCKET_ID}/${storagePath}`;
}

export function getAgreementFileValidationError(input: {
  mimeType: string;
  sizeBytes: number;
}): string | null {
  if (input.sizeBytes <= 0) return "Choose a non-empty agreement file.";
  if (input.sizeBytes > AGREEMENT_MAX_FILE_BYTES) {
    return "Agreement files must be 20MB or smaller.";
  }
  if (!AGREEMENT_ALLOWED_MIME_TYPES.includes(input.mimeType as "application/pdf")) {
    return "Upload a PDF agreement file.";
  }
  return null;
}
```

Add `src/lib/agreements/campaign-agreement.ts`:

```ts
import { createHash } from "node:crypto";

export type AgreementGateMode =
  | "rules_acknowledgement"
  | "typed_signature"
  | "brand_agreement"
  | "rules_and_brand_agreement";

export type AgreementStatus =
  | "not_required"
  | "pending"
  | "signed"
  | "needs_reacceptance";

export type AgreementRuleSection = {
  title: string;
  body: string;
};

export type AgreementRules = Record<string, AgreementRuleSection>;

function formatRuleDate(value: string | null | undefined): string {
  if (!value) return "Not set";
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

export function normalizeAgreementRules(rules: AgreementRules): AgreementRules {
  return Object.fromEntries(
    Object.entries(rules)
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([key, section]) => [
        key,
        {
          title: section.title.trim(),
          body: section.body.trim().replace(/\s+/g, " "),
        },
      ]),
  );
}

export function buildDefaultAgreementRules(input: {
  campaignTitle: string;
  platforms: string[];
  usageRightsDuration: string | null;
  usageRightsTerritory: string | null;
  usageRightsPaidAds: boolean;
  applicationDeadline: string | null;
  contentDueDate: string | null;
  postingWindowStart: string | null;
  postingWindowEnd: string | null;
  performanceDueDate: string | null;
  requiredEvidence: string[];
}): AgreementRules {
  const platforms = input.platforms.length ? input.platforms.join(", ") : "selected campaign platforms";
  const evidence = input.requiredEvidence.length
    ? input.requiredEvidence.join(", ")
    : "public URL, proof screenshot, and manual metrics";

  return normalizeAgreementRules({
    role: {
      title: "Campaign role",
      body: `You are joining ${input.campaignTitle} as an accepted campaign creator.`,
    },
    disclosure: {
      title: "Disclosure",
      body: `Use clear paid partnership or sponsored disclosure for ${platforms}. Free products, affiliate offers, and paid work must be disclosed.`,
    },
    claims: {
      title: "Brand claims",
      body: "Use only approved campaign claims. Do not make medical, safety, financial, or performance claims unless the brand explicitly provides them.",
    },
    usageRights: {
      title: "Usage rights",
      body: `Brand usage is ${input.usageRightsDuration ?? "campaign-defined"} in ${input.usageRightsTerritory ?? "campaign markets"}. Paid ads usage is ${input.usageRightsPaidAds ? "included" : "not included unless separately agreed"}.`,
    },
    confidentiality: {
      title: "Confidentiality",
      body: "Private materials, unreleased products, campaign assets, and internal instructions stay inside the campaign.",
    },
    timeline: {
      title: "Timeline",
      body: `Apply by ${formatRuleDate(input.applicationDeadline)}. Content due ${formatRuleDate(input.contentDueDate)}. Publish from ${formatRuleDate(input.postingWindowStart)} to ${formatRuleDate(input.postingWindowEnd)}. Performance data due ${formatRuleDate(input.performanceDueDate)}.`,
    },
    reporting: {
      title: "Reporting evidence",
      body: `Submit required evidence: ${evidence}. Values extracted from screenshots must be confirmed before they become report data.`,
    },
    corrections: {
      title: "Corrections",
      body: "Respond to brand correction requests promptly and resubmit required proof when requested.",
    },
  });
}

export function hashAgreementContent(input: {
  campaignId: string;
  version: number;
  gateMode: AgreementGateMode;
  title: string;
  rules: AgreementRules;
  agreementBody?: string | null;
  fileSha256?: string | null;
}): string {
  const payload = {
    campaignId: input.campaignId,
    version: input.version,
    gateMode: input.gateMode,
    title: input.title.trim(),
    rules: normalizeAgreementRules(input.rules),
    agreementBody: input.agreementBody?.trim() ?? null,
    fileSha256: input.fileSha256 ?? null,
  };

  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

export function getAgreementStatusLabelKey(status: AgreementStatus): string {
  return {
    not_required: "agreement.status.notRequired",
    pending: "agreement.status.pending",
    signed: "agreement.status.signed",
    needs_reacceptance: "agreement.status.needsSignature",
  }[status];
}
```

- [ ] **Step 4: Add validation schemas**

In `shared/validations.ts`, add after reporting schemas:

```ts
const agreementGateModeEnum = z.enum([
  "rules_acknowledgement",
  "typed_signature",
  "brand_agreement",
  "rules_and_brand_agreement",
]);

export const agreementRuleSectionSchema = z.object({
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(1200),
});

export const upsertCampaignAgreementDraftSchema = z.object({
  campaignId: uuidLike,
  gateMode: agreementGateModeEnum,
  title: z.string().trim().min(3).max(120),
  rules: z.record(z.string().trim().min(1).max(60), agreementRuleSectionSchema),
  agreementBody: z.string().trim().max(20_000).optional().nullable(),
  previewEnabled: z.boolean().default(false),
  previewSummary: z.record(z.string(), z.string()).default({}),
  requiresTypedName: z.boolean().default(true),
  fileName: z.string().trim().max(220).optional().nullable(),
  fileMimeType: z.literal("application/pdf").optional().nullable(),
  fileSizeBytes: z.coerce.number().int().positive().optional().nullable(),
  fileSha256: z.string().regex(/^[a-f0-9]{64}$/).optional().nullable(),
});

export const publishCampaignAgreementSchema = z.object({
  agreementId: uuidLike,
});

export const acceptCampaignAgreementSchema = z.object({
  agreementId: uuidLike,
  campaignId: uuidLike,
  typedName: z.string().trim().min(2).max(120),
  acceptedRules: z.record(z.string(), z.boolean()).default({}),
});

export type UpsertCampaignAgreementDraftInput = z.infer<
  typeof upsertCampaignAgreementDraftSchema
>;
export type AcceptCampaignAgreementInput = z.infer<
  typeof acceptCampaignAgreementSchema
>;
```

In `src/lib/validations.ts`, re-export the shared schemas if it mirrors `shared/validations.ts`.

- [ ] **Step 5: Run helper tests**

Run:

```bash
npm test -- src/lib/agreements/campaign-agreement.test.ts src/lib/agreements/agreement-upload.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit helpers**

Run:

```bash
git add src/lib/agreements shared/validations.ts src/lib/validations.ts
git commit -m "feat: add campaign agreement helpers"
```

## Task 3: Server Actions

**Files:**

- Create: `src/app/actions/campaign-agreements.test.ts`
- Create: `src/app/actions/campaign-agreements.ts`
- Modify: `src/app/actions/content.ts`
- Modify: `src/app/actions/reporting-evidence.ts`

- [ ] **Step 1: Write action contract tests**

Add `src/app/actions/campaign-agreements.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./campaign-agreements.ts", import.meta.url), "utf8");
const contentSource = readFileSync(new URL("./content.ts", import.meta.url), "utf8");
const evidenceSource = readFileSync(new URL("./reporting-evidence.ts", import.meta.url), "utf8");

describe("campaign agreement actions", () => {
  it("lets brands create draft agreement metadata after campaign ownership verification", () => {
    expect(source).toContain("export async function upsertCampaignAgreementDraft");
    expect(source).toContain("upsertCampaignAgreementDraftSchema");
    expect(source).toContain(".from(\"campaigns\")");
    expect(source).toContain(".eq(\"brand_id\", user.id)");
    expect(source).toContain("hashAgreementContent");
  });

  it("prepares scoped private PDF uploads", () => {
    expect(source).toContain("export async function createCampaignAgreementUpload");
    expect(source).toContain("getAgreementFileValidationError");
    expect(source).toContain("buildAgreementStoragePath");
    expect(source).toContain("bucket: AGREEMENT_BUCKET_ID");
  });

  it("publishes immutable agreement versions and archives prior published versions", () => {
    expect(source).toContain("export async function publishCampaignAgreement");
    expect(source).toContain("status: \"archived\"");
    expect(source).toContain("status: \"published\"");
    expect(source).toContain("published_at");
  });

  it("allows accepted creators to sign the published agreement", () => {
    expect(source).toContain("export async function acceptCampaignAgreement");
    expect(source).toContain("acceptCampaignAgreementSchema");
    expect(source).toContain(".from(\"campaign_members\")");
    expect(source).toContain(".from(\"campaign_agreement_acceptances\")");
    expect(source).toContain("accepted_content_hash: agreement.content_hash");
  });

  it("blocks protected creator actions while the gate is pending", () => {
    expect(contentSource).toContain("assertCampaignMemberAgreementAccess");
    expect(contentSource).toContain("await assertCampaignMemberAgreementAccess(member.id)");
    expect(evidenceSource).toContain("assertCampaignMemberAgreementAccess");
  });
});
```

- [ ] **Step 2: Run action tests to verify they fail**

Run:

```bash
npm test -- src/app/actions/campaign-agreements.test.ts
```

Expected: FAIL because `campaign-agreements.ts` does not exist.

- [ ] **Step 3: Implement agreement actions**

Create `src/app/actions/campaign-agreements.ts`:

```ts
"use server";

import { randomUUID, createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  acceptCampaignAgreementSchema,
  publishCampaignAgreementSchema,
  upsertCampaignAgreementDraftSchema,
} from "@/lib/validations";
import {
  AGREEMENT_BUCKET_ID,
  buildAgreementStoragePath,
  getAgreementFileValidationError,
} from "@/lib/agreements/agreement-upload";
import { hashAgreementContent } from "@/lib/agreements/campaign-agreement";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "./auth";

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

async function getOwnedCampaign(campaignId: string, userId: string) {
  const supabase = await createClient();
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, brand_id")
    .eq("id", campaignId)
    .eq("brand_id", userId)
    .single();

  if (!campaign) throw new Error("Campaign not found or not authorized");
  return campaign;
}

export async function assertCampaignMemberAgreementAccess(memberId: string) {
  const supabase = await createClient();
  const { data: status } = await supabase
    .from("campaign_member_agreement_status")
    .select("status")
    .eq("campaign_member_id", memberId)
    .maybeSingle();

  if (status && !["not_required", "signed"].includes(status.status)) {
    throw new Error("Sign the campaign rules before continuing.");
  }
}

export async function upsertCampaignAgreementDraft(input: unknown) {
  const parsed = upsertCampaignAgreementDraftSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const user = await getUser();
  await getOwnedCampaign(parsed.data.campaignId, user.id);

  const admin = createAdminClient();
  const { data: latest } = await admin
    .from("campaign_agreements")
    .select("id, version, status")
    .eq("campaign_id", parsed.data.campaignId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const version = latest?.status === "draft" ? latest.version : (latest?.version ?? 0) + 1;
  const agreementId = latest?.status === "draft" ? latest.id : randomUUID();
  const contentHash = hashAgreementContent({
    campaignId: parsed.data.campaignId,
    version,
    gateMode: parsed.data.gateMode,
    title: parsed.data.title,
    rules: parsed.data.rules,
    agreementBody: parsed.data.agreementBody,
    fileSha256: parsed.data.fileSha256,
  });
  const filePath = parsed.data.fileName
    ? buildAgreementStoragePath({
        campaignId: parsed.data.campaignId,
        agreementId,
        fileName: parsed.data.fileName,
      })
    : null;

  const { data, error } = await admin
    .from("campaign_agreements")
    .upsert(
      {
        id: agreementId,
        campaign_id: parsed.data.campaignId,
        created_by: user.id,
        version,
        status: "draft",
        gate_mode: parsed.data.gateMode,
        title: parsed.data.title,
        rules: parsed.data.rules,
        agreement_body: parsed.data.agreementBody ?? null,
        preview_enabled: parsed.data.previewEnabled,
        preview_summary: parsed.data.previewSummary,
        file_bucket: filePath ? AGREEMENT_BUCKET_ID : null,
        file_path: filePath,
        file_name: parsed.data.fileName ?? null,
        file_mime_type: parsed.data.fileMimeType ?? null,
        file_size_bytes: parsed.data.fileSizeBytes ?? null,
        file_sha256: parsed.data.fileSha256 ?? null,
        content_hash: contentHash,
        requires_typed_name: parsed.data.requiresTypedName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("id, campaign_id, file_path")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath(`/b/campaigns/${parsed.data.campaignId}`);
  return data;
}

export async function createCampaignAgreementUpload(input: {
  agreementId: string;
  campaignId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}) {
  const validationError = getAgreementFileValidationError({
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
  });
  if (validationError) throw new Error(validationError);

  const user = await getUser();
  await getOwnedCampaign(input.campaignId, user.id);

  const storagePath = buildAgreementStoragePath({
    campaignId: input.campaignId,
    agreementId: input.agreementId,
    fileName: input.fileName,
  });

  return {
    bucket: AGREEMENT_BUCKET_ID,
    storagePath,
  };
}

export async function publishCampaignAgreement(input: { agreementId: string }) {
  const parsed = publishCampaignAgreementSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const user = await getUser();
  const supabase = await createClient();
  const { data: agreement } = await supabase
    .from("campaign_agreements")
    .select("id, campaign_id, status")
    .eq("id", parsed.data.agreementId)
    .single();

  if (!agreement) throw new Error("Agreement not found");
  if (agreement.status !== "draft") throw new Error("Only draft agreements can be published");
  await getOwnedCampaign(agreement.campaign_id, user.id);

  const admin = createAdminClient();
  const publishedAt = new Date().toISOString();
  const { error: archiveError } = await admin
    .from("campaign_agreements")
    .update({ status: "archived", updated_at: publishedAt })
    .eq("campaign_id", agreement.campaign_id)
    .eq("status", "published");
  if (archiveError) throw new Error(archiveError.message);

  const { error } = await admin
    .from("campaign_agreements")
    .update({ status: "published", published_at: publishedAt, updated_at: publishedAt })
    .eq("id", agreement.id);
  if (error) throw new Error(error.message);

  revalidatePath(`/b/campaigns/${agreement.campaign_id}`);
  revalidatePath(`/i/campaigns/${agreement.campaign_id}`);
  return { ok: true };
}

export async function acceptCampaignAgreement(input: unknown) {
  const parsed = acceptCampaignAgreementSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const user = await getUser();
  const supabase = await createClient();
  const { data: agreement } = await supabase
    .from("campaign_agreements")
    .select("id, campaign_id, version, status, rules, content_hash")
    .eq("id", parsed.data.agreementId)
    .eq("campaign_id", parsed.data.campaignId)
    .single();

  if (!agreement || agreement.status !== "published") {
    throw new Error("Agreement is not available for signature");
  }

  const { data: member } = await supabase
    .from("campaign_members")
    .select("id, campaign_id, creator_id")
    .eq("campaign_id", parsed.data.campaignId)
    .eq("creator_id", user.id)
    .single();

  if (!member) throw new Error("Campaign membership not found");

  const admin = createAdminClient();
  const { error } = await admin
    .from("campaign_agreement_acceptances")
    .insert({
      agreement_id: agreement.id,
      campaign_id: agreement.campaign_id,
      campaign_member_id: member.id,
      creator_id: user.id,
      typed_name: parsed.data.typedName,
      accepted_rules: parsed.data.acceptedRules,
      accepted_content_hash: agreement.content_hash,
      accepted_version: agreement.version,
      user_agent: null,
    });

  if (error) throw new Error(error.message);

  revalidatePath(`/i/campaigns/${agreement.campaign_id}`);
  revalidatePath(`/b/campaigns/${agreement.campaign_id}`);
  return { ok: true };
}

export async function getCampaignAgreementSignedUrl(input: {
  agreementId: string;
}) {
  const user = await getUser();
  const supabase = await createClient();
  const { data: agreement } = await supabase
    .from("campaign_agreements")
    .select("id, campaign_id, file_bucket, file_path, campaigns(brand_id)")
    .eq("id", input.agreementId)
    .single();

  if (!agreement?.file_bucket || !agreement.file_path) {
    throw new Error("Agreement file not found");
  }

  const campaign = firstRelation(agreement.campaigns as { brand_id: string } | { brand_id: string }[] | null);
  const isBrand = campaign?.brand_id === user.id;

  const { data: member } = await supabase
    .from("campaign_members")
    .select("id")
    .eq("campaign_id", agreement.campaign_id)
    .eq("creator_id", user.id)
    .maybeSingle();

  if (!isBrand && !member) throw new Error("Not authorized");

  const { data, error } = await supabase.storage
    .from(agreement.file_bucket)
    .createSignedUrl(agreement.file_path, 600);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Signed URL could not be created");
  }
  return { signedUrl: data.signedUrl };
}
```

- [ ] **Step 4: Block content and evidence actions while unsigned**

In `src/app/actions/content.ts`, import:

```ts
import { assertCampaignMemberAgreementAccess } from "./campaign-agreements";
```

Add after each creator membership authorization in `submitContent`, `publishContent`, and `submitPerformance`:

```ts
await assertCampaignMemberAgreementAccess(member.id);
```

For `publishContent`, use `submission.campaign_member_id` if the local `member` object does not include `id`.

In `src/app/actions/reporting-evidence.ts`, import the same helper and add after report task membership authorization:

```ts
await assertCampaignMemberAgreementAccess(task.campaign_member_id);
```

- [ ] **Step 5: Run action tests and typecheck**

Run:

```bash
npm test -- src/app/actions/campaign-agreements.test.ts src/app/actions/reporting-evidence.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit server actions**

Run:

```bash
git add src/app/actions/campaign-agreements.ts src/app/actions/campaign-agreements.test.ts src/app/actions/content.ts src/app/actions/reporting-evidence.ts
git commit -m "feat: add agreement gate actions"
```

## Task 4: Public Apply Preview

**Files:**

- Modify: `src/app/api/public/campaigns/[id]/route.ts`
- Modify: `src/app/(site)/apply/[id]/page.tsx`
- Create: `src/app/(site)/apply/[id]/agreement-preview-flow.test.ts`
- Modify: `src/lib/i18n/strings.ts`
- Modify: `src/lib/i18n/generated/platform-bundles/en.json`

- [ ] **Step 1: Write preview tests**

Add `src/app/(site)/apply/[id]/agreement-preview-flow.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const routeSource = readFileSync(new URL("../../../api/public/campaigns/[id]/route.ts", import.meta.url), "utf8");
const stringsSource = readFileSync(new URL("../../../../../lib/i18n/strings.ts", import.meta.url), "utf8");

describe("public apply agreement preview", () => {
  it("returns only safe agreement preview fields from the public campaign route", () => {
    expect(routeSource).toContain("campaign_agreements");
    expect(routeSource).toContain("preview_enabled");
    expect(routeSource).toContain("preview_summary");
    expect(routeSource).not.toContain("agreement_body");
    expect(routeSource).not.toContain("file_path");
  });

  it("shows agreement requirements before creators apply", () => {
    expect(pageSource).toContain("agreement_preview");
    expect(pageSource).toContain('data-testid="apply-agreement-preview"');
    expect(pageSource).toContain('t("agreement.previewTitle")');
    expect(pageSource).toContain('t("agreement.signAfterAcceptance")');
  });

  it("adds all preview strings to i18n", () => {
    expect(stringsSource).toContain('"agreement.previewTitle"');
    expect(stringsSource).toContain('"agreement.signAfterAcceptance"');
  });
});
```

- [ ] **Step 2: Run preview tests to verify they fail**

Run:

```bash
npm test -- 'src/app/(site)/apply/[id]/agreement-preview-flow.test.ts'
```

Expected: FAIL because the route/page do not include agreement preview yet.

- [ ] **Step 3: Add safe preview to public API route**

In `src/app/api/public/campaigns/[id]/route.ts`, add `campaign_agreements` to the admin select:

```ts
campaign_agreements (
  id,
  status,
  gate_mode,
  title,
  preview_enabled,
  preview_summary,
  version
)
```

Then derive:

```ts
const agreementRows = Array.isArray(
  (campaignData as Record<string, unknown>).campaign_agreements,
)
  ? ((campaignData as Record<string, unknown>).campaign_agreements as Array<Record<string, unknown>>)
  : [];
const publishedAgreement = agreementRows.find((row) => row.status === "published");
const agreementPreview = publishedAgreement
  ? {
      required: true,
      gate_mode: publishedAgreement.gate_mode,
      title: publishedAgreement.title,
      version: publishedAgreement.version,
      preview_enabled: publishedAgreement.preview_enabled,
      preview_summary: publishedAgreement.preview_enabled
        ? publishedAgreement.preview_summary
        : {},
    }
  : {
      required: false,
      gate_mode: null,
      title: null,
      version: null,
      preview_enabled: false,
      preview_summary: {},
    };
```

Return `agreement_preview: agreementPreview` and remove raw `campaign_agreements` from the payload before returning JSON.

- [ ] **Step 4: Render compact preview on apply page**

In `src/app/(site)/apply/[id]/page.tsx`, add to `CampaignPublic`:

```ts
agreement_preview: {
  required: boolean;
  gate_mode: string | null;
  title: string | null;
  version: number | null;
  preview_enabled: boolean;
  preview_summary: Record<string, string>;
};
```

Render above the apply CTA:

```tsx
{campaign.agreement_preview.required && (
  <Card data-testid="apply-agreement-preview" className="border-border bg-card">
    <CardContent className="flex items-start gap-3 p-4">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">
          {t("agreement.previewTitle")}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {t("agreement.signAfterAcceptance")}
        </p>
        {Object.values(campaign.agreement_preview.preview_summary).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.values(campaign.agreement_preview.preview_summary).map((item) => (
              <span
                key={item}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
              >
                {item}
              </span>
            ))}
          </div>
        )}
      </div>
    </CardContent>
  </Card>
)}
```

- [ ] **Step 5: Add strings**

In `src/lib/i18n/strings.ts`, add under `public.apply`:

```ts
"agreement.previewTitle": "Campaign rules required",
"agreement.signAfterAcceptance": "If accepted, you will sign the campaign rules before the full brief, assets, submissions, and reporting unlock.",
```

Update `src/lib/i18n/generated/platform-bundles/en.json` with the same keys.

- [ ] **Step 6: Run preview tests**

Run:

```bash
npm test -- 'src/app/(site)/apply/[id]/agreement-preview-flow.test.ts'
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit public preview**

Run:

```bash
git add 'src/app/api/public/campaigns/[id]/route.ts' 'src/app/(site)/apply/[id]/page.tsx' 'src/app/(site)/apply/[id]/agreement-preview-flow.test.ts' src/lib/i18n/strings.ts src/lib/i18n/generated/platform-bundles/en.json
git commit -m "feat: show campaign agreement preview"
```

## Task 5: Brand Agreement Setup And Status

**Files:**

- Create: `src/components/campaigns/brand-agreement-panel.tsx`
- Create: `src/components/campaigns/agreement-status-cell.tsx`
- Modify: `src/app/(site)/(app)/b/campaigns/[id]/page.tsx`
- Modify: `src/app/(site)/(app)/b/campaigns/[id]/page-flow.test.ts`
- Modify: `src/app/(site)/(app)/b/campaigns/new/page.tsx`
- Modify: `src/app/(site)/(app)/b/campaigns/new/page-flow.test.ts`
- Modify: `src/lib/i18n/strings.ts`
- Modify: `src/lib/i18n/generated/platform-bundles/en.json`

- [ ] **Step 1: Extend brand workspace tests**

In `src/app/(site)/(app)/b/campaigns/[id]/page-flow.test.ts`, add:

```ts
it("shows campaign agreement setup and sortable member signature status", () => {
  expect(source).toContain("BrandAgreementPanel");
  expect(source).toContain("AgreementStatusCell");
  expect(source).toContain("agreementStatusRows");
  expect(source).toContain(".from(\"campaign_member_agreement_status\")");
  expect(source).toContain('sortKey="agreement"');
  expect(source).toContain('{t("members.agreement")}');
});
```

In `src/app/(site)/(app)/b/campaigns/new/page-flow.test.ts`, add:

```ts
it("keeps agreement gate setup after creative kit and before launch review", () => {
  expect(source).toContain("agreementGateEnabled");
  expect(source).toContain("buildDefaultAgreementRules");
  expect(source).toContain("Campaign Rules");
  expect(source).toContain("agreement.previewSummary");
});
```

- [ ] **Step 2: Run brand tests to verify they fail**

Run:

```bash
npm test -- 'src/app/(site)/(app)/b/campaigns/[id]/page-flow.test.ts' 'src/app/(site)/(app)/b/campaigns/new/page-flow.test.ts'
```

Expected: FAIL because brand agreement UI is not wired.

- [ ] **Step 3: Create status cell**

Add `src/components/campaigns/agreement-status-cell.tsx`:

```tsx
"use client";

import { CheckCircle2, Clock, PenLine } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { getAgreementStatusLabelKey, type AgreementStatus } from "@/lib/agreements/campaign-agreement";

export function AgreementStatusCell({ status }: { status: AgreementStatus }) {
  const { t } = useTranslation("brand.campaign");
  const Icon =
    status === "signed" ? CheckCircle2 : status === "not_required" ? Clock : PenLine;

  return (
    <span
      data-testid="campaign-member-agreement-status"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
    >
      <Icon className="size-3.5" />
      {t(getAgreementStatusLabelKey(status))}
    </span>
  );
}
```

- [ ] **Step 4: Create brand agreement panel**

Add `src/components/campaigns/brand-agreement-panel.tsx` with a compact panel that calls `upsertCampaignAgreementDraft`, uploads the PDF to Supabase Storage if selected, then calls `publishCampaignAgreement`.

Required UI structure:

```tsx
<section data-testid="brand-agreement-panel" className="rounded-xl border border-border bg-card p-4">
  <div className="flex items-start justify-between gap-4">
    <div>
      <h2 className="text-sm font-semibold text-foreground">{t("agreement.title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("agreement.detail")}</p>
    </div>
    <Button size="sm" variant="outline">{t("agreement.configure")}</Button>
  </div>
</section>
```

Use fields:

- Gate enabled checkbox.
- Gate mode segmented control.
- Editable rule sections.
- Optional PDF upload.
- Preview summary chips.
- Publish button.

Do not add long explanatory copy. Use labels and state.

- [ ] **Step 5: Wire brand campaign workspace**

In `src/app/(site)/(app)/b/campaigns/[id]/page.tsx`:

- Import `BrandAgreementPanel` and `AgreementStatusCell`.
- Load `campaign_agreements` for the campaign.
- Load `campaign_member_agreement_status` for the campaign.
- Add `agreement` to `MemberSortKey`.
- Add a sortable `Agreement` column before report/proof.
- Render `AgreementStatusCell`.
- Render `BrandAgreementPanel` in the campaign operations area.

Use status map:

```ts
const agreementStatusByMemberId = new Map(
  agreementStatusRows.map((row) => [row.campaign_member_id, row.status]),
);
```

- [ ] **Step 6: Add campaign builder entry point**

In `src/app/(site)/(app)/b/campaigns/new/page.tsx`:

- Add `agreementGateEnabled` state.
- Use `buildDefaultAgreementRules` after campaign details, timeline, reporting, and usage rights are known.
- In Review and Launch, immediately after the Creative Kit summary, show a compact Agreement Gate block.
- When campaign is created, call the agreement actions only if `agreementGateEnabled` is true and then publish the agreement.

Keep the first builder integration rules-only unless a PDF is selected. Do not block campaign creation when the gate is off.

- [ ] **Step 7: Add strings**

Add under `brand.campaign`:

```ts
"agreement.title": "Campaign Rules",
"agreement.detail": "Accepted creators sign before private materials, submissions, and reporting unlock.",
"agreement.configure": "Configure",
"agreement.publish": "Publish rules",
"agreement.uploadPdf": "Attach brand agreement",
"agreement.status.notRequired": "Not required",
"agreement.status.pending": "Pending",
"agreement.status.signed": "Signed",
"agreement.status.needsSignature": "Needs signature",
"members.agreement": "Agreement",
```

Update English generated platform bundle.

- [ ] **Step 8: Run brand tests**

Run:

```bash
npm test -- 'src/app/(site)/(app)/b/campaigns/[id]/page-flow.test.ts' 'src/app/(site)/(app)/b/campaigns/new/page-flow.test.ts'
npm run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit brand setup**

Run:

```bash
git add src/components/campaigns 'src/app/(site)/(app)/b/campaigns/[id]/page.tsx' 'src/app/(site)/(app)/b/campaigns/[id]/page-flow.test.ts' 'src/app/(site)/(app)/b/campaigns/new/page.tsx' 'src/app/(site)/(app)/b/campaigns/new/page-flow.test.ts' src/lib/i18n/strings.ts src/lib/i18n/generated/platform-bundles/en.json
git commit -m "feat: add brand agreement gate setup"
```

## Task 6: Creator Web Gate

**Files:**

- Create: `src/components/campaigns/agreement-gate.tsx`
- Modify: `src/app/(site)/(app)/i/campaigns/[id]/page.tsx`
- Modify: `src/app/(site)/(app)/i/campaigns/[id]/report-task-flow.test.ts`
- Modify: `src/lib/i18n/strings.ts`
- Modify: `src/lib/i18n/generated/platform-bundles/en.json`

- [ ] **Step 1: Add creator gate tests**

In `src/app/(site)/(app)/i/campaigns/[id]/report-task-flow.test.ts`, add:

```ts
it("shows the agreement gate before protected campaign room tabs", () => {
  expect(source).toContain("AgreementGate");
  expect(source).toContain("agreementStatus");
  expect(source).toContain(".from(\"campaign_member_agreement_status\")");
  expect(source).toContain('agreementStatus?.status === "pending"');
  expect(source).toContain('data-testid="creator-agreement-gate"');
  expect(source).toContain("acceptCampaignAgreement");
});
```

- [ ] **Step 2: Run creator gate test to verify it fails**

Run:

```bash
npm test -- 'src/app/(site)/(app)/i/campaigns/[id]/report-task-flow.test.ts'
```

Expected: FAIL because the gate is not implemented.

- [ ] **Step 3: Create AgreementGate component**

Add `src/components/campaigns/agreement-gate.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { FileText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptCampaignAgreement } from "@/app/actions/campaign-agreements";
import { useTranslation } from "@/lib/i18n";

type AgreementGateProps = {
  agreement: {
    id: string;
    campaign_id: string;
    title: string;
    version: number;
    rules: Record<string, { title: string; body: string }>;
    file_name: string | null;
  };
  onSigned: () => void;
};

export function AgreementGate({ agreement, onSigned }: AgreementGateProps) {
  const { t } = useTranslation("creator.campaign");
  const [typedName, setTypedName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const canSign = accepted && typedName.trim().length >= 2;

  function handleSign() {
    if (!canSign) return;
    setError(null);
    startTransition(async () => {
      try {
        await acceptCampaignAgreement({
          agreementId: agreement.id,
          campaignId: agreement.campaign_id,
          typedName: typedName.trim(),
          acceptedRules: Object.fromEntries(
            Object.keys(agreement.rules).map((key) => [key, true]),
          ),
        });
        onSigned();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("agreement.error"));
      }
    });
  }

  return (
    <div
      data-testid="creator-agreement-gate"
      className="mx-auto max-w-2xl p-4 lg:p-6"
    >
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <ShieldCheck className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              {t("agreement.version", { version: String(agreement.version) })}
            </p>
            <h1 className="mt-1 text-xl font-semibold text-foreground">
              {t("agreement.title")}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t("agreement.detail")}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {Object.entries(agreement.rules).map(([key, section]) => (
            <section key={key} className="rounded-xl border border-border p-4">
              <h2 className="text-sm font-semibold text-foreground">{section.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {section.body}
              </p>
            </section>
          ))}
        </div>

        {agreement.file_name && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            <FileText className="size-4" />
            {agreement.file_name}
          </div>
        )}

        <div className="mt-5 space-y-3 border-t border-border pt-4">
          <label className="flex items-start gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              className="mt-1"
            />
            {t("agreement.checkbox")}
          </label>
          <input
            value={typedName}
            onChange={(event) => setTypedName(event.target.value)}
            placeholder={t("agreement.typedName")}
            className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-slate-900/10"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button className="w-full" disabled={!canSign || isPending} onClick={handleSign}>
            {isPending ? t("agreement.signing") : t("agreement.sign")}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire creator campaign room**

In `src/app/(site)/(app)/i/campaigns/[id]/page.tsx`:

- Import `AgreementGate`.
- Add state:

```ts
const [agreementStatus, setAgreementStatus] = useState<{
  status: "not_required" | "pending" | "signed" | "needs_reacceptance";
  agreement_id: string | null;
} | null>(null);
const [agreement, setAgreement] = useState<{
  id: string;
  campaign_id: string;
  title: string;
  version: number;
  rules: Record<string, { title: string; body: string }>;
  file_name: string | null;
} | null>(null);
```

- After member load, fetch:

```ts
const { data: statusRow } = await supabase
  .from("campaign_member_agreement_status")
  .select("status, agreement_id")
  .eq("campaign_member_id", member.id)
  .maybeSingle();
setAgreementStatus(statusRow);

if (statusRow?.agreement_id && statusRow.status !== "signed") {
  const { data: agreementRow } = await supabase
    .from("campaign_agreements")
    .select("id, campaign_id, title, version, rules, file_name")
    .eq("id", statusRow.agreement_id)
    .single();
  if (agreementRow) setAgreement(agreementRow as typeof agreement);
}
```

- Before rendering the room tabs:

```tsx
if (
  agreement &&
  (agreementStatus?.status === "pending" ||
    agreementStatus?.status === "needs_reacceptance")
) {
  return (
    <AgreementGate
      agreement={agreement}
      onSigned={() => window.location.reload()}
    />
  );
}
```

- [ ] **Step 5: Add creator strings**

Add under `creator.campaign`:

```ts
"agreement.title": "Campaign Rules",
"agreement.detail": "Review and sign before the full brief, private assets, submissions, and reporting unlock.",
"agreement.version": "Version {version}",
"agreement.checkbox": "I have read and agree to follow these campaign rules.",
"agreement.typedName": "Type your legal name",
"agreement.sign": "Sign and unlock campaign",
"agreement.signing": "Signing",
"agreement.error": "Agreement could not be signed.",
```

Update English generated platform bundle.

- [ ] **Step 6: Run creator tests**

Run:

```bash
npm test -- 'src/app/(site)/(app)/i/campaigns/[id]/report-task-flow.test.ts'
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit creator gate**

Run:

```bash
git add src/components/campaigns/agreement-gate.tsx 'src/app/(site)/(app)/i/campaigns/[id]/page.tsx' 'src/app/(site)/(app)/i/campaigns/[id]/report-task-flow.test.ts' src/lib/i18n/strings.ts src/lib/i18n/generated/platform-bundles/en.json
git commit -m "feat: gate creator campaign room by agreement"
```

## Task 7: Mobile Creator Gate

**Files:**

- Modify: `mobile/lib/campaign-room.ts`
- Modify: `mobile/lib/campaign-actions.ts`
- Modify: `mobile/app/campaign-room/[id].tsx`
- Modify: `mobile/app/campaign/[id].tsx`
- Modify: `mobile/lib/creator-campaigns.test.ts`
- Modify: `mobile/lib/strings.ts`
- Modify: `mobile/lib/generated/mobile-bundles/en.json`

- [ ] **Step 1: Add mobile contract tests**

In `mobile/lib/creator-campaigns.test.ts`, add:

```ts
import { readFileSync } from "node:fs";

const roomSource = readFileSync(new URL("./campaign-room.ts", import.meta.url), "utf8");
const actionsSource = readFileSync(new URL("./campaign-actions.ts", import.meta.url), "utf8");
const roomScreenSource = readFileSync(new URL("../app/campaign-room/[id].tsx", import.meta.url), "utf8");

it("loads agreement status into the mobile campaign room", () => {
  expect(roomSource).toContain("agreementStatus");
  expect(roomSource).toContain("campaign_member_agreement_status");
  expect(roomSource).toContain("campaign_agreements");
});

it("lets mobile creators sign before room work unlocks", () => {
  expect(actionsSource).toContain("acceptCampaignAgreement");
  expect(actionsSource).toContain("campaign_agreement_acceptances");
  expect(roomScreenSource).toContain("renderAgreementGate");
  expect(roomScreenSource).toContain("agreementStatus.status !== \"signed\"");
});
```

- [ ] **Step 2: Run mobile tests to verify they fail**

Run:

```bash
npm --prefix mobile test -- lib/creator-campaigns.test.ts
```

Expected: FAIL until mobile agreement support is added.

- [ ] **Step 3: Extend mobile room loader**

In `mobile/lib/campaign-room.ts`, extend `CampaignRoomData`:

```ts
agreementStatus: {
  status: "not_required" | "pending" | "signed" | "needs_reacceptance";
  agreementId: string | null;
} | null;
agreement: {
  id: string;
  campaignId: string;
  title: string;
  version: number;
  rules: Record<string, { title: string; body: string }>;
  fileName: string | null;
} | null;
```

After member load, fetch `campaign_member_agreement_status` and `campaign_agreements` if needed. Return the values in `CampaignRoomData`.

- [ ] **Step 4: Add mobile action**

In `mobile/lib/campaign-actions.ts`, add:

```ts
export async function acceptCampaignAgreement(input: {
  agreementId: string;
  campaignId: string;
  campaignMemberId: string;
  typedName: string;
  acceptedRules: Record<string, boolean>;
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: agreement } = await supabase
    .from("campaign_agreements")
    .select("id, campaign_id, version, status, content_hash")
    .eq("id", input.agreementId)
    .eq("campaign_id", input.campaignId)
    .single();

  if (!agreement || agreement.status !== "published") {
    throw new Error("Agreement is not available for signature");
  }

  const { error } = await supabase.from("campaign_agreement_acceptances").insert({
    agreement_id: agreement.id,
    campaign_id: agreement.campaign_id,
    campaign_member_id: input.campaignMemberId,
    creator_id: user.id,
    typed_name: input.typedName.trim(),
    accepted_rules: input.acceptedRules,
    accepted_content_hash: agreement.content_hash,
    accepted_version: agreement.version,
  });

  if (error) throw new Error(error.message);
}
```

Also call a local `ensureAgreementSigned(campaignMemberId)` in mobile `submitContent`, `publishContent`, and `submitPerformance` by querying `campaign_member_agreement_status` and throwing `"Sign the campaign rules before continuing."` when status is `pending` or `needs_reacceptance`.

- [ ] **Step 5: Render mobile gate**

In `mobile/app/campaign-room/[id].tsx`, before tabs render:

```tsx
function renderAgreementGate() {
  if (!data?.agreement || !data.agreementStatus) return null;
  if (data.agreementStatus.status === "signed" || data.agreementStatus.status === "not_required") {
    return null;
  }

  return (
    <View className="px-6 pt-6">
      <Text style={{ color: palette.textPrimary, fontFamily: "Inter_600SemiBold" }} className="text-2xl">
        {t("agreement.title")}
      </Text>
      <Text style={{ color: palette.textSecondary, fontFamily: "Inter_400Regular" }} className="mt-2 text-sm">
        {t("agreement.detail")}
      </Text>
      {Object.entries(data.agreement.rules).map(([key, section]) => (
        <View key={key} className="mt-4 rounded-2xl border p-4" style={{ borderColor: palette.border, backgroundColor: palette.card }}>
          <Text style={{ color: palette.textPrimary, fontFamily: "Inter_600SemiBold" }}>{section.title}</Text>
          <Text style={{ color: palette.textSecondary, fontFamily: "Inter_400Regular" }} className="mt-1 text-sm">{section.body}</Text>
        </View>
      ))}
    </View>
  );
}
```

Add typed name and sign button in the same gate using `acceptCampaignAgreement`.

- [ ] **Step 6: Show mobile apply preview**

In `mobile/app/campaign/[id].tsx`, fetch safe `agreement_preview` from the same public API if this screen does not already have it in route params. Render a compact card:

```tsx
<View className="mt-4 rounded-2xl border p-4" style={{ borderColor: palette.border, backgroundColor: palette.card }}>
  <Text style={{ color: palette.textPrimary, fontFamily: "Inter_600SemiBold" }}>
    {t("agreement.previewTitle")}
  </Text>
  <Text className="mt-1 text-sm" style={{ color: palette.textSecondary, fontFamily: "Inter_400Regular" }}>
    {t("agreement.signAfterAcceptance")}
  </Text>
</View>
```

- [ ] **Step 7: Add mobile strings**

Add to `mobile/lib/strings.ts` and English mobile bundle:

```ts
"agreement.title": "Campaign Rules",
"agreement.detail": "Sign before the full brief, private assets, submissions, and reporting unlock.",
"agreement.previewTitle": "Campaign rules required",
"agreement.signAfterAcceptance": "If accepted, you will sign before work begins.",
"agreement.typedName": "Type your legal name",
"agreement.sign": "Sign and unlock campaign",
```

- [ ] **Step 8: Run mobile tests**

Run:

```bash
npm --prefix mobile test -- lib/creator-campaigns.test.ts
npm --prefix mobile run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit mobile gate**

Run:

```bash
git add mobile/lib/campaign-room.ts mobile/lib/campaign-actions.ts 'mobile/app/campaign-room/[id].tsx' 'mobile/app/campaign/[id].tsx' mobile/lib/creator-campaigns.test.ts mobile/lib/strings.ts mobile/lib/generated/mobile-bundles/en.json
git commit -m "feat: add mobile campaign agreement gate"
```

## Task 8: Seed Data And Smoke Route

**Files:**

- Modify: `src/app/(site)/dev/seed-report-performance/route.ts`
- Modify: `src/app/(site)/dev/seed-report-performance/route.test.ts`

- [ ] **Step 1: Add dev seed test**

In `src/app/(site)/dev/seed-report-performance/route.test.ts`, add:

```ts
it("can seed a campaign agreement gate for smoke testing", () => {
  expect(source).toContain("scenario === \"agreement-gate\"");
  expect(source).toContain("campaign_agreements");
  expect(source).toContain("campaign_agreement_acceptances");
  expect(source).toContain("content_hash");
});
```

- [ ] **Step 2: Run seed test to verify it fails**

Run:

```bash
npm test -- 'src/app/(site)/dev/seed-report-performance/route.test.ts'
```

Expected: FAIL until seed scenario exists.

- [ ] **Step 3: Add seed scenario**

In `src/app/(site)/dev/seed-report-performance/route.ts`, add `scenario=agreement-gate` that:

- Deletes active acceptances for the chosen campaign's members.
- Archives old test agreements for the campaign.
- Inserts one published `rules_and_brand_agreement` agreement with deterministic rules and hash.
- Leaves at least one accepted creator unsigned.

Use `hashAgreementContent` for content hash.

- [ ] **Step 4: Run seed tests**

Run:

```bash
npm test -- 'src/app/(site)/dev/seed-report-performance/route.test.ts'
```

Expected: PASS.

- [ ] **Step 5: Commit seed support**

Run:

```bash
git add 'src/app/(site)/dev/seed-report-performance/route.ts' 'src/app/(site)/dev/seed-report-performance/route.test.ts'
git commit -m "test: seed campaign agreement gate smoke data"
```

## Task 9: Full Verification And In-App Browser Smoke

**Files:** no new files unless failures require fixes.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm test -- src/lib/agreements/campaign-agreement.test.ts src/lib/agreements/agreement-upload.test.ts src/lib/supabase/campaign-agreement-gate-migration.test.ts src/app/actions/campaign-agreements.test.ts 'src/app/(site)/apply/[id]/agreement-preview-flow.test.ts' 'src/app/(site)/(app)/b/campaigns/[id]/page-flow.test.ts' 'src/app/(site)/(app)/i/campaigns/[id]/report-task-flow.test.ts'
```

Expected: PASS.

- [ ] **Step 2: Run broad verification**

Run:

```bash
npm run typecheck
npm run lint
git diff --check
```

Expected: all pass with no whitespace errors.

- [ ] **Step 3: Start or reuse dev server**

If port 3000 is not responding, run:

```bash
npm run dev
```

Expected: local app responds at `http://localhost:3000`.

- [ ] **Step 4: Seed agreement gate data**

Open in the in-app browser or fetch:

```text
http://localhost:3000/dev/seed-report-performance?campaignId=4707edb5-dcab-4b2d-b5eb-7e79f0e1f010&scenario=agreement-gate
```

Expected: JSON response shows an agreement id and at least one unsigned member.

- [ ] **Step 5: Smoke public apply preview in the in-app browser**

Use Browser Use with `iab` backend:

1. Navigate to `http://localhost:3000/apply/4707edb5-dcab-4b2d-b5eb-7e79f0e1f010`.
2. Verify `Campaign rules required` appears.
3. Verify the page does not expose private agreement body or file URL.
4. Capture screenshot to `output/playwright/agreement-apply-preview.png`.

Expected: compact preview card, no clutter, no console errors.

- [ ] **Step 6: Smoke creator gate in the in-app browser**

1. Navigate to `http://localhost:3000/auth/dev-login?role=creator`.
2. Navigate to `http://localhost:3000/i/campaigns/4707edb5-dcab-4b2d-b5eb-7e79f0e1f010`.
3. Verify the agreement gate appears before the tabs.
4. Try to access Submit tab if visible.
5. Verify protected work is not available until signature.
6. Check acknowledgement, type a legal name, and sign.
7. Verify campaign room tabs unlock.
8. Capture screenshot to `output/playwright/agreement-creator-gate-signed.png`.

Expected: gate blocks room before signing and unlocks after signing.

- [ ] **Step 7: Smoke brand status in the in-app browser**

1. Navigate to `http://localhost:3000/auth/dev-login?role=brand`.
2. Navigate to `http://localhost:3000/b/campaigns/4707edb5-dcab-4b2d-b5eb-7e79f0e1f010`.
3. Verify agreement panel appears.
4. Verify Members table has sortable Agreement column.
5. Verify signed creator shows `Signed`.
6. Capture screenshot to `output/playwright/agreement-brand-status.png`.

Expected: agreement status is visible without stealing page attention.

- [ ] **Step 8: Smoke blocked action negative path**

Reseed `scenario=agreement-gate`, then as creator attempt to submit content before signing.

Expected: action returns `Sign the campaign rules before continuing.` and no `content_submissions` row is created.

- [ ] **Step 9: Final commit**

After any smoke fixes:

```bash
git status --short
git add .
git commit -m "feat: require creator agreement before campaign work"
```

Only stage files from this feature. Do not stage unrelated dirty worktree files.

## Self-Review Checklist

- Spec coverage:
  - Data model: Task 1.
  - Storage and RLS: Task 1.
  - Brand setup: Task 5.
  - Public preview: Task 4.
  - Creator web gate: Task 6.
  - Mobile gate: Task 7.
  - Protected submissions, reporting, and evidence: Tasks 1 and 3.
  - Brand status visibility: Task 5.
  - Smoke tests: Task 9.
- No cron jobs, social tokens, token refreshers, or platform metric fetchers.
- No public Storage URLs.
- No broad legal claims.
- No user-facing hardcoded strings in product UI.
- No forbidden icons.
- No em dash characters.
