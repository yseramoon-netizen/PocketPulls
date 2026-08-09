import { CompactList, InfoCallout, Section, TrustShell } from "@/components/player/TrustShell";

export default function HowWishesWorkPage() {
  return (
    <TrustShell
      eyebrow="How it works"
      title="One wish. One physical card."
      intro="A wish allocates one genuine physical trading card from the Ancient Pulls summon catalogue."
    >
      <Section title="1. Buy wishes">
        <p>The minimum recharge is 10 wishes. Larger packs cost less per wish. The displayed first-recharge discount applies once to an eligible account.</p>
      </Section>

      <Section title="2. Make a wish">
        <p>The server selects a rarity tier using the published live odds, then selects one enabled card inside that tier.</p>
      </Section>

      <Section title="3. Stock does not control rarity">
        <p>Physical copy count is not used to calculate rarity odds. Adding more cards to the catalogue does not automatically make that rarity more likely.</p>
        <InfoCallout title="See the current configuration">
          The <a className="font-black text-cyan-100 underline underline-offset-4" href="/odds">Live Odds</a> page shows the active rarity chances and how many card designs are currently summonable in each tier.
        </InfoCallout>
      </Section>

      <Section title="4. Your result is recorded">
        <p>The reveal animation shows the result already allocated by the server. It cannot upgrade, downgrade or reroll the card.</p>
      </Section>

      <Section title="5. We fulfil the physical card">
        <CompactList>
          <li>If the card is already physically held, it can be allocated from stock immediately.</li>
          <li>If it is not currently held, your result is recorded and the card is marked for sourcing when shipment is requested.</li>
          <li>Your shipment is prepared once the required physical cards are ready.</li>
        </CompactList>
      </Section>
    </TrustShell>
  );
}
