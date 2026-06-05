import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const earningsScreenSource = readFileSync(
  join(currentDir, "../app/(tabs)/earnings.tsx"),
  "utf8",
);
const earningsDataSource = readFileSync(
  join(currentDir, "earnings.ts"),
  "utf8",
);
const stringsSource = readFileSync(join(currentDir, "strings.ts"), "utf8");

describe("mobile earnings ledger", () => {
  it("presents earnings as status tracking, not payment processing", () => {
    expect(earningsScreenSource).toContain("getPaymentStatusMeta");
    expect(earningsScreenSource).toContain('t("earnings.trackingOnly")');
    expect(earningsScreenSource).toContain('t("earnings.campaignLedger")');
    expect(earningsScreenSource).toContain('testID="creator-earnings-ledger"');
    expect(earningsScreenSource).toContain('testID="creator-earnings-row"');
    expect(earningsScreenSource.toLowerCase()).not.toContain(
      "payment processing",
    );
    expect(earningsScreenSource.toLowerCase()).not.toContain("processor");
    expect(earningsScreenSource.toLowerCase()).not.toContain("payment sent");
    expect(stringsSource.toLowerCase()).not.toContain("pending payment");
  });

  it("covers every payment status the shared enum can produce", () => {
    for (const status of [
      "pending",
      "invoiced",
      "paid",
      "overdue",
      "failed",
      "refunded",
      "disputed",
    ]) {
      expect(earningsScreenSource).toContain(`earnings.status.${status}`);
      expect(stringsSource).toContain(`"earnings.status.${status}"`);
    }
  });

  it("tracks all accepted campaign rates instead of only completed campaigns", () => {
    expect(earningsDataSource).toContain("paidTotal");
    expect(earningsDataSource).toContain("openTotal");
    expect(earningsDataSource).toContain("trackedTotal");
    expect(earningsDataSource).not.toContain("isCompleted && paymentStatus");
  });
});
