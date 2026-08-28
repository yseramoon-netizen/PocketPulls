import { CompactList, Section, TrustShell } from "@/components/player/TrustShell";
import { BUSINESS_NAME, supportLabel } from "@/lib/player/legal";

export default function TermsPage() {
  return (
    <TrustShell
      eyebrow="Terms"
      title="Terms of use and wish purchases"
      intro="Plain-English terms for using the service. Your statutory rights are not excluded by these terms."
    >
      <Section title="1. About the service">
        <p>{BUSINESS_NAME} provides an online account system for purchasing wish credits, randomly allocating trading-card results from a configured summon catalogue, managing a collection, and using available trading and shipping features.</p>
      </Section>

      <Section title="2. Wishes">
        <CompactList>
          <li>One successfully completed wish records one genuine physical trading-card result.</li>
          <li>A rarity tier is selected using the configured live odds, then a card is selected from the enabled cards within that tier.</li>
          <li>You are not purchasing a particular card, rarity, set or guaranteed market value.</li>
          <li>Duplicates are possible.</li>
          <li>Wishes have no cash-redemption value.</li>
        </CompactList>
      </Section>

      <Section title="3. Odds and catalogue changes">
        <p>Only card designs backed by available physical stock can be allocated. Rarity-tier weights are configured separately from the number of copies held, but a tier with no physically available card is excluded and the displayed live odds are recalculated across the remaining active tiers.</p>
      </Section>

      <Section title="4. Prices and payments">
        <CompactList>
          <li>The minimum paid recharge is 10 wishes.</li>
          <li>Prices and price per wish are displayed before checkout.</li>
          <li>The first-recharge discount, where offered, applies once per eligible account.</li>
          <li>Payment is processed by the payment provider shown at checkout.</li>
        </CompactList>
      </Section>

      <Section title="5. Card result and shipping">
        <p>Before a successful wish is recorded, one genuine physical copy already held by {BUSINESS_NAME} is reserved to that result. Its finish, condition and language are recorded in your card timeline. A different card cannot be silently substituted. Cards remain held for your account until they enter an available shipping flow.</p>
      </Section>

      <Section title="6. Market values">
        <p>Displayed market values are reference information only. Secondary-market prices fluctuate. A displayed value is not a guaranteed resale value and is not an offer by {BUSINESS_NAME} to purchase the card from you.</p>
      </Section>

      <Section title="7. Cancellations, returns and fulfilment problems">
        <p>Nothing in these terms removes statutory rights that cannot lawfully be excluded. The separate Returns &amp; Cancellations page explains the operating policy. Contact in-account Support if a payment, allocation, condition, delivery or description is wrong.</p>
      </Section>

      <Section title="8. Technical failures">
        <p>The reveal animation is presentation only. Server-side records determine the completed result. If allocation fails before a result is recorded, the wish transaction is designed to roll back.</p>
      </Section>

      <Section title="9. Account use">
        <CompactList>
          <li>Keep your login secure.</li>
          <li>Do not use payment methods without the bill payer&apos;s permission.</li>
          <li>Do not exploit bugs, automate pulls, manipulate requests or reverse payments dishonestly.</li>
        </CompactList>
      </Section>

      <Section title="10. Intellectual property and independence">
        <p>{BUSINESS_NAME} is an independent reseller. References to Pokémon and individual card names identify the genuine products being resold. Nintendo, The Pokémon Company, Game Freak and their related marks and characters are owned by their respective rights holders. No sponsorship or endorsement is claimed.</p>
      </Section>

      <Section title="11. Contact">
        <p>Support: {supportLabel()}.</p>
      </Section>
    </TrustShell>
  );
}
