import { CompactList, InfoCallout, Section, TrustShell } from "@/components/player/TrustShell";

export default function RulesPage() {
  return (
    <TrustShell
      eyebrow="Rules"
      title="Wish rules"
      intro="These are the rules that matter during normal play. The full legal terms are available separately."
    >
      <Section title="Every completed wish allocates one card">
        <CompactList>
          <li>One wish is consumed for one successfully allocated physical card.</li>
          <li>If the allocation transaction fails before a card is awarded, the database transaction is designed to roll back rather than intentionally charge a wish without a card.</li>
          <li>There is no cash prize and no cash-out through Unown Pulls.</li>
        </CompactList>
      </Section>

      <Section title="The result is random">
        <CompactList>
          <li>You cannot request a particular card, set, rarity or value.</li>
          <li>Duplicates can be pulled.</li>
          <li>The physical stock in the live pool changes over time, so rarity odds also change.</li>
        </CompactList>
      </Section>

      <Section title="Values are references, not promises">
        <p>Any displayed market value is a reference value and can move up or down. It is not a guaranteed resale price, cash value or offer from Unown Pulls to buy the card back.</p>
      </Section>

      <Section title="Fair use of the service">
        <CompactList>
          <li>Do not exploit bugs, payment reversals, duplicate requests or technical faults to obtain cards or wishes you did not pay for or earn.</li>
          <li>Do not automate pulls or attempt to interfere with the random allocation process.</li>
          <li>Accounts may be restricted while suspected fraud, chargebacks or technical abuse are investigated.</li>
        </CompactList>
      </Section>

      <InfoCallout title="Important" tone="yellow">
        Buying wishes does not guarantee a rare card or a card worth more than the purchase price.
      </InfoCallout>
    </TrustShell>
  );
}
