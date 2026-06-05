import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const homeScreenSource = readFileSync(
  join(currentDir, "../app/(tabs)/home.tsx"),
  "utf8",
);
const stringsSource = readFileSync(join(currentDir, "strings.ts"), "utf8");

describe("mobile creator home copy", () => {
  it("uses singular deadline copy when content is due in one day", () => {
    expect(stringsSource).toContain(
      '"home.dueTomorrow": "Content due tomorrow"',
    );
    expect(homeScreenSource).toContain("daysLeft === 1");
    expect(homeScreenSource).toContain('t("home.dueTomorrow")');
    expect(homeScreenSource.indexOf("daysLeft === 1")).toBeLessThan(
      homeScreenSource.indexOf('t("home.dueSoon"'),
    );
  });
});
