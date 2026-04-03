import { describe, expect, it } from "vitest";

import { isAppShellReady } from "./app-shell";

describe("isAppShellReady", () => {
  it("waits for theme and locale readiness before rendering the shell", () => {
    expect(
      isAppShellReady({
        fontsLoaded: true,
        fontFallbackElapsed: false,
        themeReady: false,
        localeReady: true,
      }),
    ).toBe(false);

    expect(
      isAppShellReady({
        fontsLoaded: true,
        fontFallbackElapsed: false,
        themeReady: true,
        localeReady: false,
      }),
    ).toBe(false);
  });

  it("renders immediately once fonts, theme, and locale are ready", () => {
    expect(
      isAppShellReady({
        fontsLoaded: true,
        fontFallbackElapsed: false,
        themeReady: true,
        localeReady: true,
      }),
    ).toBe(true);
  });

  it("fails open after the font fallback deadline so the app never stays blank", () => {
    expect(
      isAppShellReady({
        fontsLoaded: false,
        fontFallbackElapsed: true,
        themeReady: true,
        localeReady: true,
      }),
    ).toBe(true);
  });
});
