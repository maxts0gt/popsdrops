/**
 * send-email Edge Function
 *
 * Accepts { to, subject, html } and sends via AWS SES SMTP (port 465, implicit TLS).
 * Uses SMTP_USERNAME / SMTP_PASSWORD from Supabase secrets.
 * Authenticated with the exact service role key.
 */

const SMTP_HOST = Deno.env.get("SES_SMTP_HOST") || "email-smtp.us-east-1.amazonaws.com";
const SMTP_USER = Deno.env.get("SMTP_USERNAME")!;
const SMTP_PASS = Deno.env.get("SMTP_PASSWORD")!;
const FROM_ADDRESS = Deno.env.get("EMAIL_FROM") || "PopsDrops <notifications@popsdrops.com>";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const CONNECT_TIMEOUT_MS = 5_000;
const IO_TIMEOUT_MS = 5_000;
const TRANSACTION_TIMEOUT_MS = 15_000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, apikey, x-client-info",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

// ---------------------------------------------------------------------------
// SMTP over TLS (port 465)
// ---------------------------------------------------------------------------

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`SMTP ${label} timed out after ${ms}ms`));
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

function rejectHeaderInjection(value: string, field: string) {
  if (/[\r\n]/.test(value)) {
    throw new Error(`Invalid ${field}`);
  }
}

function validateEmailAddress(value: string, field: string) {
  const normalized = value.trim();
  rejectHeaderInjection(normalized, field);
  if (!EMAIL_REGEX.test(normalized)) {
    throw new Error(`Invalid ${field}`);
  }
  return normalized;
}

function getEnvelopeFromAddress() {
  rejectHeaderInjection(FROM_ADDRESS, "from address");
  const envelope = FROM_ADDRESS.match(/<([^<>]+)>/)?.[1] || FROM_ADDRESS;
  return validateEmailAddress(envelope, "from address");
}

function sanitizeSubject(subject: string) {
  const normalized = subject.trim();
  rejectHeaderInjection(normalized, "subject");
  if (!normalized) {
    throw new Error("Invalid subject");
  }
  return normalized;
}

function dotStuffSmtpBody(value: string) {
  const normalized = value.replace(/\r?\n/g, "\r\n");
  return normalized.replace(/(^|\r\n)\./g, "$1..");
}

async function sendViaSMTP(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const recipient = validateEmailAddress(to, "recipient email");
  const safeSubject = sanitizeSubject(subject);
  const fromAddr = getEnvelopeFromAddress();
  const safeHtml = dotStuffSmtpBody(html);
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let conn: Deno.TlsConn | null = null;

  async function read(): Promise<string> {
    if (!conn) throw new Error("SMTP connection not initialized");
    const buf = new Uint8Array(8192);
    const n = await withTimeout(conn.read(buf), IO_TIMEOUT_MS, "read");
    if (n === null) throw new Error("SMTP connection closed");
    return decoder.decode(buf.subarray(0, n));
  }

  async function send(cmd: string): Promise<string> {
    if (!conn) throw new Error("SMTP connection not initialized");
    await withTimeout(conn.write(encoder.encode(cmd + "\r\n")), IO_TIMEOUT_MS, "write");
    // Some responses come in multiple chunks (e.g. multi-line EHLO)
    let response = "";
    while (true) {
      const chunk = await read();
      response += chunk;
      // SMTP multi-line responses have dash after code, final line has space
      const lines = response.trim().split("\r\n");
      const lastLine = lines[lines.length - 1];
      if (/^\d{3} /.test(lastLine)) break;
      if (/^\d{3}$/.test(lastLine)) break;
    }
    return response;
  }

  function expect(response: string, code: string) {
    if (!response.startsWith(code)) {
      throw new Error(
        `SMTP: expected ${code}, got: ${response.trim().split("\r\n")[0]}`,
      );
    }
  }

  try {
    conn = await withTimeout(
      Deno.connectTls({ hostname: SMTP_HOST, port: 465 }),
      CONNECT_TIMEOUT_MS,
      "connect",
    );

    await withTimeout((async () => {
      expect(await read(), "220");
      expect(await send("EHLO popsdrops.com"), "250");

      // AUTH PLAIN — single base64 string: \0username\0password
      const authPlain = btoa(`\0${SMTP_USER}\0${SMTP_PASS}`);
      expect(await send(`AUTH PLAIN ${authPlain}`), "235");

      expect(await send(`MAIL FROM:<${fromAddr}>`), "250");
      expect(await send(`RCPT TO:<${recipient}>`), "250");
      expect(await send("DATA"), "354");

      const body = [
        `From: ${FROM_ADDRESS}`,
        `To: ${recipient}`,
        `Subject: ${safeSubject}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/html; charset=UTF-8`,
        `Date: ${new Date().toUTCString()}`,
        ``,
        safeHtml,
        ``,
        `.`,
      ].join("\r\n");

      expect(await send(body), "250");
      await send("QUIT");
    })(), TRANSACTION_TIMEOUT_MS, "transaction");
  } finally {
    try {
      conn?.close();
    } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: jsonHeaders },
    );
  }

  const token =
    req.headers.get("Authorization")?.replace("Bearer ", "") || "";

  if (!SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: "SMTP auth not configured" }),
      { status: 500, headers: jsonHeaders },
    );
  }

  if (!token || token !== SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: "Unauthorized — invalid token" }),
      { status: 401, headers: jsonHeaders },
    );
  }

  try {
    const { to, subject, html } = await req.json();

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, html" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    if (!SMTP_USER || !SMTP_PASS) {
      return new Response(
        JSON.stringify({ error: "SMTP credentials not configured" }),
        { status: 500, headers: jsonHeaders },
      );
    }

    await sendViaSMTP(to, subject, html);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: jsonHeaders },
    );
  } catch (err) {
    console.error("send-email error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
