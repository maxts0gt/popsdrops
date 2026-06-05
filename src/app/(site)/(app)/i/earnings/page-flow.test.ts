import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sourcePath = join(
  process.cwd(),
  "src/app/(site)/(app)/i/earnings/page.tsx",
);
const source = readFileSync(sourcePath, "utf8");

describe("creator earnings page flow", () => {
  it("presents creator earnings as a status ledger, not payment processing", () => {
    expect(source).toContain("getPaymentStatusMeta");
    expect(source).toContain('data-testid="creator-earnings-ledger"');
    expect(source).toContain('data-testid="creator-earnings-row"');
    expect(source).toContain('data-testid="creator-earnings-status"');
    expect(source).toContain('data-testid="creator-earnings-amount"');
    expect(source).toContain("trackingOnly");
    expect(source.toLowerCase()).not.toContain("payment processing");
    expect(source.toLowerCase()).not.toContain("processor");
    expect(source.toLowerCase()).not.toContain("payment sent");
  });

  it("covers every payment status the shared enum can produce", () => {
    expect(source).toContain("status.pending");
    expect(source).toContain("status.invoiced");
    expect(source).toContain("status.paid");
    expect(source).toContain("status.overdue");
    expect(source).toContain("status.failed");
    expect(source).toContain("status.refunded");
    expect(source).toContain("status.disputed");
  });

  it("keeps the empty discovery CTA single and unambiguous", () => {
    const discoverHrefCount =
      source.match(/href="\/i\/discover"/g)?.length ?? 0;
    expect(discoverHrefCount).toBe(1);
  });
});
