import { CompactList, InfoCallout, Section, TrustShell } from "@/components/player/TrustShell";

export default function HowWishesWorkPage() {
  return (
    <TrustShell
      eyebrow="How it works"
      title="One wish. One physical card."
      intro="A wish is a prepaid credit that allocates one physical trading card from the live Unown Pulls pool."
    >
      <div className="space-y-0">
        <Section title="1. Buy wishes">
          <p>The minimum recharge is 10 wishes. Larger packs have a lower price per wish. The first successful recharge on an eligible account receives the displayed first-recharge discount.</p>
        </Section>

        <Section title="2. Make a wish">
          <p>Using one wish starts one random physical-card allocation. You cannot choose a specific card, set, rarity or market value.</p>
        </Section>

        <Section title="3. The physical pool decides the odds">
          <p>Every available physical copy in the wish pool contributes to the current odds. When cards are added or pulled, the live odds change.</p>
          <InfoCallout title="See the real numbers">
            The <a className="font-black text-cyan-100 underline underline-offset-4" href="/odds">Live Odds</a> page reads the current pool rather than showing a fixed marketing percentage.
          </InfoCallout>
        </Section>

        <Section title="4. The reveal">
          <p>The reveal animation represents the rarity of the card that has already been allocated by the server. The animation does not change the result.</p>
        </Section>

        <Section title="5. The card is added to your collection">
          <CompactList>
            <li>The card appears in your Collection.</li>
            <li>Duplicates are possible and are tracked as extra copies.</li>
            <li>Your card can remain in your account until you use the available shipping or trading tools.</li>
          </CompactList>
        </Section>
      </div>
    </TrustShell>
  );
}
