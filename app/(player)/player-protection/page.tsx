import { CompactList, InfoCallout, Section, TrustShell } from "@/components/player/TrustShell";

export default function PlayerProtectionPage() {
  return (
    <TrustShell
      eyebrow="Player protection"
      title="Random should never mean hidden."
      intro="The important parts of the wish system are disclosed before you buy or pull."
    >
      <Section title="Before you buy">
        <CompactList>
          <li>Wish purchases are described as random physical-card purchases.</li>
          <li>Pack price, price per wish and first-recharge discount are shown before checkout.</li>
          <li>The Live Odds page shows the configured rarity chances.</li>
        </CompactList>
      </Section>

      <Section title="When you make a wish">
        <CompactList>
          <li>The result is allocated server-side.</li>
          <li>Only physically available designs can be allocated; live odds exclude empty tiers.</li>
          <li>The reveal animation cannot upgrade or downgrade the result.</li>
          <li>The completed wish and card result are recorded in your account.</li>
        </CompactList>
      </Section>

      <Section title="Physical fulfilment">
        <CompactList>
          <li>Every completed result reserves a copy already held by ancientpulls.</li>
          <li>Finish, condition and language are recorded against the physical result.</li>
          <li>Uncertain scanner matches require review and do not enter the wish pool automatically.</li>
        </CompactList>
      </Section>

      <Section title="Payments">
        <CompactList>
          <li>Payment-card details are handled by the payment provider rather than stored by the ancientpulls application.</li>
          <li>Wishes are credited after the payment provider confirms a successful payment.</li>
        </CompactList>
      </Section>

      <Section title="Problems with an order">
        <p>If a card is materially misdescribed, arrives damaged, is missing, or a payment/allocation appears to have failed, use in-account Support. Nothing in these rules is intended to remove statutory consumer rights that apply to you.</p>
      </Section>

      <InfoCallout title="No cash-out" tone="emerald">
        Cards and wishes cannot be converted into withdrawable cash through ancientpulls. Market values are informational only.
      </InfoCallout>
    </TrustShell>
  );
}
