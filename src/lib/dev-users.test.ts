import { describe, expect, it } from "vitest";

import {
  getDevDisplayName,
  getDevCreatorSlug,
  getDevLoginRole,
  getDevUserEmail,
} from "./dev-users";

describe("dev user identity contract", () => {
  it("uses the canonical dev.popsdrops.com role emails", () => {
    expect(getDevUserEmail("creator")).toBe("creator@dev.popsdrops.com");
    expect(getDevUserEmail("brand")).toBe("brand@dev.popsdrops.com");
    expect(getDevUserEmail("admin")).toBe("admin@dev.popsdrops.com");
  });

  it("falls back unknown dev login roles to creator", () => {
    expect(getDevLoginRole("operator")).toBe("creator");
    expect(getDevUserEmail("operator")).toBe("creator@dev.popsdrops.com");
    expect(getDevDisplayName("operator")).toBe("Dev Creator");
  });

  it("uses a user-scoped creator slug so stale dev users cannot block provisioning", () => {
    expect(getDevCreatorSlug("14734f5f-6f4a-4293-a611-43622d69a64c")).toBe(
      "dev-creator-14734f5f",
    );
  });
});
