import { CompactList, InfoCallout, Section, TrustShell } from "@/components/player/TrustShell";
import { BUSINESS_ADDRESS, BUSINESS_NAME, supportLabel } from "@/lib/player/legal";

export default function PrivacyPage() {
  return (
    <TrustShell
      eyebrow="Privacy"
      title="How your information is used"
      intro="This notice describes the account, payment, card, shipping and support information used to operate Ancient Pulls."
    >
      <Section title="Who is responsible">
        <p>{BUSINESS_NAME} is responsible for the personal information used by this service. Contact: {supportLabel()}{BUSINESS_ADDRESS ? ` · ${BUSINESS_ADDRESS}` : ""}.</p>
      </Section>

      <Section title="Information we use">
        <CompactList>
          <li>Account identity, email, profile, security and sign-in records.</li>
          <li>Wish balances, purchases, random results, collection, trades and fulfilment history.</li>
          <li>Shipping names, postal addresses, parcel status and tracking information.</li>
          <li>Support messages and photos you choose to attach.</li>
          <li>Security, audit, device and technical logs needed to prevent fraud and diagnose failures.</li>
        </CompactList>
      </Section>

      <Section title="Why we use it">
        <CompactList>
          <li>To provide your account and perform purchases, card allocation, trades and shipping.</li>
          <li>To comply with accounting, consumer, fraud-prevention and legal obligations.</li>
          <li>To protect Ancient Pulls and players, investigate errors and keep immutable transaction evidence.</li>
          <li>To answer support requests and resolve disputes.</li>
        </CompactList>
        <p>Depending on the activity, the legal basis may be performance of a contract, compliance with law or legitimate interests in operating a secure and accountable service. Consent is used where law requires it.</p>
      </Section>

      <Section title="Providers and international processing">
        <p>Account/database hosting, payments, email, parcel and infrastructure providers process only the information needed for their role. Payment-card details are handled by Stripe and are not stored in the Ancient Pulls application. Some providers may process information outside the UK using the safeguards available under data-protection law.</p>
      </Section>

      <Section title="Storage and retention">
        <p>Account data is kept while the account is active. Financial, fulfilment and audit records may be retained for the period required for tax, accounting, fraud and legal claims. Support photos should be kept only as long as needed to resolve and evidence the case. Backups expire on their normal protected cycle.</p>
      </Section>

      <Section title="Cookies and local storage">
        <p>Ancient Pulls uses essential authentication and preference storage needed for sign-in, security and requested features. No non-essential advertising or analytics storage should be enabled without an appropriate consent choice and an updated notice.</p>
      </Section>

      <Section title="Your rights">
        <p>Depending on the circumstances, you may ask for access, correction, deletion, restriction, portability or an objection to processing. You may also complain to the UK Information Commissioner&apos;s Office. Use in-account Support or {supportLabel()} to make a request; identity checks may be required.</p>
      </Section>

      <InfoCallout title="Private support photos" tone="cyan">
        Support attachments use a private storage area scoped to your account and ticket. Do not upload payment-card details, passwords or unrelated personal information.
      </InfoCallout>
    </TrustShell>
  );
}
