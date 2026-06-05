import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(
  readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
) as { scripts: Record<string, string> };

const agendaSource = readFileSync(
  resolve(
    process.cwd(),
    "docs/superpowers/plans/2026-05-15-launch-hardening-agenda.md",
  ),
  "utf8",
);

const releaseSmokeScripts = [
  "smoke:critical",
  "smoke:release-bad-paths",
  "smoke:notification-email",
  "smoke:notification-queue:audit",
  "smoke:notification-preferences",
  "smoke:report-correction-notification",
  "smoke:queue-backed-email",
  "smoke:product-notification-actions",
  "smoke:admin-control-tower",
  "smoke:admin-communications-retry",
  "smoke:admin-direct-email",
  "smoke:admin-settings-governance",
  "smoke:brand-access-approval",
  "smoke:brand-team-lifecycle",
  "smoke:brand-team-invite-ui",
  "smoke:brand-role-permissions",
  "smoke:campaign-responsibilities",
  "smoke:privacy-controls",
  "smoke:report-export-ui",
  "smoke:report-export-artifacts",
];

const globalProofRoomScripts = [
  "smoke:clean-next",
  "smoke:release-candidate-story",
  "smoke:content-report-workflow",
  "smoke:content-report-recovery",
  "smoke:report-export-ui",
  "smoke:report-share-revoke",
  "smoke:clean-next",
  "smoke:report-export-artifacts",
  "smoke:admin-report-command-center",
  "smoke:large-campaign-creation",
  "smoke:large-campaign-capacity",
];

const releaseBadPathScripts = [
  "smoke:payment-spine",
  "smoke:content-report-recovery",
  "smoke:report-share-revoke",
  "smoke:campaign-lifecycle-matrix",
  "smoke:campaign-deadline-boundary",
  "smoke:completed-campaign-invite-lock",
  "smoke:completed-campaign-application-lock",
  "smoke:completed-campaign-work-lock",
];

