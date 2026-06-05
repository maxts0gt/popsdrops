import { render } from "@react-email/components";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createElement, type ReactElement } from "react";

import { ReportNotificationEmail } from "../src/lib/email/templates/report-notification";

export const DEFAULT_SMOKE_RECIPIENTS = [
  "email-smoke-primary@example.invalid",
  "email-smoke-secondary@example.invalid",
];

type SmokeEmailArgs = {
  recipients: string[];
  send: boolean;
  appUrl: string;
};

type SmokeEmailPayload = {
  subject: string;
  template: ReactElement;
};

type SmokeEmailDeliveryPayload = {
  html: string;
  subject: string;
  text: string;
};

function parseList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseSmokeEmailArgs(args: string[]): SmokeEmailArgs {
  const parsed: SmokeEmailArgs = {
    recipients: DEFAULT_SMOKE_RECIPIENTS,
    send: false,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://popsdrops.com",
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--send") {
      parsed.send = true;
      continue;
    }

    if (arg === "--dry-run") {
      parsed.send = false;
      continue;
    }

    if (arg === "--to") {
      parsed.recipients = parseList(args[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (arg.startsWith("--to=")) {
      parsed.recipients = parseList(arg.slice("--to=".length));
      continue;
    }

    if (arg === "--app-url") {
      parsed.appUrl = args[index + 1] ?? parsed.appUrl;
      index += 1;
      continue;
    }

    if (arg.startsWith("--app-url=")) {
      parsed.appUrl = arg.slice("--app-url=".length) || parsed.appUrl;
    }
  }

  if (parsed.recipients.length === 0) {
    throw new Error("At least one recipient is required.");
  }

  return parsed;
}

export function buildSmokeEmail({
  appUrl,
  now = new Date(),
}: {
  appUrl: string;
  now?: Date;
}): SmokeEmailPayload {
  const timestamp = now.toISOString();

  return {
    subject: `PopsDrops email smoke test ${timestamp}`,
    template: createElement(ReportNotificationEmail, {
      preview: "PopsDrops email delivery test",
      heading: "Email pipeline verified.",
      message:
        "This branded smoke email confirms that the PopsDrops notification path can render and deliver a production template.",
      campaignTitle: "Branded notification path",
      actionLabel: "Open PopsDrops",
      actionUrl: appUrl,
    }),
  };
}

export async function buildSmokeEmailDeliveryPayload({
  appUrl,
  now = new Date(),
}: {
  appUrl: string;
  now?: Date;
}): Promise<SmokeEmailDeliveryPayload> {
  const email = buildSmokeEmail({ appUrl, now });

  return {
    html: await render(email.template),
    subject: email.subject,
    text: await render(email.template, { plainText: true }),
  };
}

function readEnvFile(path: string) {
  const env: Record<string, string> = {};

  try {
    const content = readFileSync(path, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const equalsIndex = trimmed.indexOf("=");
      if (equalsIndex === -1) continue;
      const key = trimmed.slice(0, equalsIndex).trim();
      let value = trimmed.slice(equalsIndex + 1).trim();
      if (
        (value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
  } catch {
    return env;
  }

  return env;
}

function loadEmailEnv() {
  return {
    ...process.env,
    ...readEnvFile(resolve(process.cwd(), ".env.local")),
  };
}

async function sendViaSupabaseEmailFunction({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const env = loadEmailEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to, subject, html, text }),
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`send-email failed for ${to}: ${response.status} ${body}`);
  }

  return { to, status: response.status, body };
}

async function main() {
  const parsed = parseSmokeEmailArgs(process.argv.slice(2));
  const email = await buildSmokeEmailDeliveryPayload({ appUrl: parsed.appUrl });

  if (!parsed.send) {
    const outputPath = resolve(
      process.cwd(),
      "output/email-smoke/popsdrops-email-smoke.html",
    );
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, email.html);
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          outputPath,
          recipients: parsed.recipients,
          subject: email.subject,
        },
        null,
        2,
      ),
    );
    return;
  }

  for (const recipient of parsed.recipients) {
    const result = await sendViaSupabaseEmailFunction({
      to: recipient,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    console.log(JSON.stringify({ ok: true, ...result }));
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
