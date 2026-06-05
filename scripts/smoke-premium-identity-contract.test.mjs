import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const sharedPremiumAcceptConsumers = [
  "smoke-content-report-ai-confirmed-source.mjs",
  "smoke-content-report-ai-source.mjs",
  "smoke-content-report-excused.mjs",
  "smoke-content-report-late.mjs",
  "smoke-content-report-manual-source.mjs",
  "smoke-content-report-recovery.mjs",
  "smoke-measurement-contract.mjs",
  "smoke-product-notification-actions.mjs",
  "smoke-reporting-requirement-config.mjs",
];

describe("premium smoke identity contract", () => {
  it.each(sharedPremiumAcceptConsumers)(
    "%s keeps shared accept-helper identity stable",
    (fileName) => {
      const source = readFileSync(new URL(`./${fileName}`, import.meta.url), "utf8");
      const runFunctionIndex = source.search(/async function run[A-Za-z0-9]+Smoke/);
      const adminIndex = source.indexOf("const admin = createAdminClient()", runFunctionIndex);
      const runLaunchSource = source.slice(runFunctionIndex, adminIndex);

      expect(source).toContain("ensureSmokeIdentityEnvDefaults");
      expect(runLaunchSource.indexOf("ensureSmokeIdentityEnvDefaults()")).toBeLessThan(
        runLaunchSource.indexOf("ensureDevServer"),
      );
      expect(source).toContain(
        'await submitCreatorApplication(client, targets);\n    await ensureSmokeDataDevUser(admin, "creator");',
      );
    },
  );
});
