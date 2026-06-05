import { render } from "@react-email/components";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/email/send", () => ({
  sendEmail: vi.fn(),
}));

import { buildNotificationEmail } from "../src/lib/email/notification-email-builder";
import {
  CRITICAL_PRODUCT_NOTIFICATION_TYPES,
  DEFAULT_NOTIFICATION_SMOKE_PROFILE_EMAIL,
  buildSmokeNotificationPayload,
  ensureDefaultSmokeProfile,
  parseNotificationEmailSmokeArgs,
} from "./smoke-notification-email-flow";

describe("notification email flow smoke script", () => {
  it("defaults to a safe dry run across critical product notifications", () => {
    const parsed = parseNotificationEmailSmokeArgs([]);

    expect(parsed.send).toBe(false);
    expect(parsed.keep).toBe(false);
    expect(parsed.profileEmail).toBe(DEFAULT_NOTIFICATION_SMOKE_PROFILE_EMAIL);
    expect(parsed.types).toEqual(CRITICAL_PRODUCT_NOTIFICATION_TYPES);
  });

  it("can narrow the smoke to one notification type", () => {
    const parsed = parseNotificationEmailSmokeArgs(["--type", "campaign_update"]);

    expect(parsed.types).toEqual(["campaign_update"]);
  });

  it.each([
    ["application_rejected", "Application update: Notification Email Smoke Campaign"],
    [
      "report_correction_requested",
      "Report correction requested: Notification Email Smoke Campaign",
    ],
    ["campaign_update", "Campaign announcement: Notification Email Smoke Campaign"],
    ["campaign_completed", "Campaign completed: Notification Email Smoke Campaign"],
  ] as const)(
    "builds a branded %s notification email payload",
    async (type, subject) => {
      const payload = buildSmokeNotificationPayload({
        campaignId: "00000000-0000-4000-8000-00000000e101",
        campaignTitle: "Notification Email Smoke Campaign",
        now: new Date("2026-05-12T06:00:00.000Z"),
        smokeId: "pd_smoke_123",
        type,
        userId: "00000000-0000-4000-8000-000000000001",
      });

      expect(payload).toMatchObject({
        type,
        data: {
          campaignId: "00000000-0000-4000-8000-00000000e101",
          campaignTitle: "Notification Email Smoke Campaign",
          smokeId: "pd_smoke_123",
        },
      });

      const email = buildNotificationEmail({
        type: payload.type,
        recipientName: "Dev Creator",
        data: {
          title: payload.title,
          body: payload.body,
          data: payload.data,
        },
      });

      expect(email?.subject).toBe(subject);

      const html = await render(email!.template);
      expect(html).toContain("PopsDrops");
      expect(html).toContain("Tengri Vertex, LLC");
      expect(html).toContain("Notification Email Smoke Campaign");
    },
  );

  it.each([
    ["application_received", "Proposed rate", "$425"],
    ["application_accepted", "Agreed rate", "$475"],
    ["counter_offer", "Offered rate", "$520"],
    ["content_submitted", "Platform", "Instagram"],
  ] as const)(
    "builds realistic %s smoke email details instead of placeholder values",
    async (type, label, value) => {
      const payload = buildSmokeNotificationPayload({
        campaignId: "00000000-0000-4000-8000-00000000e101",
        campaignTitle: "Notification Email Smoke Campaign",
        now: new Date("2026-05-12T06:00:00.000Z"),
        smokeId: "pd_smoke_123",
        type,
        userId: "00000000-0000-4000-8000-000000000001",
      });

      const email = buildNotificationEmail({
        type: payload.type,
        recipientName: "Dev Creator",
        data: {
          title: payload.title,
          body: payload.body,
          data: payload.data,
        },
      });

      const html = await render(email!.template);

      expect(html).toContain(label);
      expect(html).toContain(value);
      expect(html).not.toContain("$0");
      expect(html).not.toContain("A creator");
    },
  );

  it("emits a separate artifact per type and recipient", () => {
    const script = readFileSync(
      new URL("./smoke-notification-email-flow.tsx", import.meta.url),
      "utf8",
    );

    expect(script).toContain("for (const type of args.types)");
    expect(script).toContain("outputPathForScenario");
    expect(script).toContain("type");
  });

  it("uses Supabase notification insert, queue lookup, and email function delivery", () => {
    const script = readFileSync(
      new URL("./smoke-notification-email-flow.tsx", import.meta.url),
      "utf8",
    );

    expect(script).toContain(".from(\"notifications\")");
    expect(script).toContain(".insert(notification)");
    expect(script).toContain(".from(\"notification_queue\")");
    expect(script).toContain("/functions/v1/send-email");
    expect(script).toContain("plainText: true");
    expect(script).toContain("text: rendered.text");
    expect(script).toContain("status: \"sent\"");
  });

  it("exposes the smoke script through npm", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
    );

    expect(packageJson.scripts["smoke:notification-email"]).toBe(
      "npm exec -- tsx scripts/smoke-notification-email-flow.tsx",
    );
  });

  it("repairs the default smoke profile when the auth user already exists", async () => {
    const upserts: Array<{ table: string; value: unknown }> = [];
    const createUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { message: "A user with this email address has already been registered" },
    });
    const listUsers = vi.fn().mockResolvedValue({
      data: {
        users: [
          {
            id: "00000000-0000-4000-8000-000000000777",
            email: DEFAULT_NOTIFICATION_SMOKE_PROFILE_EMAIL,
          },
        ],
      },
      error: null,
    });
    const admin = {
      auth: { admin: { createUser, listUsers } },
      from(table: string) {
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => ({ data: null, error: null }),
              }),
            }),
            upsert: (value: unknown) => {
              upserts.push({ table, value });
              return { data: null, error: null };
            },
          };
        }

        return {
          upsert: (value: unknown) => {
            upserts.push({ table, value });
            return { data: null, error: null };
          },
        };
      },
    };

    const profile = await ensureDefaultSmokeProfile(
      admin as never,
      DEFAULT_NOTIFICATION_SMOKE_PROFILE_EMAIL,
    );

    expect(profile).toMatchObject({
      id: "00000000-0000-4000-8000-000000000777",
      email: DEFAULT_NOTIFICATION_SMOKE_PROFILE_EMAIL,
    });
    expect(createUser).toHaveBeenCalledTimes(1);
    expect(listUsers).toHaveBeenCalled();
    expect(upserts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "profiles",
          value: expect.objectContaining({
            id: "00000000-0000-4000-8000-000000000777",
            email: DEFAULT_NOTIFICATION_SMOKE_PROFILE_EMAIL,
          }),
        }),
        expect.objectContaining({
          table: "creator_profiles",
          value: expect.objectContaining({
            profile_id: "00000000-0000-4000-8000-000000000777",
          }),
        }),
      ]),
    );
  });
});
