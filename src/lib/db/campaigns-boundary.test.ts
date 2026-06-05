import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dbCampaignsSource = readFileSync(
  new URL("./campaigns.ts", import.meta.url),
  "utf8",
);
const dbIndexSource = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

describe("legacy campaign database boundary", () => {
  it("does not expose campaign mutation helpers outside lifecycle-guarded server actions", () => {
    const legacyMutations = [
      "createCampaign",
      "updateCampaign",
      "updateCampaignStatus",
    ];

    for (const mutation of legacyMutations) {
      expect(dbCampaignsSource).not.toContain(`export async function ${mutation}`);
      expect(dbIndexSource).not.toContain(`${mutation},`);
    }
  });
});
