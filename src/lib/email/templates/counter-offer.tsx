import { Link, Section, Text } from "@react-email/components";
import { EmailLayout, styles } from "./layout";

interface CounterOfferProps {
  creatorName: string;
  campaignTitle: string;
  counterRate: number;
  message?: string;
  campaignUrl: string;
}

export function CounterOfferEmail({
  creatorName = "Creator",
  campaignTitle = "Campaign",
  counterRate = 150,
  message,
  campaignUrl = "https://popsdrops.com",
}: CounterOfferProps) {
  return (
    <EmailLayout preview={`Counter offer for "${campaignTitle}" — $${counterRate}`}>
      <Text style={styles.heading}>Counter offer received</Text>
      <Text style={styles.paragraph}>
        The brand has proposed a different rate for this campaign.
      </Text>
      <Section style={styles.card}>
        <Text style={styles.label}>Campaign</Text>
        <Text style={styles.value}>{campaignTitle}</Text>
      </Section>
      <Section style={styles.card}>
        <Text style={styles.label}>Proposed Rate</Text>
        <Text style={styles.value}>${counterRate}</Text>
      </Section>
      {message && (
        <Section style={styles.card}>
          <Text style={styles.label}>Message</Text>
          <Text style={{ ...styles.paragraph, margin: "4px 0 0 0" }}>
            {message}
          </Text>
        </Section>
      )}
      <Text style={styles.paragraph}>
        Review the offer and accept or decline.
      </Text>
      <Section style={{ textAlign: "center" as const, margin: "24px 0" }}>
        <Link href={campaignUrl} style={styles.button}>
          Review Offer
        </Link>
      </Section>
    </EmailLayout>
  );
}
