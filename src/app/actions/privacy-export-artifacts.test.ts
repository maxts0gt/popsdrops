import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const edgeFunctionSource = readFileSync(
  new URL(
    "../../../supabase/functions/generate-privacy-export/index.ts",
    import.meta.url,
  ),
  "utf8",
);
const config = readFileSync(
  new URL("../../../supabase/config.toml", import.meta.url),
  "utf8",
);

describe("privacy export artifact generation", () => {
  it("generates private artifacts from a service-role Supabase function", () => {
    expect(edgeFunctionSource).toContain("requireServiceRole(req)");
    expect(edgeFunctionSource).toContain("PRIVACY_EXPORT_BUCKET");
    expect(edgeFunctionSource).toContain("privacy-exports");
    expect(edgeFunctionSource).toContain(".from(\"data_rights_requests\")");
    expect(edgeFunctionSource).toContain("status: \"processing\"");
    expect(edgeFunctionSource).toContain("status: \"completed\"");
    expect(edgeFunctionSource).toContain("processing_error");
    expect(edgeFunctionSource).toContain(".upload(storagePath");
    expect(edgeFunctionSource).toContain("export_storage_path");
    expect(edgeFunctionSource).toContain("export_expires_at");
    expect(edgeFunctionSource).toContain(".from(\"notification_queue\")");
    expect(edgeFunctionSource).toContain("template: \"data_export_ready\"");
    expect(edgeFunctionSource).toContain("download_expires_at");
  });

  it("registers the Supabase Edge Function with JWT verification", () => {
    expect(config).toContain("[functions.generate-privacy-export]");
    expect(config).toContain("verify_jwt = true");
  });
});
