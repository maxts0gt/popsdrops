import type { PageKey } from "../strings";

export type PublicTranslationBundle = Partial<
  Record<PageKey, Record<string, string>>
>;

import en from "./public-bundles/en.json";
import de from "./public-bundles/de.json";
import es from "./public-bundles/es.json";
import fr from "./public-bundles/fr.json";
import id from "./public-bundles/id.json";
import it from "./public-bundles/it.json";
import ja from "./public-bundles/ja.json";
import ko from "./public-bundles/ko.json";
import tl from "./public-bundles/tl.json";
import zh from "./public-bundles/zh.json";

export const PUBLIC_TRANSLATION_BUNDLES: Partial<
  Record<string, PublicTranslationBundle>
> = {
  "en": en,
  "de": de,
  "es": es,
  "fr": fr,
  "id": id,
  "it": it,
  "ja": ja,
  "ko": ko,
  "tl": tl,
  "zh": zh,
};
