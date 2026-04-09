import type { PageKey } from "../strings";

export type PlatformTranslationBundle = Partial<
  Record<PageKey, Record<string, string>>
>;

import ar from "./platform-bundles/ar.json";
import bn from "./platform-bundles/bn.json";
import de from "./platform-bundles/de.json";
import el from "./platform-bundles/el.json";
import en from "./platform-bundles/en.json";
import es from "./platform-bundles/es.json";
import fa from "./platform-bundles/fa.json";
import fr from "./platform-bundles/fr.json";
import he from "./platform-bundles/he.json";
import hi from "./platform-bundles/hi.json";
import id from "./platform-bundles/id.json";
import it from "./platform-bundles/it.json";
import ja from "./platform-bundles/ja.json";
import kk from "./platform-bundles/kk.json";
import ko from "./platform-bundles/ko.json";
import ms from "./platform-bundles/ms.json";
import nl from "./platform-bundles/nl.json";
import pl from "./platform-bundles/pl.json";
import pt from "./platform-bundles/pt.json";
import ro from "./platform-bundles/ro.json";
import ru from "./platform-bundles/ru.json";
import sv from "./platform-bundles/sv.json";
import sw from "./platform-bundles/sw.json";
import th from "./platform-bundles/th.json";
import tl from "./platform-bundles/tl.json";
import tr from "./platform-bundles/tr.json";
import uk from "./platform-bundles/uk.json";
import uz from "./platform-bundles/uz.json";
import vi from "./platform-bundles/vi.json";
import zh from "./platform-bundles/zh.json";

export const PLATFORM_TRANSLATION_BUNDLES: Partial<
  Record<string, PlatformTranslationBundle>
> = {
  "ar": ar,
  "bn": bn,
  "de": de,
  "el": el,
  "en": en,
  "es": es,
  "fa": fa,
  "fr": fr,
  "he": he,
  "hi": hi,
  "id": id,
  "it": it,
  "ja": ja,
  "kk": kk,
  "ko": ko,
  "ms": ms,
  "nl": nl,
  "pl": pl,
  "pt": pt,
  "ro": ro,
  "ru": ru,
  "sv": sv,
  "sw": sw,
  "th": th,
  "tl": tl,
  "tr": tr,
  "uk": uk,
  "uz": uz,
  "vi": vi,
  "zh": zh,
};
