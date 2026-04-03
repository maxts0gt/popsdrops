/**
 * send-email Edge Function
 *
 * Accepts { to, subject, html } and sends via AWS SES SMTP (port 465, implicit TLS).
 * Uses SMTP_USERNAME / SMTP_PASSWORD from Supabase secrets.
 * Authenticated with service_role JWT.
 */

const SMTP_HOST = Deno.env.get("SES_SMTP_HOST") || "email-smtp.us-east-1.amazonaws.com";
const SMTP_USER = Deno.env.get("SMTP_USERNAME")!;
const SMTP_PASS = Deno.env.get("SMTP_PASSWORD")!;
const FROM_ADDRESS = Deno.env.get("EMAIL_FROM") || "PopsDrops <notifications@popsdrops.com>";

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

async function sendViaSMTP(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const conn = await Deno.connectTls({ hostname: SMTP_HOST, port: 465 });
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  async function read(): Promise<string> {
    const buf = new Uint8Array(8192);
    const n = await conn.read(buf);
    if (n === null) throw new Error("SMTP connection closed");
    return decoder.decode(buf.subarray(0, n));
  }

  async function send(cmd: string): Promise<string> {
    await conn.write(encoder.encode(cmd + "\r\n"));
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
    expect(await read(), "220");
    expect(await send("EHLO popsdrops.com"), "250");

    // AUTH PLAIN — single base64 string: \0username\0password
    const authPlain = btoa(`\0${SMTP_USER}\0${SMTP_PASS}`);
    expect(await send(`AUTH PLAIN ${authPlain}`), "235");

    const fromAddr = FROM_ADDRESS.match(/<(.+)>/)?.[1] || FROM_ADDRESS;
    expect(await send(`MAIL FROM:<${fromAddr}>`), "250");
    expect(await send(`RCPT TO:<${to}>`), "250");
    expect(await send("DATA"), "354");

    // Build raw email
    const body = [
      `From: ${FROM_ADDRESS}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      `Date: ${new Date().toUTCString()}`,
      ``,
      html,
      ``,
      `.`,
    ].join("\r\n");

    expect(await send(body), "250");
    await send("QUIT");
  } finally {
    try {
      conn.close();
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

  // Verify caller is service_role
  const token =
    req.headers.get("Authorization")?.replace("Bearer ", "") || "";
  try {
    const payload = JSON.parse(atob(token.split(".")[1] || ""));
    if (payload.role !== "service_role") {
      return new Response(
        JSON.stringify({ error: "Unauthorized — service_role required" }),
        { status: 401, headers: jsonHeaders },
      );
    }
  } catch {
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
