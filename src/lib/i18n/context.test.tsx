import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { I18nProvider, useI18n } from "./context";

function Probe() {
  const { isLoading, isLocaleReady, t } = useI18n();

  return (
    <div
      data-loading={String(isLoading)}
      data-ready={String(isLocaleReady)}
      data-home={t("ui.common", "nav.home")}
    />
  );
}

describe("I18nProvider", () => {
  it("treats bundled non-English locales as ready without runtime fetching", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider initialLocale="ko">
        <Probe />
      </I18nProvider>,
    );

    expect(markup).toContain('data-loading="false"');
    expect(markup).toContain('data-ready="true"');
    expect(markup).toContain('data-home="Home"');
  });
});
