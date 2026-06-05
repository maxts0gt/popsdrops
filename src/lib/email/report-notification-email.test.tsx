import { render } from "@react-email/components";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendEmail } from "./send";
import {
  buildNotificationEmail,
  sendNotificationEmail,
} from "./notify";

vi.mock("./send", () => ({
  sendEmail: vi.fn(),
}));

const sendEmailMock = vi.mocked(sendEmail);

const reportQueueData = {
  title: "Report ready to review",
  body: "Dev Creator submitted report proof for K-Beauty Retail Launch.",
  data: {
    campaign_id: "campaign-1",
    campaign_title: "K-Beauty Retail Launch",
    creator_name: "Dev Creator",
    report_task_id: "task-1",
  },
};

describe("report notification emails", () => {
  beforeEach(() => {
    sendEmailMock.mockReset();
  });

  it("builds brand report-ready email from the notification queue envelope", async () => {
    const email = buildNotificationEmail({
      type: "report_ready_for_review",
      recipientName: "Brand Manager",
      data: reportQueueData,
    });

    expect(email?.subject).toBe("Report ready to review: K-Beauty Retail Launch");
    const html = await render(email!.template);
    expect(html).toContain("Dev Creator submitted report proof");
    expect(html).toContain("/b/campaigns/campaign-1/report");
    expect(html).toContain("Open report");
  });

  it("builds brand correction-resubmitted email from the notification queue envelope", async () => {
    const email = buildNotificationEmail({
      type: "report_correction_resubmitted",
      recipientName: "Brand Manager",
      data: {
        ...reportQueueData,
        title: "Correction resubmitted",
        body: "Dev Creator resubmitted report proof for K-Beauty Retail Launch.",
      },
    });

    expect(email?.subject).toBe("Correction resubmitted: K-Beauty Retail Launch");
    const html = await render(email!.template);
    expect(html).toContain("resubmitted report proof");
    expect(html).toContain("/b/campaigns/campaign-1/report");
  });

  it("builds creator correction and follow-up emails with campaign-room links", async () => {
    for (const type of [
      "report_correction_requested",
      "report_follow_up_requested",
    ]) {
      const email = buildNotificationEmail({
        type,
        recipientName: "Dev Creator",
        data: {
          ...reportQueueData,
          title:
            type === "report_correction_requested"
              ? "Report correction requested"
              : "Report follow-up requested",
          body:
            type === "report_correction_requested"
              ? "Upload the full native analytics view."
              : "K-Beauty Retail Launch still needs performance proof.",
        },
      });

      expect(email?.subject).toContain("K-Beauty Retail Launch");
      const html = await render(email!.template);
      expect(html).toContain("/i/campaigns/campaign-1");
      expect(html).toContain("Open campaign");
    }
  });

  it("renders report notices with an explicit next action in the context block", async () => {
    const email = buildNotificationEmail({
      type: "report_correction_requested",
      recipientName: "Dev Creator",
      data: {
        ...reportQueueData,
        title: "Report correction requested",
        body: "Upload the full native analytics view.",
      },
    });

    const html = await render(email!.template);

    expect(html).toContain("Campaign");
    expect(html).toContain("K-Beauty Retail Launch");
    expect(html).toContain("Next action");
    expect(html).toContain("Open campaign");
  });

  it("sends report notifications instead of silently skipping them", async () => {
    await sendNotificationEmail({
      type: "report_follow_up_requested",
      recipientEmail: "creator@example.com",
      recipientName: "Dev Creator",
      data: reportQueueData,
    });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock.mock.calls[0][0]).toMatchObject({
      to: "creator@example.com",
      subject: "Report follow-up requested: K-Beauty Retail Launch",
    });
  });
});
