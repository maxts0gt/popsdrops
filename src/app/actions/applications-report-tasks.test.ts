import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const applicationsSource = readFileSync(
  new URL("./applications.ts", import.meta.url),
  "utf8",
);

const privilegedSource = readFileSync(
  new URL("../../lib/supabase/privileged.ts", import.meta.url),
  "utf8",
);

describe("application acceptance report task hooks", () => {
  it("creates report tasks after privileged campaign member upsert", () => {
    expect(privilegedSource).toContain(
      "export async function upsertPrivilegedCampaignMember",
    );
    expect(privilegedSource).toContain(
      "export async function createPrivilegedReportTasksForMember",
    );
    expect(applicationsSource).toContain(
      "await createPrivilegedReportTasksForMember(member.id);",
    );
  });

  it("returns the campaign member row from the privileged upsert", () => {
    expect(privilegedSource).toContain('.select("id, campaign_id, creator_id")');
    expect(privilegedSource).toContain(".single();");
  });
});
