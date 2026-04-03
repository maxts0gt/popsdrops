import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  resolveAppTheme,
  statusBarStyleForTheme,
  themePalettes,
} from "./theme";

describe("resolveAppTheme", () => {
  it("uses system theme by default", () => {
    expect(resolveAppTheme("system", "light")).toBe("light");
    expect(resolveAppTheme("system", "dark")).toBe("dark");
  });

  it("honors explicit theme overrides", () => {
    expect(resolveAppTheme("light", "dark")).toBe("light");
    expect(resolveAppTheme("dark", "light")).toBe("dark");
  });
});

describe("themePalettes", () => {
  it("provides distinct premium palettes for light and dark surfaces", () => {
    expect(themePalettes.light.background).toBe("#FFFFFF");
    expect(themePalettes.dark.background).toBe("#080810");
    expect(themePalettes.light.background).not.toBe(themePalettes.dark.background);
    expect(themePalettes.light.textPrimary).toBe("#0F172A");
    expect(themePalettes.dark.textPrimary).toBe("#F1F5F9");
    expect(themePalettes.dark.surface).not.toBe("#FFFFFF");
  });

  it("keeps the dark palette anchored with elevated surfaces and atmospheric accents", () => {
    expect(themePalettes.dark.surface).toBe("#12121E");
    expect(themePalettes.dark.tabBarBackground).toBe("#080810");
    expect(themePalettes.dark.atmosphereTeal).toBe("rgba(13, 148, 136, 0.06)");
    expect(themePalettes.dark.atmosphereAmber).toBe("rgba(245, 158, 11, 0.04)");
    expect(themePalettes.dark.surfaceMuted).toBe("#0F0F1A");
  });
});

describe("statusBarStyleForTheme", () => {
  it("inverts the status bar style for the active surface", () => {
    expect(statusBarStyleForTheme("light")).toBe("dark");
    expect(statusBarStyleForTheme("dark")).toBe("light");
  });
});

describe("mobile theme contract", () => {
  it("allows the app to follow system appearance", () => {
    const appJson = JSON.parse(
      readFileSync(path.resolve(__dirname, "..", "app.json"), "utf8"),
    ) as {
      expo?: {
        userInterfaceStyle?: string;
      };
    };

    expect(appJson.expo?.userInterfaceStyle).toBe("automatic");
  });
});
