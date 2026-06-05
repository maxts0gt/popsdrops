import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dbApplicationsSource = readFileSync(
  new URL("./applications.ts", import.meta.url),
  "utf8",
);
const dbIndexSource = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

describe("legacy application database boundary", () => {
  it("does not expose application mutation helpers outside lifecycle-guarded server actions", () => {
    const legacyMutations = [
      "submitApplication",
      "acceptApplication",
      "rejectApplication",
      "counterOffer",
      "withdrawApplication",
      "respondToCounterOffer",
    ];

    for (const mutation of legacyMutations) {
      expect(dbApplicationsSource).not.toContain(`export async function ${mutation}`);
      expect(dbIndexSource).not.toContain(`${mutation},`);
    }
  });
});
