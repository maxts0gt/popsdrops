import { createHash } from "node:crypto";

import { strings } from "./strings";

type TranslationSourcePayload = Record<string, Record<string, string>>;

function sortTranslationSourcePayload(
  payload: TranslationSourcePayload,
): TranslationSourcePayload {
  return Object.fromEntries(
    Object.entries(payload)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([pageKey, pageStrings]) => [
        pageKey,
        Object.fromEntries(
          Object.entries(pageStrings).sort(([a], [b]) => a.localeCompare(b)),
        ),
      ]),
  );
}

export function createTranslationSourceVersion(
  payload: TranslationSourcePayload,
): string {
  return createHash("sha256")
    .update(JSON.stringify(sortTranslationSourcePayload(payload)))
    .digest("hex");
}

export const PUBLIC_TRANSLATION_SOURCE_VERSION = createTranslationSourceVersion(
  strings as TranslationSourcePayload,
);
