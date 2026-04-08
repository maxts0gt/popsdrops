import type { PageKey } from "./strings";

export const PUBLIC_BUNDLE_PAGE_KEYS = [
  "ui.common",
  "marketing.landing",
  "marketing.forBrands",
  "marketing.forCreators",
  "marketing.about",
  "marketing.requestInvite",
  "auth.login",
  "public.apply",
] as const satisfies readonly PageKey[];
