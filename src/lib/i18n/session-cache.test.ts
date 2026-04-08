import { describe, expect, it, beforeEach } from "vitest";

import { beginLocaleFetch } from "./fetch-state";
import {
  getSessionFetchState,
  getSessionTranslationCache,
  hasFetchedLocaleInSession,
  hydrateLocaleSession,
  markFetchedLocaleInSession,
  resetI18nSessionCache,
  setSessionFetchState,
} from "./session-cache";

describe("i18n session cache", () => {
  beforeEach(() => {
    resetI18nSessionCache();
  });

  it("hydrates translations without marking incomplete locales as ready", () => {
    hydrateLocaleSession(
      "ko",
      {
        "marketing.landing": {
          headline: "헤드라인",
        },
      },
      false,
    );

    expect(
      getSessionTranslationCache().ko?.["marketing.landing"]?.headline,
    ).toBe("헤드라인");
    expect(hasFetchedLocaleInSession("ko")).toBe(false);
  });

  it("remembers fetched locales for later provider instances", () => {
    markFetchedLocaleInSession("ko");

    expect(hasFetchedLocaleInSession("ko")).toBe(true);
  });

  it("stores fetch state across consumers", () => {
    const next = beginLocaleFetch(getSessionFetchState(), "ko");
    setSessionFetchState(next.state);

    expect(getSessionFetchState()).toEqual(next.state);
  });
});
