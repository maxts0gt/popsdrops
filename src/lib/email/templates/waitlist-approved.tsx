import { Link, Section, Text } from "@react-email/components";
import { EmailLayout, styles } from "./layout";

interface WaitlistApprovedProps {
  name: string;
  role: "brand" | "creator";
  loginUrl: string;
}

export function WaitlistApprovedEmail({
  name = "User",
  role = "brand",
  loginUrl = "https://popsdrops.com/login",
}: WaitlistApprovedProps) {
  return (
    <EmailLayout preview="Your PopsDrops account has been approved">
      <Text style={styles.heading}>Your account is ready.</Text>
      <Text style={styles.paragraph}>
        {name}, you have been approved.{" "}
        {role === "brand"
          ? "You can now create campaigns and connect with vetted creators across global markets."
          : "Browse campaigns, complete your profile, and start applying to opportunities that match your audience."}
      </Text>
      <Section style={{ textAlign: "center" as const, margin: "28px 0 8px 0" }}>
        <Link href={loginUrl} style={styles.button}>
          Sign in to PopsDrops
        </Link>
      </Section>
    </EmailLayout>
  );
}
