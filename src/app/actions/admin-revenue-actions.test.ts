import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const adminActionsSource = readFileSync(
  fileURLToPath(new URL("./admin.ts", import.meta.url)),
  "utf8",
);

describe("admin revenue actions", () => {
  it("checks admin access before parsing manual service fee override payloads", () => {
    const start = adminActionsSource.indexOf(
      "export async function updateCampaignServiceFeeStatus",
    );
    const actionSource = adminActionsSource.slice(
      start,
      adminActionsSource.indexOf("export async function", start + 1),
    );
    const adminCheckIndex = actionSource.indexOf("await requireAdmin()");
    const idParseIndex = actionSource.indexOf("idSchema.parse");
    const statusParseIndex = actionSource.indexOf("serviceFeeStatusSchema.parse");
    const noteParseIndex = actionSource.indexOf("serviceFeeNoteSchema.parse");

    expect(start).toBeGreaterThanOrEqual(0);
    expect(adminCheckIndex).toBeGreaterThanOrEqual(0);
    expect(adminCheckIndex).toBeLessThan(idParseIndex);
    expect(adminCheckIndex).toBeLessThan(statusParseIndex);
    expect(adminCheckIndex).toBeLessThan(noteParseIndex);
  });

  it("updates campaign service fee status with note-backed audit metadata", () => {
    expect(adminActionsSource).toContain(
      "export async function updateCampaignServiceFeeStatus",
    );
    expect(adminActionsSource).toContain("serviceFeeStatusSchema");
    expect(adminActionsSource).toContain("serviceFeeNoteSchema");
    expect(adminActionsSource).toContain(
      "buildManualServiceFeeTimestampUpdate",
    );
    expect(adminActionsSource).toContain(
      'service_fee_last_event_type: "admin.manual_status_update"',
    );
    expect(adminActionsSource).toContain(
      "service_fee_last_event_id: manualEventId",
    );
    expect(adminActionsSource).toContain("service_fee_last_event_at: now");
    expect(adminActionsSource).toContain("service_fee_status: validStatus");
    expect(adminActionsSource).toContain(
      'action: "update_campaign_service_fee_status"',
    );
    expect(adminActionsSource).toContain("manual_event_id: manualEventId");
    expect(adminActionsSource).toContain("previous_status");
    expect(adminActionsSource).toContain("new_status");
    expect(adminActionsSource).toContain("note: validNote");
    expect(adminActionsSource).toContain('revalidatePath("/admin/revenue")');
    expect(adminActionsSource).toContain('revalidatePath("/admin/campaigns")');
    expect(adminActionsSource).toContain("revalidatePath(`/admin/campaigns/${validId}`)");
    expect(adminActionsSource).toContain("revalidatePath(`/b/campaigns/${validId}`)");
  });
});
