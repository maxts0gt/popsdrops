import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./smoke-measurement-contract.mjs", import.meta.url),
  "utf8",
);

describe("measurement contract smoke", () => {
  it("selects the proof sources report block before expecting proof-source lanes", () => {
    expect(source).toContain("report_block_ids");
    expect(source).toContain('report_preset_id: "proof_audit"');
    expect(source).toContain('"proof_sources"');
    expect(source.indexOf('"proof_sources"')).toBeLessThan(
      source.indexOf("focusBrandProofSourceLanes"),
    );
  });

  it("sets board-ready identity before app launch and reasserts it after creator dev-login", () => {
    const runSource = source.slice(
      source.indexOf("async function runMeasurementContractSmoke"),
      source.indexOf("const admin = createAdminClient()"),
    );

    expect(source).toContain("ensureSmokeIdentityEnvDefaults");
    expect(runSource.indexOf("ensureSmokeIdentityEnvDefaults()")).toBeLessThan(
      runSource.indexOf("ensureDevServer"),
    );
    expect(source).toContain(
      'await submitCreatorApplication(client, targets);\n    await ensureSmokeDataDevUser(admin, "creator");',
    );
  });
});
