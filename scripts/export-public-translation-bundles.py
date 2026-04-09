#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
GENERATED_DIR = REPO_ROOT / "src/lib/i18n/generated/public-bundles"
MANIFEST_PATH = REPO_ROOT / "src/lib/i18n/generated/public-translation-manifest.ts"
LOCALES_PATH = REPO_ROOT / "src/lib/i18n/generated/public-translation-locales.ts"
SOURCE_BUNDLE_PATH = GENERATED_DIR / "en.json"
PUBLIC_PAGE_KEYS = [
    "ui.common",
    "marketing.landing",
    "marketing.forBrands",
    "marketing.forCreators",
    "marketing.about",
    "marketing.requestInvite",
    "auth.login",
    "public.apply",
]


def read_env(name: str) -> str | None:
    if name in os.environ and os.environ[name]:
        return os.environ[name]

    env_path = REPO_ROOT / ".env.local"
    if not env_path.exists():
        return None

    text = env_path.read_text()
    match = re.search(rf"^{re.escape(name)}=(.*)$", text, re.MULTILINE)
    if not match:
        return None

    return match.group(1).strip().strip('"').strip("'")


def fetch_translation_rows():
    supabase_url = read_env("NEXT_PUBLIC_SUPABASE_URL")
    service_role_key = read_env("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_role_key:
        raise SystemExit(
            "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
        )

    params = urllib.parse.urlencode(
        {
            "select": "locale,page_key,strings,overrides",
            "order": "locale.asc,page_key.asc",
            "page_key": f"in.({','.join(PUBLIC_PAGE_KEYS)})",
        }
    )
    request = urllib.request.Request(
        f"{supabase_url.rstrip('/')}/rest/v1/translations?{params}",
        headers={
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
        },
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        return json.loads(response.read().decode())


def build_locale_bundles(rows):
    bundles = defaultdict(dict)
    for row in rows:
        locale = row["locale"]
        page_key = row["page_key"]
        merged = dict(row.get("strings") or {})
        if row.get("overrides"):
            merged.update(row["overrides"])
        bundles[locale][page_key] = merged

    complete_locales = [
        locale
        for locale, bundle in sorted(bundles.items())
        if all(page_key in bundle for page_key in PUBLIC_PAGE_KEYS)
    ]
    return bundles, complete_locales


def write_bundle_json(locale: str, bundle: dict):
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    (GENERATED_DIR / f"{locale}.json").write_text(
        json.dumps(bundle, indent=2, ensure_ascii=False) + "\n"
    )


def write_manifest(locales):
    import_lines = [
        f'import {locale.replace("-", "_")} from "./public-bundles/{locale}.json";'
        for locale in locales
    ]
    bundle_lines = [
        f'  "{locale}": {locale.replace("-", "_")},' for locale in locales
    ]
    imports_text = "\n".join(import_lines)
    bundles_text = "\n".join(bundle_lines)
    output = (
        'import type { PageKey } from "../strings";\n\n'
        "export type PublicTranslationBundle = Partial<\n"
        "  Record<PageKey, Record<string, string>>\n"
        ">;\n\n"
        f"{imports_text}\n\n"
        "export const PUBLIC_TRANSLATION_BUNDLES: Partial<\n"
        "  Record<string, PublicTranslationBundle>\n"
        "> = {\n"
        f"{bundles_text}\n"
        "};\n"
    )
    MANIFEST_PATH.write_text(output)

    locale_lines = "\n".join(f'  "{locale}",' for locale in locales)
    locales_output = (
        "export const PUBLIC_TRANSLATION_LOCALES = [\n"
        f"{locale_lines}\n"
        "] as const;\n\n"
        "export type PublicTranslationLocale =\n"
        "  (typeof PUBLIC_TRANSLATION_LOCALES)[number];\n"
    )
    LOCALES_PATH.write_text(locales_output)


def main():
    source_bundle = json.loads(SOURCE_BUNDLE_PATH.read_text())
    rows = fetch_translation_rows()
    bundles, complete_locales = build_locale_bundles(rows)
    locales = ["en", *complete_locales]

    write_bundle_json("en", source_bundle)
    for locale in complete_locales:
        write_bundle_json(locale, bundles[locale])

    write_manifest(locales)
    print("Exported locales:", ", ".join(locales))


if __name__ == "__main__":
    main()