describe("release smoke matrix", () => {
  it("keeps one release smoke command for the critical product loop", () => {
    expect(packageJson.scripts["smoke:release"]).toBeDefined();
    expect(packageJson.scripts["smoke:global-proof-room"]).toBeDefined();
    expect(packageJson.scripts["smoke:global-proof-room"]).toBe(
      globalProofRoomScripts.map((scriptName) => `npm run ${scriptName}`).join(" && "),
    );
    expect(packageJson.scripts["smoke:global-proof-room"]).not.toContain(
      "smoke:mobile-release",
    );
    expect(packageJson.scripts["smoke:global-proof-room"]).toMatch(
      /^npm run smoke:clean-next && npm run smoke:release-candidate-story/,
    );
    expect(packageJson.scripts["smoke:global-proof-room"].indexOf("npm run smoke:content-report-workflow")).toBeLessThan(
      packageJson.scripts["smoke:global-proof-room"].indexOf("npm run smoke:report-export-ui"),
    );
    expect(packageJson.scripts["smoke:global-proof-room"].indexOf("npm run smoke:content-report-recovery")).toBeLessThan(
      packageJson.scripts["smoke:global-proof-room"].indexOf("npm run smoke:report-export-ui"),
    );
    expect(packageJson.scripts["smoke:global-proof-room"].indexOf("npm run smoke:report-export-ui")).toBeLessThan(
      packageJson.scripts["smoke:global-proof-room"].indexOf("npm run smoke:report-share-revoke"),
    );
    expect(packageJson.scripts["smoke:global-proof-room"].indexOf("npm run smoke:report-share-revoke")).toBeLessThan(
      packageJson.scripts["smoke:global-proof-room"].lastIndexOf("npm run smoke:clean-next"),
    );
    expect(packageJson.scripts["smoke:global-proof-room"].lastIndexOf("npm run smoke:clean-next")).toBeLessThan(
      packageJson.scripts["smoke:global-proof-room"].indexOf("npm run smoke:report-export-artifacts"),
    );
    for (const scriptName of globalProofRoomScripts) {
      expect(packageJson.scripts[scriptName]).toBeDefined();
      expect(packageJson.scripts["smoke:global-proof-room"]).toContain(
        `npm run ${scriptName}`,
      );
    }
    expect(packageJson.scripts["smoke:service-fee-gate"]).toBeDefined();
    expect(packageJson.scripts["smoke:payment-spine"]).toBeDefined();
    expect(packageJson.scripts["smoke:critical"]).toContain(
      "npm run smoke:service-fee-gate",
    );
    expect(packageJson.scripts["smoke:release-bad-paths"]).toContain(
      "npm run smoke:payment-spine",
    );
    for (const scriptName of releaseBadPathScripts) {
      expect(packageJson.scripts[scriptName]).toBeDefined();
      expect(packageJson.scripts["smoke:release-bad-paths"]).toContain(
        `npm run ${scriptName}`,
      );
    }
    expect(packageJson.scripts["smoke:payment-spine"]).toContain(
      "npm run check:stripe-payments",
    );
    expect(packageJson.scripts["smoke:payment-spine"]).toContain(
      "npm run smoke:stripe-checkout",
    );
    expect(packageJson.scripts["smoke:payment-spine"]).toContain(
      "npm run smoke:stripe-negative",
    );
    expect(packageJson.scripts["smoke:payment-spine"]).toContain(
      "npm run smoke:stripe-cancelled",
    );
    expect(packageJson.scripts["smoke:payment-spine"]).toContain(
      "npm run smoke:stripe-recovery",
    );
    expect(packageJson.scripts["smoke:payment-spine"]).toContain(
      "npm run smoke:admin-service-fee-override",
    );
    expect(packageJson.scripts["smoke:payment-spine"]).toContain(
      "npm run smoke:large-campaign-capacity",
    );
    expect(packageJson.scripts["smoke:mobile-submit-readiness"]).toBe(
      "npm --prefix mobile run release:submit:check && npm --prefix mobile run release:creator-proof:check",
    );
    expect(packageJson.scripts["smoke:mobile-release"]).toBe(
      "npm run smoke:mobile-submit-readiness && npm --prefix mobile run release:post-submit:check",
    );
    expect(packageJson.scripts["smoke:release"]).toContain(
      "npm run smoke:release-bad-paths",
    );
    expect(packageJson.scripts["smoke:clean-next"]).toBe(
      "node -e \"require('node:fs').rmSync('.next',{recursive:true,force:true})\"",
    );
    expect(packageJson.scripts["smoke:web-release"]).toBeDefined();
    expect(packageJson.scripts["smoke:web-release"]).toMatch(
      /^npm run smoke:clean-next && npm run smoke:critical/,
    );
    expect(packageJson.scripts["smoke:web-release"]).not.toContain(
      "smoke:mobile-release",
    );
    expect(packageJson.scripts["smoke:release"]).toMatch(
      /^npm run smoke:clean-next && npm run smoke:critical/,
    );
    expect(packageJson.scripts["smoke:release"]).not.toContain(
      "smoke:mobile-release",
    );
    expect(packageJson.scripts["smoke:release"].indexOf("npm run smoke:report-export-ui")).toBeLessThan(
      packageJson.scripts["smoke:release"].indexOf("npm run smoke:report-export-artifacts"),
    );

    for (const scriptName of releaseSmokeScripts) {
      expect(packageJson.scripts[scriptName]).toBeDefined();
      expect(packageJson.scripts["smoke:release"]).toContain(
        `npm run ${scriptName}`,
      );
    }

    for (const scriptName of releaseSmokeScripts) {
      expect(packageJson.scripts["smoke:web-release"]).toContain(
        `npm run ${scriptName}`,
      );
    }
  });

  it("tracks the release smoke command as the first launch hardening task", () => {
    expect(agendaSource).toContain("Task 1: Release Smoke Command");
    expect(agendaSource).toContain("npm run smoke:release");
    expect(agendaSource).toContain("100-creator payment spine");
    expect(agendaSource).toContain("campaign detail");
    expect(agendaSource).toContain("report correction notification");
  });
});
