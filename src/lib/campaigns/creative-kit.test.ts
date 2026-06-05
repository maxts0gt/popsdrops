import { describe, expect, it } from "vitest";

import {
  getCreativeKitReadiness,
  pickCreatorFacingHeroAsset,
  type CampaignCreativeAsset,
} from "./creative-kit";

const baseAsset: CampaignCreativeAsset = {
  id: "asset-1",
  campaignId: "campaign-1",
  title: "Campaign image",
  description: null,
  assetType: "product_image",
  bucketId: "campaign-assets",
  storagePath: "campaign-1/asset-1/campaign-image.jpg",
  fileName: "campaign-image.jpg",
  mimeType: "image/jpeg",
  sizeBytes: 128_000,
  visibility: "public",
  status: "ready",
  createdAt: "2026-05-08T00:00:00.000Z",
  signedUrl: "https://example.com/campaign-image.jpg",
};

describe("campaign creative kit helpers", () => {
  it("uses ready public product imagery as the creator-facing hero", () => {
    const hero = pickCreatorFacingHeroAsset([
      { ...baseAsset, id: "private", visibility: "member" },
      { ...baseAsset, id: "logo", assetType: "logo", signedUrl: "https://example.com/logo.png" },
      baseAsset,
    ]);

    expect(hero).toEqual(baseAsset);
  });

  it("does not expose archived, private, or non-image assets as discovery imagery", () => {
    const hero = pickCreatorFacingHeroAsset([
      { ...baseAsset, id: "archived", status: "archived" },
      { ...baseAsset, id: "member", visibility: "member" },
      { ...baseAsset, id: "pdf", mimeType: "application/pdf" },
    ]);

    expect(hero).toBeNull();
  });

  it("treats a public product image as the minimum readiness signal for creator discovery", () => {
    expect(getCreativeKitReadiness([baseAsset])).toEqual({
      hasCreatorImage: true,
      isDiscoverReady: true,
      missing: [],
    });

    expect(getCreativeKitReadiness([])).toEqual({
      hasCreatorImage: false,
      isDiscoverReady: false,
      missing: ["creator-facing campaign image"],
    });
  });
});
