import Link from "next/link";

import { CompactList, InfoCallout, Section, TrustShell } from "@/components/player/TrustShell";
import { BUSINESS_NAME, supportLabel } from "@/lib/player/legal";

export default function ReturnsPage() {
  return (
    <TrustShell
      eyebrow="Returns & cancellations"
      title="If something is wrong, there is a clear route back."
      intro="This operating policy sits alongside—never in place of—your statutory consumer rights."
    >
      <Section title="Unused wish credits">
        <p>Contact Support promptly if you want to cancel a paid recharge. Where a statutory cancellation right applies, a request made within 14 days will be handled in accordance with that right. Unused credits are straightforward to identify. If credits have been spent, tell us which purchase and wishes are involved so the correct remedy can be assessed without changing unrelated cards.</p>
      </Section>

      <Section title="Returning a physical card">
        <CompactList>
          <li>Open a Support ticket before posting anything and identify the exact card/order.</li>
          <li>Keep the card in the received condition and package it securely.</li>
          <li>If a cancellation right applies, the exact allocated card—not another copy—must be returned within the applicable period.</li>
          <li>Do not send cards to an address shown on a website or parcel without first receiving return instructions.</li>
        </CompactList>
      </Section>

      <Section title="Wrong, damaged, missing or misdescribed cards">
        <p>Use Support as soon as possible and attach clear photographs of the card, packaging and shipping label where relevant. {BUSINESS_NAME} will investigate the immutable allocation and fulfilment records. Remedies for faulty, misdescribed or undelivered goods are not limited by the voluntary cancellation policy.</p>
      </Section>

      <Section title="Refund timing">
        <p>An approved refund is sent to the original payment method. Bank and payment-provider processing time can continue after Ancient Pulls submits it. Any connected wish-credit, card, trade and fulfilment records will be reconciled together so an item is not refunded twice or left available after return.</p>
      </Section>

      <Section title="Return postage">
        <p>Ancient Pulls will provide instructions for faulty, damaged, wrong or misdescribed goods and will meet costs where the law requires. For a change-of-mind return, responsibility for return postage depends on the information supplied before purchase and the applicable cancellation right.</p>
      </Section>

      <InfoCallout title="Start inside your account" tone="emerald">
        <p><Link href="/help" className="font-black underline underline-offset-4">Open Help</Link> and choose Contact Support, or contact {supportLabel()}. Include the order, wish or shipment reference shown in <Link href="/orders" className="font-black underline underline-offset-4">Your cards &amp; orders</Link>.</p>
      </InfoCallout>
    </TrustShell>
  );
}
