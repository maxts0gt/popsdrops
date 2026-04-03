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
            url: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap",
            format: "woff2",
          }}
        />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Logo */}
          <Section style={logoSection}>
            <Text style={logoText}>PopsDrops</Text>
          </Section>

          {/* Content card */}
          <Section style={card}>{children}</Section>

          {/* Footer */}
          <Section style={footer}>
            <Hr style={divider} />
            <Text style={footerCompany}>
              Tengri Vertex, LLC
            </Text>
            <Text style={footerAddress}>
              San Francisco, California
            </Text>
            <Text style={footerMeta}>
              <Link href="https://popsdrops.com" style={footerLink}>
                popsdrops.com
              </Link>
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
    fontSize: "20px",
    fontWeight: "600",
    color: "#0F172A",
    lineHeight: "1.35",
    margin: "0 0 20px 0",
    letterSpacing: "-0.01em",
  } as const,

  paragraph: {
    fontSize: "15px",
    color: "#475569",
    lineHeight: "1.65",
    margin: "0 0 20px 0",
  } as const,

  muted: {
    fontSize: "13px",
    color: "#94A3B8",
    lineHeight: "1.5",
    margin: "0 0 12px 0",
  } as const,

  button: {
    display: "inline-block",
    backgroundColor: "#0F172A",
    color: "#FFFFFF",
    fontSize: "13px",
    fontWeight: "600",
    textDecoration: "none",
    padding: "12px 32px",
    borderRadius: "6px",
    textAlign: "center" as const,
    letterSpacing: "0.02em",
  } as const,

  card: {
    backgroundColor: "#F8FAFC",
    borderRadius: "8px",
    border: "1px solid #F1F5F9",
    padding: "16px 20px",
    margin: "20px 0",
  } as const,

  label: {
    fontSize: "11px",
    fontWeight: "500",
    color: "#94A3B8",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    margin: "0 0 6px 0",
  } as const,

  value: {
    fontSize: "15px",
    fontWeight: "600",
    color: "#0F172A",
    margin: "0",
  } as const,
};

// ---------------------------------------------------------------------------
// Layout styles
// ---------------------------------------------------------------------------

const body = {
  backgroundColor: "#FFFFFF",
  fontFamily:
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  margin: "0",
  padding: "0",
};

const container = {
  maxWidth: "520px",
  margin: "0 auto",
  padding: "48px 24px",
};

const logoSection = {
  padding: "0 0 32px 0",
  textAlign: "center" as const,
};

const logoText = {
  fontSize: "16px",
  fontWeight: "600",
  color: "#0F172A",
  margin: "0",
  letterSpacing: "-0.02em",
};

const card = {
  padding: "0",
};

const footer = {
  padding: "32px 0 0 0",
};

const divider = {
  borderColor: "#F1F5F9",
  borderWidth: "1px",
  margin: "0 0 24px 0",
};

const footerCompany = {
  fontSize: "11px",
  fontWeight: "500",
  color: "#94A3B8",
  lineHeight: "1.4",
  margin: "0",
  textAlign: "center" as const,
  letterSpacing: "0.04em",
};

const footerAddress = {
  fontSize: "11px",
  color: "#CBD5E1",
  lineHeight: "1.4",
  margin: "2px 0 0 0",
  textAlign: "center" as const,
};

const footerMeta = {
  fontSize: "11px",
  color: "#CBD5E1",
  lineHeight: "1.4",
  margin: "8px 0 0 0",
  textAlign: "center" as const,
};

const footerLink = {
  color: "#94A3B8",
  textDecoration: "none",
};
