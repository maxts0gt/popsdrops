import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { I18nProvider, useI18n } from "./context";

const contextSource = readFileSync(new URL("./context.tsx", import.meta.url), "utf8");

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

  it("keeps page-scoped translation functions stable between unchanged locale renders", () => {
    const hookSource = contextSource.slice(
      contextSource.indexOf("export function useTranslation"),
    );

    expect(hookSource).toContain("const scopedT = useCallback(");
    expect(hookSource).toContain("t(pageKey, key, vars)");
    expect(hookSource).toContain("[t, pageKey]");
    expect(hookSource).toContain("t: scopedT");
  });
});
