import { describe, expect, it } from "vitest";

import {
  buildSmtpMimeMessage,
  htmlToPlainText,
} from "./smtp-message";

describe("SMTP MIME message builder", () => {
  it("builds a multipart plain text and HTML message for Gmail-friendly delivery", () => {
    const message = buildSmtpMimeMessage({
      boundary: "popsdrops-test-boundary",
      date: new Date("2026-05-12T04:30:00.000Z"),
      fromAddress: "PopsDrops <notifications@popsdrops.com>",
      html: "<main><h1>Email pipeline verified.</h1><p>Open PopsDrops</p></main>",
      subject: "PopsDrops email smoke test",
      to: "max@popsdrops.com",
    });

    expect(message.envelopeFrom).toBe("notifications@popsdrops.com");
    expect(message.recipient).toBe("max@popsdrops.com");
    expect(message.data).toContain(
      "Content-Type: multipart/alternative; boundary=\"popsdrops-test-boundary\"",
    );
    expect(message.data).toContain("Content-Type: text/plain; charset=UTF-8");
    expect(message.data).toContain("Email pipeline verified.");
    expect(message.data).toContain("Open PopsDrops");
    expect(message.data).toContain("Content-Type: text/html; charset=UTF-8");
    expect(message.data).toContain("<h1>Email pipeline verified.</h1>");
    expect(message.data).toContain("--popsdrops-test-boundary--");
  });

  it("derives readable plain text from branded React Email HTML", () => {
    expect(
      htmlToPlainText(
        "<html><body><p>PopsDrops</p><p>Campaign completed.</p><a>Open campaign</a></body></html>",
      ),
    ).toBe("PopsDrops\n\nCampaign completed.\n\nOpen campaign");
  });

  it("strips script, style, and head blocks with spaced closing tags", () => {
    expect(
      htmlToPlainText(
        "<html><head><title>Hidden</title></head ><style>p{color:red}</style ><script>alert('x')</script ><body><p>Visible</p></body></html>",
      ),
    ).toBe("Visible");
  });

  it("strips script blocks with malformed closing tag attributes", () => {
    expect(
      htmlToPlainText("<p>Before</p><script>alert('x')</script\t\n bar><p>After</p>"),
    ).toBe("Before\n\nAfter");
  });

  it("decodes supported entities once when deriving plain text", () => {
    expect(
      htmlToPlainText("<p>One&nbsp;&amp;&nbsp;two &amp;lt;not a tag&amp;gt;</p>"),
    ).toBe("One & two &lt;not a tag&gt;");
  });

  it("rejects header injection and invalid recipient addresses", () => {
    expect(() =>
      buildSmtpMimeMessage({
        fromAddress: "PopsDrops <notifications@popsdrops.com>",
        html: "<p>Hi</p>",
        subject: "Hello\r\nBcc: attacker@example.com",
        to: "max@popsdrops.com",
      }),
    ).toThrow("Invalid subject");

    expect(() =>
      buildSmtpMimeMessage({
        fromAddress: "PopsDrops <notifications@popsdrops.com>",
        html: "<p>Hi</p>",
        subject: "Hello",
        to: "not-an-email",
      }),
    ).toThrow("Invalid recipient email");
  });

  it("dot-stuffs plain and HTML body lines before SMTP DATA", () => {
    const message = buildSmtpMimeMessage({
      boundary: "popsdrops-test-boundary",
      fromAddress: "PopsDrops <notifications@popsdrops.com>",
      html: ".Html line",
      subject: "Dot stuffing",
      text: ".Plain line",
      to: "max@popsdrops.com",
    });

    expect(message.data).toContain("\r\n..Plain line\r\n");
    expect(message.data).toContain("\r\n..Html line\r\n");
  });
});
