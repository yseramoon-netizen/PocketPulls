import { CompactList, InfoCallout, Section, TrustShell } from "@/components/player/TrustShell";

export default function PlayerProtectionPage() {
  return (
    <TrustShell
      eyebrow="Player protection"
      title="Random should never mean hidden."
      intro="The protections below are designed to make the wish system understandable, auditable and fair to players."
    >
      <Section title="Before you buy">
        <CompactList>
          <li>Wish purchases are clearly described as random-item physical-card purchases.</li>
          <li>The minimum recharge, pack price, first-recharge discount and effective price per wish are shown before checkout.</li>
          <li>The Live Odds page shows the current rarity composition of the physical pool.</li>
        </CompactList>
      </Section>

      <Section title="When you make a wish">
        <CompactList>
          <li>The card is allocated server-side from available physical inventory.</li>
          <li>The reveal animation cannot upgrade or downgrade the result.</li>
          <li>A completed wish and its card are recorded in your account history.</li>
        </CompactList>
      </Section>

      <Section title="Payments">
        <CompactList>
          <li>Payment-card details are handled by the payment provider rather than stored by the Unown Pulls application.</li>
          <li>A successful payment is credited after the payment provider confirms it.</li>
          <li>If payment succeeds but wishes do not appear, contact support and the payment record can be checked.</li>
        </CompactList>
      </Section>

      <Section title="Problems with an order">
        <p>If a card is missing, materially misdescribed, damaged in transit, or a payment/reveal appears to have failed, contact support. Nothing in these rules is intended to remove statutory consumer rights that apply to you.</p>
      </Section>

      <Section title="Age and bill-payer protection">
        <p>Paid wish purchases are intended for adults. Do not use another person&apos;s payment method without their permission.</p>
      </Section>

      <InfoCallout title="No cash-out" tone="emerald">
        Cards and wishes cannot be converted into withdrawable cash through Unown Pulls. Market values are informational only.
      </InfoCallout>
    </TrustShell>
  );
}
