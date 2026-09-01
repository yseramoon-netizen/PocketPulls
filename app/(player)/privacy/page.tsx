import Link from "next/link";

import {
  CompactList,
  InfoCallout,
  Section,
  TrustShell,
} from "@/components/player/TrustShell";
import {
  BUSINESS_ADDRESS,
  BUSINESS_LEGAL_NAME,
  BUSINESS_NAME,
  BUSINESS_TRADING_NAME,
  PRIVACY_EMAIL,
  privacyLabel,
} from "@/lib/player/legal";

const DATA_USES = [
  {
    data: "Account and identity",
    examples: "User ID, email, username, display name, avatar, age confirmation, sign-in provider and account status.",
    purpose: "Create and secure the account, authenticate you, display your chosen identity and enforce service rules.",
    basis: "Contract; legitimate interests in account security and abuse prevention; legal obligation where a record is required.",
  },
  {
    data: "Purchases and legal records",
    examples: "Order reference, wish package, amount, currency, discounts, payment status, Stripe references, acknowledgements and confirmation delivery.",
    purpose: "Take and reconcile payments, credit wishes, confirm the contract, process refunds, prevent fraud and keep accounting/consumer records.",
    basis: "Contract; legal obligation; legitimate interests in fraud prevention and resolving disputes.",
  },
  {
    data: "Wishes, collection and social activity",
    examples: "Wish results, inventory, binder, achievements, constellation, friendships, trades, rewards and in-service activity history.",
    purpose: "Provide the game, collection, social and fulfilment features you request and maintain an accurate audit trail.",
    basis: "Contract; legitimate interests in service integrity, balancing and abuse prevention.",
  },
  {
    data: "Delivery",
    examples: "Recipient name, saved address, selected cards, shipment status, tracking reference and delivery notes.",
    purpose: "Prepare, send, track and support physical-card deliveries.",
    basis: "Contract; legal obligation; legitimate interests in delivery evidence and claims handling.",
  },
  {
    data: "Support and privacy complaints",
    examples: "Ticket category, subject, messages, attachments, related order/shipment, complaint evidence, acknowledgements and outcome.",
    purpose: "Answer questions, provide remedies, investigate complaints and demonstrate fair handling.",
    basis: "Contract; legal obligation; legitimate interests in customer care and dispute resolution.",
  },
  {
    data: "Device, security and diagnostics",
    examples: "IP address, browser/device information, timestamps, request logs, security events, errors and locally stored settings.",
    purpose: "Operate, protect and troubleshoot the service, remember requested settings and prevent misuse.",
    basis: "Legitimate interests in a secure and reliable service; consent where a non-exempt storage technology requires it.",
  },
] as const;

