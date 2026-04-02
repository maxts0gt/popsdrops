import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
};

export default function TermsPage() {
  return (
    <div className="bg-white pt-28 pb-20 sm:pt-36">
      <article className="prose prose-slate mx-auto max-w-3xl px-6 prose-headings:tracking-tight prose-h1:text-3xl prose-h2:text-xl prose-h3:text-base">
        <h1>Terms of Service</h1>
        <p className="text-sm text-slate-500">Last updated: March 29, 2026</p>

        <p>
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of the PopsDrops platform
          (&quot;Service&quot;), operated by Tengri Vertex, LLC, a Delaware limited liability company
          (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), with its principal office
          in San Francisco, California.
        </p>
        <p>
          By accessing or using the Service, you agree to be bound by these Terms. If you do not agree,
          do not use the Service.
        </p>

        <h2>1. Eligibility</h2>
        <p>
          You must be at least 18 years old and capable of forming a binding contract to use the Service.
          By creating an account, you represent that you meet these requirements. If you are using the
          Service on behalf of an organization, you represent that you have authority to bind that
          organization to these Terms.
        </p>

        <h2>2. The Service</h2>
        <p>
          PopsDrops is a cross-border creator campaign platform that connects brands with content creators
          for influencer marketing campaigns. The Service provides campaign management, creator discovery,
          content review, and performance reporting tools.
        </p>
        <p>
          PopsDrops is a platform, not a party to any agreement between brands and creators. We do not
          employ creators, guarantee campaign outcomes, or process payments between brands and creators.
          Payment tracking features are for informational purposes only.
        </p>

        <h2>3. Accounts</h2>
        <p>
          You may sign in using Google OAuth or email-based magic link authentication. You are responsible
          for maintaining the security of your authentication credentials and for all activity that occurs
          under your account.
        </p>
        <p>
          You agree to provide accurate and complete information during registration and to keep your
          profile information current. You must notify us immediately at legal@popsdrops.com if you
          believe your account has been compromised.
        </p>
        <p>
          We reserve the right to suspend or terminate accounts that are inactive for an extended period,
          violate these Terms, or were created with false information.
        </p>

        <h2>4. User Roles</h2>
        <h3>Creators</h3>
        <p>
          Creators may connect social media accounts, set rates, apply to campaigns, submit content for
          review, and build a public profile on the platform. Creators are responsible for delivering
          content that meets campaign briefs and complying with applicable advertising disclosure laws
          in their jurisdiction.
        </p>
        <h3>Brands</h3>
        <p>
          Brands may create campaigns, review creator applications, approve content submissions, and
          access performance reports. Brands are responsible for providing clear briefs, respecting
          creator content rights as agreed per campaign, and making payments to creators directly
          outside the platform.
        </p>

        <h2>5. Content and Intellectual Property</h2>
        <p>
          <strong>Your content.</strong> You retain ownership of all content you create, upload, or submit
          through the Service (&quot;User Content&quot;). By submitting User Content, you grant us a
          non-exclusive, worldwide, royalty-free license to host, display, and transmit your User Content
          solely as necessary to operate and provide the Service. This license ends when you delete your
          User Content or account, except for copies in our backups which are deleted within 30 days.
        </p>
        <p>
          <strong>Our content.</strong> The Service, including its design, features, software, text, and
          graphics, is owned by Tengri Vertex, LLC and protected by intellectual property laws. You may
          not copy, modify, distribute, or reverse-engineer any part of the Service.
        </p>
        <p>
          <strong>AI-generated translations.</strong> The Service uses AI to translate campaign briefs and
          platform content. These translations are provided for convenience and may not be perfectly
          accurate. The original language version of any brief or agreement controls in case of
          discrepancy.
        </p>

        <h2>6. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service for any unlawful purpose or in violation of any applicable law</li>
          <li>Submit false, misleading, or fraudulent information, including fake engagement metrics or follower counts</li>
          <li>Impersonate another person or entity</li>
          <li>Harass, abuse, or threaten other users</li>
          <li>Upload malware, viruses, or any harmful code</li>
          <li>Scrape, crawl, or use automated means to access the Service without our written permission</li>
          <li>Interfere with or disrupt the Service or its infrastructure</li>
          <li>Circumvent any access controls, rate limits, or security measures</li>
          <li>Use the Service to send spam or unsolicited communications</li>
          <li>Infringe on the intellectual property rights of others</li>
        </ul>
        <p>
          We may suspend or terminate your access for violations of this section, with or without notice.
        </p>

        <h2>7. Campaign Terms</h2>
        <p>
          Campaigns created through the Service establish a direct relationship between the brand and
          the participating creators. PopsDrops facilitates this relationship but is not a party to it.
          We are not responsible for:
        </p>
        <ul>
          <li>Payment disputes between brands and creators</li>
          <li>Quality or performance of creator content</li>
          <li>A brand&apos;s failure to pay or a creator&apos;s failure to deliver</li>
          <li>Campaign results, reach, engagement, or any performance metric</li>
        </ul>
        <p>
          Usage rights for creator content are defined per campaign. Brands may not use creator content
          beyond the scope agreed upon in the campaign brief.
        </p>

        <h2>8. Reviews and Ratings</h2>
        <p>
          Users may leave reviews and ratings after completing campaigns. Reviews must be honest and
          based on genuine experience. We reserve the right to remove reviews that are fraudulent,
          abusive, or violate these Terms. We do not edit or alter the substance of legitimate reviews.
        </p>

        <h2>9. Fees</h2>
        <p>
          The Service is currently free for all users during our launch period. We reserve the right to
          introduce fees for brands in the future. If we do, we will provide at least 30 days&apos; notice
          before any fees take effect. Creators will not be charged fees for using the platform.
        </p>

        <h2>10. Privacy</h2>
        <p>
          Your use of the Service is subject to our <Link href="/privacy" className="text-slate-900 underline">Privacy Policy</Link>,
          which describes how we collect, use, and protect your personal information. By using the Service,
          you consent to our data practices as described in the Privacy Policy.
        </p>

        <h2>11. Disclaimers</h2>
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY
          KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS
          FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
        </p>
        <p>
          We do not warrant that the Service will be uninterrupted, error-free, secure, or that any
          defects will be corrected. AI-generated translations, creator matching, and performance
          recommendations are provided as tools and are not guaranteed to be accurate or complete.
        </p>
        <p>
          We do not endorse, verify, or guarantee the identity, qualifications, or work product of any
          creator or brand on the platform. You use the Service and interact with other users at your
          own risk.
        </p>

        <h2>12. Limitation of Liability</h2>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, TENGRI VERTEX, LLC AND ITS OFFICERS, MEMBERS,
          EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
          OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, REVENUE, OR BUSINESS OPPORTUNITIES,
          ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE.
        </p>
        <p>
          OUR TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS RELATED TO THE SERVICE SHALL NOT EXCEED THE GREATER
          OF (A) THE AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM, OR (B) ONE HUNDRED DOLLARS
          ($100).
        </p>

        <h2>13. Indemnification</h2>
        <p>
          You agree to indemnify, defend, and hold harmless Tengri Vertex, LLC and its officers, members,
          employees, and agents from any claims, damages, losses, or expenses (including reasonable
          attorneys&apos; fees) arising out of or related to: (a) your use of the Service; (b) your
          violation of these Terms; (c) your User Content; or (d) your violation of any third-party rights.
        </p>

        <h2>14. Dispute Resolution</h2>
        <p>
          <strong>Arbitration.</strong> Any dispute arising out of or relating to these Terms or the
          Service shall be resolved by binding arbitration administered by the American Arbitration
          Association (&quot;AAA&quot;) under its Commercial Arbitration Rules. The arbitration shall
          take place in San Francisco, California. The arbitrator&apos;s decision shall be final and
          binding and may be entered as a judgment in any court of competent jurisdiction.
        </p>
        <p>
          <strong>Class action waiver.</strong> You agree that any dispute resolution proceedings will be
          conducted only on an individual basis and not in a class, consolidated, or representative action.
        </p>
        <p>
          <strong>Exceptions.</strong> Either party may seek injunctive or equitable relief in any court
          of competent jurisdiction to prevent the actual or threatened infringement of intellectual
          property rights.
        </p>

        <h2>15. Governing Law</h2>
        <p>
          These Terms are governed by and construed in accordance with the laws of the State of California,
          without regard to its conflict of law principles.
        </p>

        <h2>16. Termination</h2>
        <p>
          You may terminate your account at any time by contacting us at legal@popsdrops.com. We may
          suspend or terminate your access at any time, with or without cause, with or without notice.
        </p>
        <p>
          Upon termination, your right to use the Service ceases immediately. We may delete your account
          data within 30 days of termination, except where retention is required by law. Sections 5, 11,
          12, 13, 14, and 15 survive termination.
        </p>

        <h2>17. Changes to These Terms</h2>
        <p>
          We may update these Terms from time to time. If we make material changes, we will notify you
          by email or through the Service at least 30 days before the changes take effect. Your continued
          use of the Service after the effective date constitutes acceptance of the updated Terms.
        </p>

        <h2>18. General</h2>
        <p>
          <strong>Entire agreement.</strong> These Terms, together with the Privacy Policy, constitute
          the entire agreement between you and Tengri Vertex, LLC regarding the Service.
        </p>
        <p>
          <strong>Severability.</strong> If any provision of these Terms is held unenforceable, the
          remaining provisions remain in full force and effect.
        </p>
        <p>
          <strong>No waiver.</strong> Our failure to enforce any right or provision of these Terms does
          not constitute a waiver of that right or provision.
        </p>
        <p>
          <strong>Assignment.</strong> You may not assign your rights under these Terms without our
          consent. We may assign our rights to a successor entity in connection with a merger,
          acquisition, or sale of assets.
        </p>
        <p>
          <strong>Force majeure.</strong> We are not liable for failures or delays caused by events
          beyond our reasonable control, including natural disasters, war, terrorism, pandemics,
          government actions, or internet outages.
        </p>

        <h2>19. Contact</h2>
        <p>
          For questions about these Terms, contact us at:<br />
          legal@popsdrops.com
        </p>
      </article>
    </div>
  );
}
