import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Hr,
  Font,
} from "@react-email/components";
import type { ReactNode } from "react";

interface EmailLayoutProps {
  preview: string;
  children: ReactNode;
}

export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head>
        <Font
          fontFamily="Inter"
          fallbackFontFamily="Helvetica"
          webFont={{
            url: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
            format: "woff2",
          }}
        />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logoText}>PopsDrops</Text>
          </Section>

          {/* Content */}
          <Section style={content}>{children}</Section>

          {/* Footer */}
          <Hr style={divider} />
          <Section style={footer}>
            <Text style={footerText}>
              This email was sent by{" "}
              <Link href="https://popsdrops.com" style={footerLink}>
                PopsDrops
              </Link>
              . You are receiving this because you have an account on our
              platform.
            </Text>
            <Text style={footerText}>
              Tengri Vertex, LLC &middot; San Francisco, California
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ---------------------------------------------------------------------------
// Shared component styles for templates
// ---------------------------------------------------------------------------

export const styles = {
  heading: {
    fontSize: "22px",
    fontWeight: "700",
    color: "#0F172A",
    lineHeight: "1.3",
    margin: "0 0 16px 0",
  } as const,

  paragraph: {
    fontSize: "15px",
    color: "#334155",
    lineHeight: "1.6",
    margin: "0 0 16px 0",
  } as const,

  muted: {
    fontSize: "14px",
    color: "#64748B",
    lineHeight: "1.5",
    margin: "0 0 12px 0",
  } as const,

  button: {
    display: "inline-block",
    backgroundColor: "#0F172A",
    color: "#FFFFFF",
    fontSize: "14px",
    fontWeight: "600",
    textDecoration: "none",
    padding: "12px 28px",
    borderRadius: "8px",
    textAlign: "center" as const,
  } as const,

  card: {
    backgroundColor: "#F8FAFC",
    borderRadius: "8px",
    padding: "16px 20px",
    margin: "16px 0",
  } as const,

  label: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#64748B",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    margin: "0 0 4px 0",
  } as const,

  value: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#0F172A",
    margin: "0",
  } as const,
};

// ---------------------------------------------------------------------------
// Layout styles
// ---------------------------------------------------------------------------

const body = {
  backgroundColor: "#F1F5F9",
  fontFamily:
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  margin: "0",
  padding: "0",
};

const container = {
  maxWidth: "560px",
  margin: "0 auto",
  padding: "40px 0 40px 0",
};

const header = {
  padding: "24px 32px 16px 32px",
};

const logoText = {
  fontSize: "20px",
  fontWeight: "700",
  color: "#0F172A",
  margin: "0",
  letterSpacing: "-0.02em",
};

const content = {
  backgroundColor: "#FFFFFF",
  borderRadius: "12px",
  padding: "32px",
  border: "1px solid #E2E8F0",
};

const divider = {
  borderColor: "#E2E8F0",
  margin: "24px 0",
};

const footer = {
  padding: "0 32px",
};

const footerText = {
  fontSize: "12px",
  color: "#94A3B8",
  lineHeight: "1.5",
  margin: "0 0 8px 0",
  textAlign: "center" as const,
};

const footerLink = {
  color: "#64748B",
  textDecoration: "underline",
};
