import { Link, Section, Text } from "@react-email/components";
import { EmailLayout, EmailSummary, styles } from "./layout";

interface ApplicationReceivedProps {
  brandName: string;
  creatorName: string;
  campaignTitle: string;
  proposedRate: number;
  campaignUrl: string;
}

export function ApplicationReceivedEmail({
  brandName = "Brand team",
  creatorName = "Creator",
  campaignTitle = "Campaign",
  proposedRate = 200,
  campaignUrl = "https://popsdrops.com",
}: ApplicationReceivedProps) {
  return (
    <EmailLayout preview={`New application: ${campaignTitle}`}>
      <Text style={styles.heading}>New application received.</Text>
      <Text style={styles.paragraph}>
        {brandName}, {creatorName} applied to your campaign. Review the fit,
        rate, and profile before accepting.
      </Text>
      <EmailSummary
        items={[
          { label: "Campaign", value: campaignTitle },
          { label: "Creator", value: creatorName },
          { label: "Proposed rate", value: `$${proposedRate}` },
          { label: "Next action", value: "Review application" },
        ]}
      />
      <Section style={styles.ctaSection}>
        <Link href={campaignUrl} style={styles.button}>
          Review application
        </Link>
      </Section>
    </EmailLayout>
  );
}
