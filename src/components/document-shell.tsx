import { Cairo, Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";

import { getDocumentI18n } from "@/lib/i18n/document";

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

export function DocumentShell({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: string | null | undefined;
}) {
  const { lang, dir } = getDocumentI18n(locale);

  return (
    <html
      lang={lang}
      dir={dir}
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
