import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  getDevBrandTeamDisplayName,
  getDevBrandTeamEmail,
  getDevBrandTeamRole,
  getDevBrandCompanyName,
  getDevDisplayName,
  getDevCreatorSlug,
  getDevLoginRole,
  getDevLoginRedirectOrigin,
  getDevUserEmail,
} from "./dev-users";

describe("dev user identity contract", () => {
  it("uses the canonical dev.popsdrops.com role emails", () => {
    expect(getDevUserEmail("creator")).toBe("creator@dev.popsdrops.com");
    expect(getDevUserEmail("brand")).toBe("brand@dev.popsdrops.com");
    expect(getDevUserEmail("admin")).toBe("admin@dev.popsdrops.com");
  });

  it("uses distinct dev brand team identities for permission smoke tests", () => {
    expect(getDevBrandTeamRole(null)).toBe("owner");
    expect(getDevBrandTeamRole("operator")).toBe("owner");
    expect(getDevBrandTeamRole("viewer")).toBe("viewer");
    expect(getDevBrandTeamEmail("owner")).toBe("brand@dev.popsdrops.com");
    expect(getDevBrandTeamEmail("admin")).toBe("brand-admin@dev.popsdrops.com");
    expect(getDevBrandTeamEmail("manager")).toBe("brand-manager@dev.popsdrops.com");
    expect(getDevBrandTeamEmail("viewer")).toBe("brand-viewer@dev.popsdrops.com");
    expect(getDevBrandTeamDisplayName("viewer")).toBe("Dev Brand Viewer");
  });

  it("falls back unknown dev login roles to creator", () => {
    expect(getDevLoginRole("operator")).toBe("creator");
    expect(getDevUserEmail("operator")).toBe("creator@dev.popsdrops.com");
    expect(getDevDisplayName("operator")).toBe("Dev Creator");
  });

  it("lets report smoke opt into demo-quality creator display copy without changing other dev roles", () => {
    const previousDisplayName = process.env.SMOKE_CREATOR_DISPLAY_NAME;

    try {
      process.env.SMOKE_CREATOR_DISPLAY_NAME = "Mina Park";

      expect(getDevDisplayName("creator")).toBe("Mina Park");
      expect(getDevDisplayName("brand")).toBe("Dev Brand");
      expect(getDevDisplayName("admin")).toBe("Dev Admin");
    } finally {
      if (previousDisplayName === undefined) {
        delete process.env.SMOKE_CREATOR_DISPLAY_NAME;
      } else {
        process.env.SMOKE_CREATOR_DISPLAY_NAME = previousDisplayName;
      }
    }
  });

  it("lets report smoke opt into a demo-quality brand company name", () => {
    const previousCompanyName = process.env.SMOKE_BRAND_COMPANY_NAME;

    try {
      delete process.env.SMOKE_BRAND_COMPANY_NAME;
      expect(getDevBrandCompanyName()).toBe("Dev Brand Co.");

      process.env.SMOKE_BRAND_COMPANY_NAME = "Maison Lumiere";
      expect(getDevBrandCompanyName()).toBe("Maison Lumiere");
    } finally {
      if (previousCompanyName === undefined) {
        delete process.env.SMOKE_BRAND_COMPANY_NAME;
      } else {
        process.env.SMOKE_BRAND_COMPANY_NAME = previousCompanyName;
      }
    }
  });

  it("uses a user-scoped creator slug so stale dev users cannot block provisioning", () => {
    expect(getDevCreatorSlug("14734f5f-6f4a-4293-a611-43622d69a64c")).toBe(
      "dev-creator-14734f5f",
    );
  });

  it("preserves the browser host for dev login redirects", () => {
    expect(
      getDevLoginRedirectOrigin({
        requestUrl: "http://localhost:4000/auth/dev-login?role=brand",
        host: "127.0.0.1:4000",
      }),
    ).toBe("http://127.0.0.1:4000");
    expect(
      getDevLoginRedirectOrigin({
        requestUrl: "http://localhost:4000/auth/dev-login?role=brand",
        host: "localhost:4000",
      }),
    ).toBe("http://localhost:4000");
  });

  it("keeps dev login resilient under release-smoke auth pressure", () => {
    const routeSource = readFileSync(
      new URL("../app/auth/dev-login/route.ts", import.meta.url),
      "utf8",
    );

    expect(routeSource).toContain("DEV_LOGIN_REMOTE_ATTEMPTS");
    expect(routeSource).toContain("DEV_LOGIN_SESSION_CACHE_TTL_MS");
    expect(routeSource).toContain("DEV_LOGIN_SESSION_CACHE_VERSION");
    expect(routeSource).toContain("withDevLoginRetry");
    expect(routeSource).toContain("getCachedDevLoginSession");
    expect(routeSource).toContain("setCachedDevLoginSession");
    expect(routeSource).toContain("getDevLoginSessionCacheKey");
    expect(routeSource).toContain("workspaceIdentity");
    expect(routeSource).toContain("admin.auth.admin.generateLink");
    expect(routeSource).toContain("supabase.auth.verifyOtp");
    expect(routeSource).toContain("cachedSession.email !== targetEmail");
    expect(routeSource).toContain("return [];");
    expect(routeSource.indexOf("getCachedDevLoginSession")).toBeLessThan(
      routeSource.indexOf("admin.auth.admin.generateLink"),
    );
  });

  it("provisions real accepted brand team roles for dev smoke login", () => {
    const routeSource = readFileSync(
      new URL("../app/auth/dev-login/route.ts", import.meta.url),
      "utf8",
    );

    expect(routeSource).toContain("getDevBrandTeamRole");
    expect(routeSource).toContain("getDevBrandTeamEmail");
    expect(routeSource).toContain("getDevBrandTeamDisplayName");
    expect(routeSource).toContain("ensureDevBrandOwner");
    expect(routeSource).toContain("ensureDevBrandTeamMembership");
    expect(routeSource).toContain('.from("brand_team_members")');
    expect(routeSource).toContain("accepted_at");
    expect(routeSource).toContain('teamRole === "owner"');
    expect(routeSource).toContain("teamRole: devBrandTeamRole");
  });

  it("keeps dev user seeding passwordless", () => {
    const seedSource = readFileSync(
      new URL("../../scripts/seed-dev-users.mjs", import.meta.url),
      "utf8",
    );

    expect(seedSource).not.toContain("DEV_PASSWORD");
    expect(seedSource).not.toContain("password:");
    expect(seedSource).not.toContain("password auth");
    expect(seedSource).toContain("email_confirm: true");
    expect(seedSource).toContain("Dev users are ready for /dev/login");
  });
});
