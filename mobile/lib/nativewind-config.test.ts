import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const tailwindConfig = require("../tailwind.config.js");

describe("NativeWind configuration", () => {
  it("uses class dark mode for the manual mobile theme preference", () => {
    expect(tailwindConfig.darkMode).toBe("class");
  });
});
