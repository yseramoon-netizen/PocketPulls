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
          <li>Physical warehouse quantity does not secretly change rarity odds.</li>
          <li>The reveal animation cannot upgrade or downgrade the result.</li>
          <li>The completed wish and card result are recorded in your account.</li>
        </CompactList>
      </Section>

      <Section title="Physical fulfilment">
        <CompactList>
          <li>Some summonable cards may already be held by Ancient Pulls.</li>
          <li>Others may be sourced after they are pulled.</li>
          <li>A sourced-on-demand card must be physically obtained before it can be dispatched.</li>
        </CompactList>
      </Section>

      <Section title="Payments">
        <CompactList>
          <li>Payment-card details are handled by the payment provider rather than stored by the Ancient Pulls application.</li>
          <li>Wishes are credited after the payment provider confirms a successful payment.</li>
        </CompactList>
      </Section>

      <Section title="Problems with an order">
        <p>If a card cannot be sourced, is materially misdescribed, arrives damaged, is missing, or a payment/allocation appears to have failed, contact support. Nothing in these rules is intended to remove statutory consumer rights that apply to you.</p>
      </Section>

      <InfoCallout title="No cash-out" tone="emerald">
        Cards and wishes cannot be converted into withdrawable cash through Ancient Pulls. Market values are informational only.
      </InfoCallout>
    </TrustShell>
  );
}
