import type { PageKey } from "./strings";

export type WebEditorialOverrides = Partial<
  Record<PageKey, Record<string, string>>
>;

export const WEB_EDITORIAL_OVERRIDES: Partial<
  Record<string, WebEditorialOverrides>
> = {
  el: {
    "ui.common": {
      "language.preparingTitle": "Το PopsDrops αλλάζει σε {language}",
    },
  },
  hi: {
    "brand.home": {
      "greeting": "आपका फिर से स्वागत है, {name}",
    },
  },
  it: {
    "ui.common": {
      "language.preparingTitle": "Stiamo passando PopsDrops in {language}",
    },
  },
  kk: {
    "brand.home": {
      "greeting": "Қайта қош келдіңіз, {name}",
    },
  },
  ko: {
    "ui.common": {
      "language.preparingTitle": "PopsDrops를 {language}로 전환하는 중입니다",
    },
    "brand.home": {
      "greeting": "다시 오신 것을 환영합니다, {name}님",
    },
  },
  nl: {
    "ui.common": {
      "language.preparingTitle": "PopsDrops wordt overgezet naar {language}",
    },
  },
  ro: {
    "ui.common": {
      "language.preparingTitle": "PopsDrops trece la {language}",
    },
  },
  sw: {
    "ui.common": {
      "language.preparingTitle": "PopsDrops inabadilishwa hadi {language}",
    },
  },
  th: {
    "ui.common": {
      "language.preparingTitle": "กำลังเปลี่ยน PopsDrops เป็นภาษา {language}",
    },
  },
  tr: {
    "brand.home": {
      "greeting": "Tekrar hoş geldiniz, {name}",
    },
  },
  uz: {
    "brand.home": {
      "greeting": "Yana xush kelibsiz, {name}",
    },
  },
};

export function applyWebEditorialOverrides(
  bundle: Partial<Record<PageKey, Record<string, string>>>,
  overrides?: WebEditorialOverrides,
): Partial<Record<PageKey, Record<string, string>>> {
  if (!overrides) {
    return bundle;
  }

  const merged: Partial<Record<PageKey, Record<string, string>>> = {
    ...bundle,
  };

  for (const [pageKey, pageStrings] of Object.entries(overrides) as Array<
    [PageKey, Record<string, string>]
  >) {
    merged[pageKey] = {
      ...(merged[pageKey] ?? {}),
      ...pageStrings,
    };
  }

  return merged;
}
