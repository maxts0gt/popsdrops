import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260522004008_privacy_export_artifacts.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("privacy export artifacts migration", () => {
  it("stores privacy exports as private Supabase artifacts owned by path", () => {
    expect(migration).toContain("alter table public.data_rights_requests");
    expect(migration).toContain("export_storage_bucket");
    expect(migration).toContain("export_storage_path");
    expect(migration).toContain("export_file_name");
    expect(migration).toContain("export_mime_type");
    expect(migration).toContain("export_expires_at");
    expect(migration).toContain("insert into storage.buckets");
    expect(migration).toContain("'privacy-exports'");
    expect(migration).toContain("privacy_exports_objects_select");
    expect(migration).toContain(
      "app_private.uuid_path_segment(name, 1) = (select auth.uid())",
    );
  });
});
