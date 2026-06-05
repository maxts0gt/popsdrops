import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReportNotificationEmail } from "./templates/report-notification";

vi.mock("server-only", () => ({}));

describe("sendEmail", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("sends both HTML and plain text to the Supabase email function", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ success: true })));

    const { sendEmail } = await import("./send");

    await sendEmail({
      subject: "PopsDrops email smoke test",
      template: createElement(ReportNotificationEmail, {
        actionLabel: "Open PopsDrops",
        actionUrl: "https://popsdrops.com",
        campaignTitle: "PopsDrops email delivery",
        heading: "Email pipeline verified.",
        message: "This confirms the branded email path.",
        preview: "PopsDrops email delivery test",
      }),
      to: "max@popsdrops.com",
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));

    expect(body.html).toContain("Email pipeline verified.");
    expect(body.text).toContain("Email pipeline verified.");
    expect(body.text).toContain("Open PopsDrops");
    expect(body.text).not.toContain("<table");
  });

  it("retries Supabase edge routing 404s before marking an email failed", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: "NOT_FOUND",
            message: "Requested function was not found",
          }),
          { status: 404 },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true })));

    const { sendEmail } = await import("./send");

    await sendEmail({
      subject: "PopsDrops email smoke test",
      template: createElement(ReportNotificationEmail, {
        actionLabel: "Open PopsDrops",
        actionUrl: "https://popsdrops.com",
        campaignTitle: "PopsDrops email delivery",
        heading: "Email pipeline verified.",
        message: "This confirms the branded email path.",
        preview: "PopsDrops email delivery test",
      }),
      to: "max@popsdrops.com",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
