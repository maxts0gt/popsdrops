import type { Metadata } from "next";

import { getSafePlatformLocale } from "@/lib/i18n/platform-bundles";
import { buildPlatformPageMetadata } from "@/lib/i18n/platform-page-metadata";
import {
  getLocale,
  getPlatformCachedTranslations,
} from "@/lib/i18n/server";

import { LoginClient } from "./login-client";

export async function generateMetadata(): Promise<Metadata> {
  const locale = getSafePlatformLocale(await getLocale());
  const translations =
    locale !== "en" ? await getPlatformCachedTranslations(locale) : undefined;

  return buildPlatformPageMetadata({
    pageKey: "auth.login",
    translations,
    robots: {
      index: false,
      follow: false,
    },
  });
}

export default function LoginPage() {
  return <LoginClient />;
}
