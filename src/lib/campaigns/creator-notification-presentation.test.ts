import { describe, expect, it } from "vitest";

import { getCreatorNotificationPresentation } from "./creator-notification-presentation";

describe("creator notification presentation", () => {
  it("presents payment received as quiet payment status, not generic campaign noise", () => {
    expect(
      getCreatorNotificationPresentation({
        type: "payment_received",
        data: {
          payment_status: "paid",
        },
      }),
    ).toEqual({
      iconKey: "payment",
      tone: "success",
    });
  });

  it("presents overdue payment updates as payment status, not campaign announcements", () => {
    expect(
      getCreatorNotificationPresentation({
        type: "campaign_update",
        data: {
          payment_status: "overdue",
        },
      }),
    ).toEqual({
      iconKey: "payment",
      tone: "warning",
    });
  });

  it("keeps ordinary campaign updates visually quiet", () => {
    expect(
      getCreatorNotificationPresentation({
        type: "campaign_update",
        data: {
          campaign_id: "campaign-1",
        },
      }),
    ).toEqual({
      iconKey: "announcement",
      tone: "neutral",
    });
  });
});
