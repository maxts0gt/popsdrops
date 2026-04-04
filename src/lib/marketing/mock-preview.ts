export const MARKETING_MOCK_IDENTITIES = {
  yp: {
    badge: "YP",
    label: "Y. *****",
    marketKey: "south_korea",
    profileSlug: "creator-profile-yp",
  },
  st: {
    badge: "ST",
    label: "S. *****",
    marketKey: "japan",
    profileSlug: "creator-profile-st",
  },
  lm: {
    badge: "LM",
    label: "L. *****",
    marketKey: "france",
    profileSlug: "creator-profile-lm",
  },
  na: {
    badge: "NA",
    label: "N. *****",
    marketKey: "saudi_arabia",
    profileSlug: "creator-profile-na",
  },
  sr: {
    badge: "SR",
    label: "S. *****",
    marketKey: "mexico",
    profileSlug: "creator-profile-sr",
  },
} as const;

export function isMaskedMockLabel(label: string): boolean {
  return /^[A-Z]\. \*{5}$/.test(label);
}

export type MarketingMockIdentityId = keyof typeof MARKETING_MOCK_IDENTITIES;
