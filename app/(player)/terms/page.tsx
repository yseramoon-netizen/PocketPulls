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
        <p>{BUSINESS_NAME} provides an online account system for purchasing wish credits, randomly allocating physical trading cards from recorded inventory, managing a card collection, and using available trading and shipping features.</p>
      </Section>

      <Section title="2. Wishes">
        <CompactList>
          <li>One successfully completed wish allocates one physical trading card.</li>
          <li>The specific card is selected randomly from eligible physical inventory.</li>
          <li>You are not purchasing a particular card, rarity, set or guaranteed market value.</li>
          <li>Duplicates are possible.</li>
          <li>Wishes have no cash-redemption value and cannot be withdrawn as money.</li>
        </CompactList>
      </Section>

      <Section title="3. Odds and pool changes">
        <p>The wish pool changes as stock is added and cards are allocated. The Live Odds page shows the current rarity composition of eligible inventory. Odds displayed at one time are not a promise that the same pool composition will remain available later.</p>
      </Section>

      <Section title="4. Prices and payments">
        <CompactList>
          <li>Prices shown at checkout include the number of wishes being purchased and the price charged for that package.</li>
          <li>The minimum paid recharge is 10 wishes.</li>
          <li>The first-recharge discount, where offered, applies once per eligible account and only to the first successful wish recharge.</li>
          <li>Payment is processed by the payment provider shown at checkout.</li>
        </CompactList>
      </Section>

      <Section title="5. Card ownership, collection and shipping">
        <p>Once a wish is successfully completed, the allocated card is recorded in your Collection. Cards remain associated with your account until transferred through an available trade function or processed through the shipping flow. Shipping options, charges and eligibility shown at the time of a shipping request apply to that request.</p>
      </Section>

      <Section title="6. Market values">
        <p>Displayed market values are reference information only. Secondary-market prices fluctuate. A displayed value is not a guarantee of resale value and is not an offer by {BUSINESS_NAME} to purchase a card from you.</p>
      </Section>

      <Section title="7. Cancellations, returns and faults">
        <p>Nothing in these terms removes statutory rights that cannot lawfully be excluded. Where a statutory cancellation, refund, repair, replacement or other consumer remedy applies, {BUSINESS_NAME} will honour it. Contact support as soon as possible if you believe a payment, card allocation, delivery or description is wrong.</p>
        <p>Where a return is legally required before a refund can be completed, you may be asked to return the relevant physical card in the condition in which it was received, subject to applicable consumer law.</p>
      </Section>

      <Section title="8. Technical failures">
        <p>The reveal animation is presentation only. Server-side records determine the completed result. If a transaction fails before a card is allocated, the wish transaction is designed to roll back. If the interface and account record disagree, contact support so the server record can be checked.</p>
      </Section>

      <Section title="9. Account use">
        <CompactList>
          <li>Keep your login secure and do not share access to your account.</li>
          <li>Do not use payment methods without the bill payer&apos;s permission.</li>
          <li>Do not exploit bugs, automate pulls, manipulate requests, reverse payments dishonestly or attempt to obtain stock you are not entitled to.</li>
          <li>Accounts may be restricted while suspected fraud, abuse or security incidents are investigated.</li>
        </CompactList>
      </Section>

      <Section title="10. Intellectual property and independence">
        <p>{BUSINESS_NAME} is an independent reseller. References to Pokémon and individual card names are used to identify the genuine products being resold. Nintendo, The Pokémon Company, Game Freak and their related marks and characters are owned by their respective rights holders. No sponsorship or endorsement is claimed.</p>
      </Section>

      <Section title="11. Contact">
        <p>Support: {supportLabel()}.</p>
      </Section>
    </TrustShell>
  );
}
