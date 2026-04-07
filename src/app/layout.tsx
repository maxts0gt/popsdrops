import type { Metadata } from "next";
import { Inter, Cairo } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { LocaleProvider } from "@/components/locale-provider";
import { getCachedTranslations, getLocale } from "@/lib/i18n/server";
import { isRTLLocale, strings, type PageKey } from "@/lib/i18n/strings";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext", "cyrillic"],
  display: "swap",
});

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "PopsDrops — Creator Campaigns Without Borders",
    template: "%s | PopsDrops",
  },
  description:
    "Global cross-border influencer marketing. Run creator campaigns in any market. Translated briefs. Curated matching. Per-platform analytics.",
  metadataBase: new URL("https://popsdrops.com"),
  openGraph: {
    title: "PopsDrops — Creator Campaigns Without Borders",
    description:
      "Global cross-border influencer marketing platform. Any market, any language.",
    type: "website",
    locale: "en_US",
    siteName: "PopsDrops",
  },
  twitter: {
    card: "summary_large_image",
    title: "PopsDrops",
    description:
      "Creator campaigns without borders. Any market, any language.",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const isRTL = isRTLLocale(locale);

  // Pre-fetch only DB-cached translations so returning visitors hydrate immediately
  // without blocking cold-cache requests on a full server-side translation run.
  const allPageKeys = Object.keys(strings) as PageKey[];
  const initialTranslations = locale !== "en"
    ? await getCachedTranslations(allPageKeys, locale)
    : undefined;

  return (
    <html
      lang={locale}
      dir={isRTL ? "rtl" : "ltr"}
      className={`${inter.variable} ${cairo.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          forcedTheme="light"
          disableTransitionOnChange
        >
          <LocaleProvider locale={locale} initialTranslations={initialTranslations}>
            {children}
            <Toaster position={isRTL ? "top-left" : "top-right"} richColors />
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
