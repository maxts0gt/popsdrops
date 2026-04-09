export type MobileTranslationBundle = Record<string, string>;

import ar from "./mobile-bundles/ar.json";
import bn from "./mobile-bundles/bn.json";
import de from "./mobile-bundles/de.json";
import el from "./mobile-bundles/el.json";
import en from "./mobile-bundles/en.json";
import es from "./mobile-bundles/es.json";
import fa from "./mobile-bundles/fa.json";
import fr from "./mobile-bundles/fr.json";
import he from "./mobile-bundles/he.json";
import hi from "./mobile-bundles/hi.json";
import id from "./mobile-bundles/id.json";
import it from "./mobile-bundles/it.json";
import ja from "./mobile-bundles/ja.json";
import kk from "./mobile-bundles/kk.json";
import ko from "./mobile-bundles/ko.json";
import ms from "./mobile-bundles/ms.json";
import nl from "./mobile-bundles/nl.json";
import pl from "./mobile-bundles/pl.json";
import pt from "./mobile-bundles/pt.json";
import ro from "./mobile-bundles/ro.json";
import ru from "./mobile-bundles/ru.json";
import sv from "./mobile-bundles/sv.json";
import sw from "./mobile-bundles/sw.json";
import th from "./mobile-bundles/th.json";
import tl from "./mobile-bundles/tl.json";
import tr from "./mobile-bundles/tr.json";
import uk from "./mobile-bundles/uk.json";
import uz from "./mobile-bundles/uz.json";
import vi from "./mobile-bundles/vi.json";
import zh from "./mobile-bundles/zh.json";

export const MOBILE_TRANSLATION_BUNDLES: Partial<
  Record<string, MobileTranslationBundle>
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
