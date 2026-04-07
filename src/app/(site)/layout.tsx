import { DocumentShell } from "@/components/document-shell";
import { getLocale } from "@/lib/i18n/server";
import { ROOT_METADATA } from "@/lib/root-metadata";
import "../globals.css";

export const metadata = ROOT_METADATA;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <DocumentShell locale={locale}>
      {children}
    </DocumentShell>
  );
}
