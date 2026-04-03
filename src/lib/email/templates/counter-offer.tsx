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
  campaignTitle = "Campaign",
  counterRate = 150,
  message,
  campaignUrl = "https://popsdrops.com",
}: CounterOfferProps) {
  return (
    <EmailLayout preview={`Counter offer: ${campaignTitle} — $${counterRate}`}>
      <Text style={styles.heading}>Counter offer.</Text>
      <Text style={styles.paragraph}>
        The brand has proposed ${counterRate} for this campaign.
      </Text>
      <Section style={styles.card}>
        <Text style={styles.label}>Campaign</Text>
        <Text style={styles.value}>{campaignTitle}</Text>
      </Section>
      <Section style={styles.card}>
        <Text style={styles.label}>Offered rate</Text>
        <Text style={styles.value}>${counterRate}</Text>
      </Section>
      {message && (
        <Section style={styles.card}>
          <Text style={styles.label}>Note from brand</Text>
          <Text style={{ ...styles.paragraph, margin: "4px 0 0 0" }}>
            {message}
          </Text>
        </Section>
      )}
      <Section style={{ textAlign: "center" as const, margin: "28px 0 8px 0" }}>
        <Link href={campaignUrl} style={styles.button}>
          Review offer
        </Link>
      </Section>
    </EmailLayout>
  );
}
