import { describe, expect, it } from "vitest";

import {
  MARKETING_MOCK_IDENTITIES,
  isMaskedMockLabel,
} from "./mock-preview";

describe("MARKETING_MOCK_IDENTITIES", () => {
  it("uses masked public labels for every mock creator identity", () => {
    expect(
      Object.values(MARKETING_MOCK_IDENTITIES).every((identity) =>
        isMaskedMockLabel(identity.label),
      ),
    ).toBe(true);
  });

  it("keeps stable initials for avatar badges", () => {
    expect(MARKETING_MOCK_IDENTITIES.yp.badge).toBe("YP");
    expect(MARKETING_MOCK_IDENTITIES.st.badge).toBe("ST");
    expect(MARKETING_MOCK_IDENTITIES.lm.badge).toBe("LM");
    expect(MARKETING_MOCK_IDENTITIES.na.badge).toBe("NA");
    expect(MARKETING_MOCK_IDENTITIES.sr.badge).toBe("SR");
  });
});
