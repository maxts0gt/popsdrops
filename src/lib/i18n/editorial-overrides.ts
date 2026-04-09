import type { PageKey } from "./strings";

export type WebEditorialOverrides = Partial<
  Record<PageKey, Record<string, string>>
>;

export const WEB_EDITORIAL_OVERRIDES: Partial<
  Record<string, WebEditorialOverrides>
> = {
  de: {
    "ui.common": {
      "nav.home": "Start",
    },
  },
  el: {
    "ui.common": {
      "language.preparingTitle": "Το PopsDrops αλλάζει σε {language}",
    },
  },
  es: {
    "brand.home": {
      "greeting": "Nos alegra verte de nuevo, {name}",
    },
  },
  fr: {
    "brand.home": {
      "greeting": "Quel plaisir de vous retrouver, {name}",
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
  ja: {
    "ui.common": {
      "nav.discover": "探す",
    },
    "onboarding.creator": {
      "field.addSocial.hint":
        "普段投稿しているすべてのプラットフォームを追加してください。ユーザー名またはプロフィールリンクを貼り付けてください。",
      "action.addPlatform": "別のプラットフォームを追加",
    },
    "brand.home": {
      "greeting": "{name}様、お戻りいただきありがとうございます",
    },
    "brand.creators": {
      "title": "クリエイター一覧",
    },
    "creator.profile": {
      "connectSheet.connectDescription":
        "ユーザー名またはプロフィールリンクとフォロワー数を入力してください。",
    },
  },
  kk: {
    "brand.home": {
      "greeting": "Қайта қош келдіңіз, {name}",
    },
  },
  ko: {
    "ui.common": {
      "nav.discover": "둘러보기",
      "language.preparingTitle": "PopsDrops를 {language}로 전환하는 중입니다",
    },
    "onboarding.creator": {
      "action.addPlatform": "다른 플랫폼 추가",
    },
    "brand.home": {
      "greeting": "다시 오신 것을 환영합니다, {name}님",
    },
    "brand.creators": {
      "title": "크리에이터 디렉터리",
    },
    "creator.profile": {
      "connectSheet.connectDescription":
        "계정명 또는 프로필 링크와 팔로워 수를 입력하세요.",
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
  zh: {
    "brand.home": {
      "title": "仪表盘",
    },
    "brand.creators": {
      "title": "创作者名录",
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
