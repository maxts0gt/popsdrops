import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { render } from "@react-email/components";
import type { ReactElement } from "react";

// ---------------------------------------------------------------------------
// SES Client (lazy init)
// ---------------------------------------------------------------------------

let sesClient: SESClient | null = null;

function getSESClient(): SESClient | null {
  if (sesClient) return sesClient;

  const region = process.env.AWS_SES_REGION;
  const accessKeyId = process.env.AWS_SES_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SES_SECRET_ACCESS_KEY;

  if (!region || !accessKeyId || !secretAccessKey) return null;

  sesClient = new SESClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  return sesClient;
}

// ---------------------------------------------------------------------------
// Send Email
// ---------------------------------------------------------------------------

const FROM_ADDRESS = process.env.EMAIL_FROM ?? "PopsDrops <notifications@popsdrops.com>";

interface SendEmailOptions {
  to: string;
  subject: string;
  template: ReactElement;
}

export async function sendEmail({ to, subject, template }: SendEmailOptions) {
  const html = await render(template);

  const client = getSESClient();

  if (!client) {
    // Dev fallback — log to console
    console.log("\n📧 EMAIL (dev mode — no SES credentials)");
    console.log(`   To: ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Preview: ${html.slice(0, 200)}...`);
    console.log("");
    return;
  }

  try {
    await client.send(
      new SendEmailCommand({
        Source: FROM_ADDRESS,
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: {
            Html: { Data: html, Charset: "UTF-8" },
          },
        },
      }),
    );
  } catch (error) {
    // Log but don't throw — email should never break the main action
    console.error("Failed to send email:", error);
  }
}
