import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const adminActionsSource = readFileSync(
  fileURLToPath(new URL("./admin.ts", import.meta.url)),
  "utf8",
);

function getActionSource(name: string) {
  const start = adminActionsSource.indexOf(`export async function ${name}`);
  expect(start).toBeGreaterThanOrEqual(0);

  const next = adminActionsSource.indexOf(
    "export async function",
    start + 1,
  );

  return adminActionsSource.slice(start, next === -1 ? undefined : next);
}

describe("admin action authority order", () => {
  it.each([
    ["approveWaitlistRequest", ["idSchema.parse"]],
    ["rejectWaitlistRequest", ["idSchema.parse", "reasonSchema.parse"]],
    ["approveProfile", ["idSchema.parse"]],
    ["rejectProfile", ["idSchema.parse", "reasonSchema.parse"]],
    ["fetchAdminUserDetail", ["idSchema.parse"]],
    ["fetchAdminAuditEntries", ["adminAuditEntriesSchema.parse"]],
    ["suspendUser", ["idSchema.parse", "reasonSchema.parse"]],
    ["unsuspendUser", ["idSchema.parse"]],
    ["reReviewProfile", ["idSchema.parse", "reasonSchema.parse"]],
    ["pauseCampaign", ["idSchema.parse", "reasonSchema.parse"]],
    ["cancelCampaign", ["idSchema.parse", "reasonSchema.parse"]],
    ["resumeCampaign", ["idSchema.parse"]],
    ["extendContentDeadline", ["idSchema.parse", "new Date(newDeadline)"]],
    [
      "updateCampaignServiceFeeStatus",
      [
        "idSchema.parse",
        "serviceFeeStatusSchema.parse",
        "serviceFeeNoteSchema.parse",
      ],
    ],
    ["excuseAdminReportTask", ["idSchema.parse"]],
    [
      "updateEnterpriseConciergeRequestStatus",
      ["idSchema.parse", "enterpriseConciergeRequestStatusSchema.parse"],
    ],
    [
      "quoteEnterpriseConciergeRequest",
      [
        "idSchema.parse",
        "quotedServiceFeeDollarsSchema.parse",
        "quoteNoteSchema.parse",
      ],
    ],
    [
      "updateDataRightsRequestStatus",
      ["idSchema.parse", "dataRightsRequestStatusSchema.parse"],
    ],
    ["updatePlatformSetting", ["z.string().min(1).max(100).parse"]],
    ["sendOrRetryNotificationEmail", ["idSchema.parse"]],
  ])("%s authenticates before payload validation", (name, validationTokens) => {
    const actionSource = getActionSource(name);
    const adminCheckIndex = actionSource.indexOf("await requireAdmin()");

    expect(adminCheckIndex).toBeGreaterThanOrEqual(0);

    for (const token of validationTokens) {
      const validationIndex = actionSource.indexOf(token);

      expect(validationIndex).toBeGreaterThanOrEqual(0);
      expect(adminCheckIndex).toBeLessThan(validationIndex);
    }
  });
});
