export const MARKETING_MOCK_IDENTITIES = {
  yp: {
    badge: "YP",
    label: "Y. *****",
    marketKey: "south_korea",
  },
  st: {
    badge: "ST",
    label: "S. *****",
    marketKey: "japan",
  },
  lm: {
    badge: "LM",
    label: "L. *****",
    marketKey: "france",
  },
  na: {
    badge: "NA",
    label: "N. *****",
    marketKey: "saudi_arabia",
  },
  sr: {
    badge: "SR",
    label: "S. *****",
    marketKey: "mexico",
  },
} as const;

export function isMaskedMockLabel(label: string): boolean {
  return /^[A-Z]\. \*{5}$/.test(label);
}

export type MarketingMockIdentityId = keyof typeof MARKETING_MOCK_IDENTITIES;
