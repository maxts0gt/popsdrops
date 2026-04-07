import type { Metadata } from "next";
import { Inter, Cairo } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { getSafePublicLocale } from "@/lib/i18n/public-locale";
import { isRTLLocale } from "@/lib/i18n/strings";
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
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const routeParams = await params;
  const routeLocale = typeof routeParams.locale === "string" ? routeParams.locale : undefined;
  const documentLocale = routeLocale ? getSafePublicLocale(routeLocale) : "en";
  const isRTL = isRTLLocale(documentLocale);

  return (
    <html
      lang={documentLocale}
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
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
