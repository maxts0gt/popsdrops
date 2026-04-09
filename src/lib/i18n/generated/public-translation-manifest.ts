import type { PageKey } from "../strings";

export type PublicTranslationBundle = Partial<
  Record<PageKey, Record<string, string>>
>;

import ar from "./public-bundles/ar.json";
import bn from "./public-bundles/bn.json";
import de from "./public-bundles/de.json";
import el from "./public-bundles/el.json";
import en from "./public-bundles/en.json";
import es from "./public-bundles/es.json";
import fa from "./public-bundles/fa.json";
import fr from "./public-bundles/fr.json";
import he from "./public-bundles/he.json";
import hi from "./public-bundles/hi.json";
import id from "./public-bundles/id.json";
import it from "./public-bundles/it.json";
import ja from "./public-bundles/ja.json";
import kk from "./public-bundles/kk.json";
import ko from "./public-bundles/ko.json";
import ms from "./public-bundles/ms.json";
import nl from "./public-bundles/nl.json";
import pl from "./public-bundles/pl.json";
import pt from "./public-bundles/pt.json";
import ro from "./public-bundles/ro.json";
import ru from "./public-bundles/ru.json";
import sv from "./public-bundles/sv.json";
import sw from "./public-bundles/sw.json";
import th from "./public-bundles/th.json";
import tl from "./public-bundles/tl.json";
import tr from "./public-bundles/tr.json";
import uk from "./public-bundles/uk.json";
import uz from "./public-bundles/uz.json";
import vi from "./public-bundles/vi.json";
import zh from "./public-bundles/zh.json";

export const PUBLIC_TRANSLATION_BUNDLES: Partial<
  Record<string, PublicTranslationBundle>
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
