import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dbContentSource = readFileSync(new URL("./content.ts", import.meta.url), "utf8");
const dbIndexSource = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

describe("legacy content database boundary", () => {
  it("does not expose content and proof mutation helpers outside lifecycle-guarded server actions", () => {
    const legacyMutations = [
      "submitContent",
      "approveContent",
      "requestRevision",
      "publishContent",
      "submitPerformance",
    ];

    for (const mutation of legacyMutations) {
      expect(dbContentSource).not.toContain(`export async function ${mutation}`);
      expect(dbIndexSource).not.toContain(`${mutation},`);
    }
  });
});
