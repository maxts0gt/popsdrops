import { Link, Section, Text } from "@react-email/components";
import { EmailLayout, EmailSummary, styles } from "./layout";

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
    <EmailLayout preview={`Counter offer: ${campaignTitle}, $${counterRate}`}>
      <Text style={styles.heading}>Counter offer received.</Text>
      <Text style={styles.paragraph}>
        {creatorName}, the brand proposed a new rate. Review the offer before
        accepting or declining.
      </Text>
      <EmailSummary
        items={[
          { label: "Campaign", value: campaignTitle },
          { label: "Offered rate", value: `$${counterRate}` },
          ...(message
            ? [{ label: "Note from brand", value: message, multiline: true }]
            : []),
          { label: "Next action", value: "Review offer" },
        ]}
      />
      <Section style={styles.ctaSection}>
        <Link href={campaignUrl} style={styles.button}>
          Review offer
        </Link>
      </Section>
    </EmailLayout>
  );
}
