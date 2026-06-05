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
} from "@react-email/components";
import { Fragment, type ReactNode } from "react";

interface EmailLayoutProps {
  preview: string;
  children: ReactNode;
}

export type EmailSummaryItem = {
  label: string;
  value: ReactNode;
  multiline?: boolean;
};

export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={logoSection}>
            <Text style={logoText}>PopsDrops</Text>
            <Text style={logoSubtext}>Campaign operations</Text>
          </Section>

          <Section style={card}>{children}</Section>

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

export function EmailSummary({ items }: { items: EmailSummaryItem[] }) {
  return (
    <Section style={styles.card}>
      {items.map((item, index) => (
        <Fragment key={item.label}>
          <Text style={styles.label}>{item.label}</Text>
          <Text
            style={{
              ...(item.multiline ? styles.valueMultiline : styles.value),
              margin: index === items.length - 1 ? "0" : "0 0 14px 0",
            }}
          >
            {item.value}
          </Text>
        </Fragment>
      ))}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Shared component styles for templates
// ---------------------------------------------------------------------------

export const styles = {
  heading: {
    fontSize: "22px",
    fontWeight: "600",
    color: "#0F172A",
    lineHeight: "1.3",
    margin: "0 0 20px 0",
    letterSpacing: "0",
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
    padding: "12px 22px",
    borderRadius: "8px",
    textAlign: "center" as const,
    letterSpacing: "0",
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

  valueMultiline: {
    fontSize: "14px",
    fontWeight: "400",
    color: "#334155",
    lineHeight: "1.6",
    margin: "0",
  } as const,

  ctaSection: {
    textAlign: "center" as const,
    margin: "28px 0 8px 0",
  } as const,
};

// ---------------------------------------------------------------------------
// Layout styles
// ---------------------------------------------------------------------------

const body = {
  backgroundColor: "#F8FAFC",
  fontFamily:
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  margin: "0",
  padding: "0",
};

const container = {
  maxWidth: "560px",
  margin: "0 auto",
  padding: "48px 24px 40px",
};

const logoSection = {
  padding: "0 0 20px 0",
  textAlign: "left" as const,
};

const logoText = {
  fontSize: "17px",
  fontWeight: "600",
  color: "#0F172A",
  margin: "0",
  letterSpacing: "0",
};

const logoSubtext = {
  fontSize: "11px",
  color: "#94A3B8",
  lineHeight: "1.4",
  margin: "3px 0 0 0",
  letterSpacing: "0",
};

const card = {
  backgroundColor: "#FFFFFF",
  border: "1px solid #E2E8F0",
  borderRadius: "14px",
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
  padding: "32px",
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
