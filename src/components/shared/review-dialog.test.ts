import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./review-dialog.tsx", import.meta.url), "utf8");
describe("ReviewDialog trigger contract", () => {
  it("uses one real trigger element instead of rendering through a Fragment", () => {
    expect(source).toContain("const trigger = isValidElement(children)");
    expect(source).toContain("<DialogTrigger render={trigger} />");
    expect(source).not.toContain("<DialogTrigger render={<>{children}</>} />");
  });
});
