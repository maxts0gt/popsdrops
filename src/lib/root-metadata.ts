import type { Metadata } from "next";

export const ROOT_METADATA: Metadata = {
  title: {
    default: "PopsDrops — Creator Campaigns Without Borders",
    template: "%s | PopsDrops",
  },
  description:
    "Global cross-border influencer marketing. Run creator campaigns in any market. Translated briefs. Curated matching. Per-platform analytics.",
  metadataBase: new URL("https://www.popsdrops.com"),
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
