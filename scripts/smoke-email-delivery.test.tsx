import { render } from "@react-email/components";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_SMOKE_RECIPIENTS,
  buildSmokeEmailDeliveryPayload,
  buildSmokeEmail,
  parseSmokeEmailArgs,
} from "./smoke-email-delivery";

describe("email smoke delivery script", () => {
  it("defaults to a dry run for non-deliverable smoke recipients", () => {
    const parsed = parseSmokeEmailArgs([]);

    expect(parsed.send).toBe(false);
    expect(parsed.recipients).toEqual([
      "email-smoke-primary@example.invalid",
      "email-smoke-secondary@example.invalid",
    ]);
    expect(DEFAULT_SMOKE_RECIPIENTS).not.toContain("max@popsdrops.com");
    expect(DEFAULT_SMOKE_RECIPIENTS).not.toContain("support@tengrivertex.com");
  });

  it("renders a branded React Email smoke message instead of raw HTML", async () => {
    const email = buildSmokeEmail({
      appUrl: "https://popsdrops.com",
      now: new Date("2026-05-12T04:30:00.000Z"),
    });

    expect(email.subject).toBe(
      "PopsDrops email smoke test 2026-05-12T04:30:00.000Z",
    );

    const html = await render(email.template);

    expect(html).toContain("Email pipeline verified.");
    expect(html).toContain("Branded notification path");
    expect(html).toContain("Next action");
    expect(html).toContain("PopsDrops");
    expect(html).toContain("Tengri Vertex, LLC");
    expect(html).toContain("background-color:#F8FAFC");
    expect(html).not.toContain("call the Supabase email function");
    expect(html).not.toContain("<h1 style=\"font-size:20px;margin:0 0 12px\"");
  });

  it("builds a multipart-ready delivery payload with a readable plain text part", async () => {
    const payload = await buildSmokeEmailDeliveryPayload({
      appUrl: "https://popsdrops.com",
      now: new Date("2026-05-12T04:30:00.000Z"),
    });

    expect(payload.html).toContain("Email pipeline verified.");
    expect(payload.text).toContain("Email pipeline verified.");
    expect(payload.text).toContain("Open PopsDrops");
    expect(payload.text).not.toContain("<table");
  });

  it("exposes the smoke script through npm", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
    );

    expect(packageJson.scripts["smoke:email"]).toBe(
      "npm exec -- tsx scripts/smoke-email-delivery.tsx",
    );
  });
});