export default function PrivacyPage() {
  return (
    <TrustShell
      eyebrow="Privacy notice"
      title="Your data, mapped clearly"
      intro="This notice explains what Ancient Pulls collects, why it is used, who receives it, how long it is kept and how to exercise your UK data-protection rights."
    >
      <InfoCallout title="Data controller">
        {BUSINESS_LEGAL_NAME || BUSINESS_NAME}, trading as {BUSINESS_TRADING_NAME}, is the controller for Ancient Pulls account and commerce data. Address: {BUSINESS_ADDRESS || "published before orders open"}. Privacy contact: {privacyLabel()}.
      </InfoCallout>

      <Section title="1. The information we use and why">
        <div className="grid gap-3">
          {DATA_USES.map((item) => (
            <article key={item.data} className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <h3 className="font-black text-white/85">{item.data}</h3>
              <p><span className="font-black text-white/65">Includes:</span> {item.examples}</p>
              <p><span className="font-black text-white/65">Why:</span> {item.purpose}</p>
              <p><span className="font-black text-white/65">Lawful basis:</span> {item.basis}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section title="2. Where the information comes from">
        <CompactList>
          <li>Directly from you when you create an account, change settings, buy wishes, use the service, save an address or contact support.</li>
          <li>Automatically from the service and hosting/security logs when you sign in or interact with a feature.</li>
          <li>From Stripe about payment status and references. Ancient Pulls does not receive or store your complete card number or security code.</li>
          <li>From an OAuth provider if you choose social sign-in, according to the permissions shown by that provider.</li>
          <li>From carriers and sourcing partners where needed to fulfil, track or resolve a physical-card delivery.</li>
        </CompactList>
      </Section>

      <Section title="3. What other players can see">
        <p>
          Social features can show your chosen username, display name, avatar, public constellation/ranking information, collection information you deliberately expose, friendship status and trade content. Your account email, saved postal addresses and payment references are not public. Review a feature before sharing or offering a card.
        </p>
      </Section>

      <Section title="4. Who receives information">
        <CompactList>
          <li>Supabase provides authentication, database, storage and related backend services.</li>
          <li>Vercel hosts and delivers the web application and produces operational/security logs.</li>
          <li>Stripe processes checkout and payment information as an independent payment provider for its own regulated purposes and as a service provider for transaction data.</li>
          <li>The configured transactional-email provider sends verification, security and contract-confirmation messages.</li>
          <li>Delivery carriers, card suppliers and professional advisers receive only what is reasonably necessary for fulfilment, claims, legal compliance or dispute handling.</li>
          <li>Police, regulators, courts or public authorities may receive data where disclosure is legally required or necessary to protect legal rights.</li>
        </CompactList>
        <p>We do not sell personal information. We do not disclose saved addresses or emails to other players.</p>
      </Section>

      <Section title="5. International transfers">
        <p>
          Some providers may process information outside the UK. Where UK law requires a transfer safeguard, we use an applicable UK adequacy regulation, the UK International Data Transfer Agreement or UK Addendum, or another lawful safeguard, and consider supplementary security measures. Contact the privacy address for information about the relevant safeguard.
        </p>
      </Section>

      <Section title="6. Retention">
        <CompactList>
          <li>Account, collection and social records: while the account is active, then deleted or anonymised after closure except where another period below applies or a dispute requires preservation.</li>
          <li>Orders, payment references, fulfilment records and legal acknowledgements: normally six years after the transaction or end of the customer relationship, to meet tax, accounting, contract and claims requirements.</li>
          <li>Saved addresses: until you delete them or close the account, except an address embedded in a transaction/fulfilment record may be retained with that record.</li>
          <li>Support records and attachments: normally two years after the ticket closes, or up to six years where the issue concerns a transaction, complaint or potential legal claim.</li>
          <li>Data-protection complaints: long enough to investigate, report the outcome and demonstrate compliance, normally up to six years after closure.</li>
          <li>Pending-registration browser data: up to 30 days unless you clear it earlier. Preference storage remains until you reset it or clear site data.</li>
          <li>Security and diagnostic logs: for the shortest practical period set for security, troubleshooting and provider operations, extended only when an incident or legal requirement justifies it.</li>
        </CompactList>
        <p>Retention can be shortened where data is no longer needed or extended where law, fraud prevention, litigation or an active complaint requires preservation. We delete or anonymise data when the relevant period ends.</p>
      </Section>

      <Section title="7. Your rights">
        <p>Depending on the circumstances, UK data-protection law gives you rights to:</p>
        <CompactList>
          <li>be informed and obtain a copy of your personal information;</li>
          <li>correct inaccurate or incomplete information;</li>
          <li>request deletion or restriction;</li>
          <li>object to processing based on legitimate interests or to direct marketing;</li>
          <li>receive certain information in a portable format;</li>
          <li>withdraw consent at any time where consent is the basis, without affecting earlier lawful use; and</li>
          <li>ask for safeguards around a significant decision made solely by automated means.</li>
        </CompactList>
        <p>
          Ancient Pulls does not currently use solely automated processing to make legal or similarly significant decisions about players. Random card allocation is a service mechanic, not profiling used to determine legal rights.
        </p>
      </Section>

      <Section title="8. How to make a request or privacy complaint">
        <CompactList>
          <li>Email {PRIVACY_EMAIL || "the privacy address published before orders open"} with “privacy request” or “data protection complaint” in the subject, or open Help → Support and identify it clearly as a privacy matter.</li>
          <li>Tell us what happened, the outcome you want and the account/email involved. Attach supporting evidence only where relevant.</li>
          <li>We may ask for proportionate identity or authority evidence if it is genuinely needed; we will not request it when identity is already clear.</li>
          <li>We acknowledge a data-protection complaint within 30 days, investigate without undue delay, keep you informed and explain the outcome.</li>
          <li>Most information-rights requests are answered within one month, subject to lawful extensions or exceptions.</li>
        </CompactList>
        <p>
          You can also complain to the{" "}
          <a className="text-cyan-100 underline underline-offset-2" href="https://ico.org.uk/make-a-complaint/data-protection-complaints/data-protection-complaints/" target="_blank" rel="noreferrer">Information Commissioner&apos;s Office</a>.
          We would appreciate the chance to resolve the issue first, but you do not have to contact us before exercising your right to complain to the ICO.
        </p>
      </Section>

      <Section title="9. Cookies and browser storage">
        <p>
          The service currently uses essential authentication/security storage and player-requested preference storage. It does not currently deploy advertising or optional analytics trackers. The exact categories, purposes, duration and controls are in the{" "}
          <Link className="text-cyan-100 underline underline-offset-2" href="/cookies">Cookie Policy</Link>.
        </p>
      </Section>

      <Section title="10. Security, children and changes">
        <CompactList>
          <li>We use access controls, row-level database policies, signed storage access, payment-provider separation and operational logging to protect the service. No system can guarantee absolute security.</li>
          <li>The service is for adults aged 18 or over and is not intended to collect children&apos;s data knowingly. Contact us if you believe a child has created an account.</li>
          <li>We update this notice when data uses, providers or the law materially change and highlight significant changes through the service where appropriate.</li>
        </CompactList>
      </Section>
    </TrustShell>
  );
}
