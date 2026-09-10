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
  SUPPORT_EMAIL,
} from "@/lib/player/legal";

export default function TermsPage() {
  return (
    <TrustShell
      eyebrow="Terms & conditions"
      title="Terms for accounts, wishes and physical cards"
      intro="These terms explain the contract between you and Ancient Pulls. They do not replace or restrict rights given to you by UK consumer law."
    >
      <InfoCallout title="The short version">
        You buy wish credits, not a named card. Each credit you use randomly allocates one genuine physical trading card. You can hold allocated cards in your Collection and choose when to request delivery. Cancellation, refund and faulty-goods rights still apply.
      </InfoCallout>

      <Section title="1. Who the contract is with">
        <p>
          The service trades as {BUSINESS_TRADING_NAME}. The legal operator is{" "}
          {BUSINESS_LEGAL_NAME || "shown on the Business & Contact page before orders open"}.
          The geographic business address is {BUSINESS_ADDRESS || "being configured before orders open"}.
          Customer-service email: {SUPPORT_EMAIL || "being configured before orders open"}.
        </p>
        <p>
          Full identity and contact information is kept on the{" "}
          <Link className="text-cyan-100 underline underline-offset-2" href="/contact">
            Business &amp; Contact page
          </Link>.
        </p>
      </Section>

      <Section title="2. Eligibility and accounts">
        <CompactList>
          <li>You must be at least 18 years old to create an account or buy wishes.</li>
          <li>Give accurate information and keep your sign-in details secure.</li>
          <li>Use only a payment method you are authorised to use.</li>
          <li>Do not automate wishes, exploit bugs, manipulate requests, interfere with other accounts or make dishonest chargebacks.</li>
          <li>We may suspend an account to investigate security, fraud, abuse or a serious breach, but this does not remove rights relating to purchases already made.</li>
        </CompactList>
      </Section>

      <Section title="3. What a wish is">
        <CompactList>
          <li>One wish credit can be used once to allocate one genuine physical trading card from the active pool.</li>
          <li>The rarity tier is selected using the live displayed odds; a card is then selected from enabled cards in that tier.</li>
          <li>You are not buying a particular card, rarity, set, condition grade or secondary-market value. Duplicates are possible.</li>
          <li>Wish credits are not money, cannot be redeemed for cash and may not be sold outside authorised service features.</li>
          <li>Wish credits do not currently expire. We will not retrospectively remove paid credits through a later policy change.</li>
          <li>The reveal animation is presentation. The secure server record determines the completed result.</li>
        </CompactList>
        <p>
          See{" "}
          <Link className="text-cyan-100 underline underline-offset-2" href="/how-wishes-work">How Wishes Work</Link>
          {" "}and the{" "}
          <Link className="text-cyan-100 underline underline-offset-2" href="/odds">Live Odds</Link>
          {" "}before purchasing.
        </p>
      </Section>

      <Section title="4. Prices, checkout and contract formation">
        <CompactList>
          <li>Prices are shown in pounds sterling and include applicable taxes unless checkout clearly says otherwise.</li>
          <li>The bundle, number of credits, discounts and total price are shown immediately before payment.</li>
          <li>Payment is processed by Stripe using the payment methods offered on its hosted checkout.</li>
          <li>Your order is an offer to buy. We accept it when payment succeeds; we then send the contract-confirmation email.</li>
          <li>The final payment control is clearly labelled to show that using it creates an obligation to pay.</li>
          <li>If a pricing or technical error prevents acceptance, we cancel the order and return any payment taken.</li>
        </CompactList>
        <p>
          Keep the confirmation email: it records the order reference, total, product description, trader details, cancellation wording and key terms that applied at purchase.
        </p>
      </Section>

      <Section title="5. Immediate access and cancellation">
        <p>
          At checkout you can expressly request immediate access to wish credits during the normal cancellation period. Unused credits can normally be cancelled within 14 days of purchase. If you choose to use credits in that period, a refund may be reduced for the part already supplied only where the law permits and only to a proportionate amount.
        </p>
        <p>
          Allocating a random result does not by itself erase statutory rights. The full process, time limits, model wording and return-cost rules are on the{" "}
          <Link className="text-cyan-100 underline underline-offset-2" href="/returns">Refunds &amp; Returns page</Link>.
        </p>
      </Section>

      <Section title="6. Card allocation, sourcing and substitutions">
        <p>
          An allocated card appears in your Collection. Some cards may be held before allocation and others may need to be sourced afterwards. {BUSINESS_NAME} will source a genuine card matching the recorded result. We will not silently replace it with a different card. If the matching card cannot be supplied within the agreed arrangement, we will contact you and provide the remedy required by law, which may include cancellation and refund.
        </p>
      </Section>

      <Section title="7. Delivery arrangement">
        <p>
          Allocated cards are held in your Collection until you submit a shipping request. By choosing that arrangement, you ask us to deliver after you use the relevant credits and select cards for dispatch. Free shipping unlocks at the displayed threshold. You can ask through Help for earlier paid shipping; any charge and delivery estimate must be shown and agreed before dispatch.
        </p>
        <p>
          We remain responsible for goods until you or a person you nominate takes physical possession. Delivery restrictions, timing, loss and damage are explained in the{" "}
          <Link className="text-cyan-100 underline underline-offset-2" href="/shipping-policy">Shipping Policy</Link>.
        </p>
      </Section>

      <Section title="8. Card condition and reference values">
        <p>
          The material description supplied with an allocated card, including its identity and any condition information we expressly promise, forms part of the contract. Secondary-market values shown in the service are estimates from external data and can change. They are not guaranteed resale values and are not offers by {BUSINESS_NAME} to buy a card from you.
        </p>
      </Section>

      <Section title="9. Trades and collection records">
        <p>
          A completed in-service trade changes which account holds the relevant collection record. Do not offer a card that is reserved for shipment or that you are not entitled to transfer. Trading features do not change statutory rights against us for goods we supplied.
        </p>
      </Section>

      <Section title="10. Service availability and liability">
        <p>
          We take reasonable care to operate the service securely and accurately. Maintenance, networks and third-party providers can cause interruptions. Nothing in these terms excludes liability where doing so would be unlawful, including liability for death or personal injury caused by negligence, fraud, or your statutory consumer rights. We are responsible for foreseeable loss caused by our breach; we are not responsible for business losses arising from consumer use.
        </p>
      </Section>

      <Section title="11. Changes to the service or these terms">
        <p>
          We may update the service and these terms for legal, security or operational reasons. A material change applies prospectively and will be brought to account holders&apos; attention. We will ask for a fresh acknowledgement where appropriate. The version supplied with an accepted order remains the record for that order.
        </p>
      </Section>

      <Section title="12. Complaints and disputes">
        <p>
          Contact us first through the Support section inside Help or by email. We will investigate fairly and keep the conversation attached to your account where possible. Data-protection complaints follow the separate process in the Privacy Notice. Nothing here prevents you from using rights or remedies available through a court, regulator or consumer-enforcement body.
        </p>
      </Section>

      <Section title="13. Governing law">
        <p>
          These terms are governed by the law of England and Wales. If you live in Scotland or Northern Ireland, you retain the benefit of mandatory protections and may bring proceedings in the courts available to you under applicable law.
        </p>
      </Section>

      <Section title="14. Intellectual property and independence">
        <p>
          {BUSINESS_TRADING_NAME} is an independent reseller. Product names and images identify genuine items being resold. Nintendo, The Pokémon Company, Game Freak and related names, marks and characters belong to their respective owners. No sponsorship or endorsement is claimed.
        </p>
      </Section>
    </TrustShell>
  );
}
