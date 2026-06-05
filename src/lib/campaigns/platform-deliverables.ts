import {
  CONTENT_FORMATS,
  PLATFORMS,
  type ContentFormat,
  type Platform,
} from "../constants";

type BuilderDeliverableDraft = {
  format: string;
  quantity: number;
};

export type CampaignPlatformDeliverableInput = {
  platform: Platform;
  content_type: ContentFormat;
  quantity: number;
};

const CAMPAIGN_DELIVERABLE_PLATFORM_SET = new Set<string>(PLATFORMS);
const CONTENT_FORMAT_SET = new Set<string>(CONTENT_FORMATS);

export function getCampaignDeliverablePlatforms(platforms: string[]): Platform[] {
  const seen = new Set<string>();
  const firstClassPlatforms: Platform[] = [];

  for (const platform of platforms) {
    if (!CAMPAIGN_DELIVERABLE_PLATFORM_SET.has(platform) || seen.has(platform)) {
      continue;
    }

    seen.add(platform);
    firstClassPlatforms.push(platform as Platform);
  }

  return firstClassPlatforms;
}

export function buildCampaignPlatformDeliverables(input: {
  platforms: string[];
  deliverables: BuilderDeliverableDraft[];
}): CampaignPlatformDeliverableInput[] {
  return getCampaignDeliverablePlatforms(input.platforms).flatMap((platform) =>
    input.deliverables.map((deliverable) => ({
      platform,
      content_type: getCampaignContentFormat(deliverable.format),
      quantity:
        Number.isFinite(deliverable.quantity) && deliverable.quantity > 0
          ? deliverable.quantity
          : 1,
    })),
  );
}

function getCampaignContentFormat(format: string): ContentFormat {
  return CONTENT_FORMAT_SET.has(format) ? (format as ContentFormat) : "short_video";
}
