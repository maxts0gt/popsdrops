import { describe, expect, it } from "vitest";

import {
  buildReportShareUrl,
  createReportShareToken,
  hashReportShareToken,
  isReportShareTokenShape,
} from "./report-share-links";

describe("report share links", () => {
  it("creates URL-safe tokens and hashes them before storage", async () => {
    const token = createReportShareToken();
    const tokenHash = await hashReportShareToken(token);

    expect(isReportShareTokenShape(token)).toBe(true);
    expect(token).not.toContain("+");
    expect(token).not.toContain("/");
    expect(token).not.toContain("=");
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenHash).not.toBe(token);
  });

  it("builds public report URLs without leaking raw campaign ids", () => {
    const url = buildReportShareUrl({
      origin: "https://popsdrops.com",
      token: "pd_test_token",
    });

    expect(url).toBe("https://popsdrops.com/reports/share/pd_test_token");
  });
});
