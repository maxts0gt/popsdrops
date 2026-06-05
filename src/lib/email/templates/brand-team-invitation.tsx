import { Link, Section, Text } from "@react-email/components";
import { EmailLayout, EmailSummary, styles } from "./layout";

interface BrandTeamInvitationEmailProps {
  recipientName: string;
  brandName: string;
  invitedByName: string;
  roleLabel: string;
  expiresAt: string;
  loginUrl: string;
  teamInvitationUrl: string;
}

function formatInvitationDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "14 days";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function BrandTeamInvitationEmail({
  recipientName = "Team member",
  brandName = "your brand workspace",
  invitedByName = "A teammate",
  roleLabel = "Manager",
  expiresAt = "",
  loginUrl = "https://popsdrops.com/login",
  teamInvitationUrl = loginUrl,
}: BrandTeamInvitationEmailProps) {
  const expiry = formatInvitationDate(expiresAt);

  return (
    <EmailLayout preview={`Join ${brandName} on PopsDrops`}>
      <Text style={styles.heading}>You were invited to {brandName}.</Text>
      <Text style={styles.paragraph}>
        {recipientName}, {invitedByName} invited you to join the {brandName}
        workspace on PopsDrops. Sign in with this email address to accept the
        invitation.
      </Text>
      <EmailSummary
        items={[
          { label: "Workspace", value: brandName },
          { label: "Role", value: roleLabel },
          { label: "Expires", value: expiry },
          { label: "Next action", value: "Sign in to accept" },
        ]}
      />
      <Section style={styles.ctaSection}>
        <Link href={teamInvitationUrl} style={styles.button}>
          Review invitation
        </Link>
      </Section>
    </EmailLayout>
  );
}
