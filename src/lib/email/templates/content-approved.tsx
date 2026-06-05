import { Link, Section, Text } from "@react-email/components";
import { EmailLayout, EmailSummary, styles } from "./layout";

interface ContentApprovedProps {
  creatorName: string;
  campaignTitle: string;
  campaignUrl: string;
}

export function ContentApprovedEmail({
  creatorName = "Creator",
  campaignTitle = "Campaign",
  campaignUrl = "https://popsdrops.com",
}: ContentApprovedProps) {
  return (
    <EmailLayout preview={`Approved: ${campaignTitle}`}>
      <Text style={styles.heading}>Your content has been approved.</Text>
      <Text style={styles.paragraph}>
        {creatorName}, the brand approved your submission. Publish when ready,
        then submit performance proof once the post is live.
      </Text>
      <EmailSummary
        items={[
          { label: "Campaign", value: campaignTitle },
          { label: "Next action", value: "View campaign" },
        ]}
      />
      <Section style={styles.ctaSection}>
        <Link href={campaignUrl} style={styles.button}>
          View campaign
        </Link>
      </Section>
    </EmailLayout>
  );
}
