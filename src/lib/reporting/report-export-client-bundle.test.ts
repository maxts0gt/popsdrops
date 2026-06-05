import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const nextConfigSource = readFileSync(
  new URL("../../../next.config.ts", import.meta.url),
  "utf8",
);

describe("report export client bundle contract", () => {
  it("keeps browser report exports from failing on node scheme imports", () => {
    expect(nextConfigSource).toContain("NormalModuleReplacementPlugin");
    expect(nextConfigSource).toContain('resource.request.replace(/^node:/, "")');
    expect(nextConfigSource).toContain("fs: false");
    expect(nextConfigSource).toContain("https: false");
    expect(nextConfigSource).toContain("os: false");
    expect(nextConfigSource).toContain("path: false");
  });
});
