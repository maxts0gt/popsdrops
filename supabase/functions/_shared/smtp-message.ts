const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLAIN_TEXT_ENTITIES: Record<string, string> = {
  "#39": "'",
  amp: "&",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: "\"",
};

export type SmtpMimeMessageInput = {
  fromAddress: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  date?: Date;
  boundary?: string;
};

export type SmtpMimeMessage = {
  envelopeFrom: string;
  recipient: string;
  subject: string;
  data: string;
};

export function rejectHeaderInjection(value: string, field: string) {
  if (/[\r\n]/.test(value)) {
    throw new Error(`Invalid ${field}`);
  }
}

export function validateEmailAddress(value: string, field: string) {
  const normalized = value.trim();
  rejectHeaderInjection(normalized, field);
  if (!EMAIL_REGEX.test(normalized)) {
    throw new Error(`Invalid ${field}`);
  }
  return normalized;
}

export function getEnvelopeFromAddress(fromAddress: string) {
  rejectHeaderInjection(fromAddress, "from address");
  const envelope = fromAddress.match(/<([^<>]+)>/)?.[1] || fromAddress;
  return validateEmailAddress(envelope, "from address");
}

export function sanitizeSubject(subject: string) {
  const normalized = subject.trim();
  rejectHeaderInjection(normalized, "subject");
  if (!normalized) {
    throw new Error("Invalid subject");
  }
  return normalized;
}

export function htmlToPlainText(html: string) {
  return html
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\b[^>]*>/gi, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\b[^>]*>/gi, " ")
    .replace(/<head\b[^>]*>[\s\S]*?<\/head\b[^>]*>/gi, " ")
    .replace(/<\/(p|div|section|article|h[1-6]|tr)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#39|amp|gt|lt|nbsp|quot);/g, (_, entity: string) => {
      return PLAIN_TEXT_ENTITIES[entity] ?? `&${entity};`;
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function dotStuffSmtpBody(value: string) {
  const normalized = value.replace(/\r?\n/g, "\r\n");
  return normalized.replace(/(^|\r\n)\./g, "$1..");
}

function createBoundary() {
  return `popsdrops-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

export function buildSmtpMimeMessage({
  boundary = createBoundary(),
  date = new Date(),
  fromAddress,
  html,
  subject,
  text,
  to,
}: SmtpMimeMessageInput): SmtpMimeMessage {
  const recipient = validateEmailAddress(to, "recipient email");
  const safeSubject = sanitizeSubject(subject);
  const envelopeFrom = getEnvelopeFromAddress(fromAddress);
  const plainText = (text?.trim() || htmlToPlainText(html)).trim();

  if (!html.trim()) {
    throw new Error("Invalid html");
  }

  if (!plainText) {
    throw new Error("Invalid text");
  }

  const message = [
    `From: ${fromAddress}`,
    `To: ${recipient}`,
    `Subject: ${safeSubject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    `Date: ${date.toUTCString()}`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    plainText,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    html.trim(),
    "",
    `--${boundary}--`,
  ].join("\r\n");

  return {
    data: dotStuffSmtpBody(message),
    envelopeFrom,
    recipient,
    subject: safeSubject,
  };
}
