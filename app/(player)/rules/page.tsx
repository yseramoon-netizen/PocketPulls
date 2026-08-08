import { CompactList, InfoCallout, Section, TrustShell } from "@/components/player/TrustShell";

export default function RulesPage() {
  return (
    <TrustShell
      eyebrow="Rules"
      title="Wish rules"
      intro="The rules that matter when making a wish."
    >
      <Section title="Every completed wish allocates one card">
        <CompactList>
          <li>One wish is consumed for one successfully allocated physical-card result.</li>
          <li>If allocation fails before a result is recorded, the transaction is designed to roll back.</li>
          <li>There is no cash prize and no cash-out through Unown Pulls.</li>
        </CompactList>
      </Section>

      <Section title="The result is random">
        <CompactList>
          <li>The rarity tier is drawn using the published configured odds.</li>
          <li>A card is then selected from the enabled catalogue inside that rarity tier.</li>
          <li>You cannot request a particular card, set, rarity or value.</li>
          <li>Duplicates can be pulled.</li>
        </CompactList>
      </Section>

      <Section title="Summonable does not always mean already in the warehouse">
        <p>Some cards may be listed in the summon catalogue before Unown Pulls physically holds a copy. If one is allocated to you, it is recorded in your account and must be sourced before it can be dispatched.</p>
      </Section>

      <Section title="Values are references, not promises">
        <p>Displayed market values can move up or down. They are not guaranteed resale prices or offers from Unown Pulls to buy cards back.</p>
      </Section>

      <Section title="Fair use">
        <CompactList>
          <li>Do not exploit bugs, duplicate requests, payment reversals or technical faults to obtain wishes or cards you are not entitled to.</li>
          <li>Do not automate pulls or interfere with the allocation process.</li>
        </CompactList>
      </Section>

      <InfoCallout title="Important" tone="yellow">
        Buying wishes does not guarantee a rare card or a card worth more than the purchase price.
      </InfoCallout>
    </TrustShell>
  );
}
