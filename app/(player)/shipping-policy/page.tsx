import Link from "next/link";

import {
  CompactList,
  InfoCallout,
  Section,
  TrustShell,
} from "@/components/player/TrustShell";
import { BUSINESS_NAME, SUPPORT_EMAIL } from "@/lib/player/legal";

export default function ShippingPolicyPage() {
  return (
    <TrustShell
      eyebrow="Shipping policy"
      title="From your Collection to your door"
      intro="How cards are held, selected, sourced, dispatched and protected in transit."
    >
      <InfoCallout title="Your delivery choice">
        A used wish puts the allocated card in your Collection. You choose when to submit cards for shipping. Free shipping unlocks at the threshold shown in the Shipping Centre; earlier paid shipping can be requested through Help and is quoted before you agree.
      </InfoCallout>

      <Section title="1. Available destinations and payment methods">
        <p>
          Any destination restriction and available delivery service will be shown or confirmed before you submit a shipment. If we cannot deliver to the address you provide, we will tell you before taking a delivery payment. Wish recharges are paid by the card or other method offered on Stripe&apos;s secure checkout.
        </p>
      </Section>

      <Section title="2. When delivery takes place">
        <CompactList>
          <li>You first use wish credits and receive card results in your Collection.</li>
          <li>You then select the exact available cards to include and submit a delivery request.</li>
          <li>By choosing to hold cards in your Collection, you ask us to deliver them later, after your shipping request.</li>
          <li>We show or confirm a dispatch/delivery estimate for the requested shipment. If a different period is needed, we ask you to agree it clearly.</li>
          <li>Where no different period has been agreed, the legal default is delivery without undue delay and within 30 days after the sales contract is made.</li>
        </CompactList>
      </Section>

      <Section title="3. Free and earlier paid shipping">
        <p>
          The Shipping Centre shows the current free-shipping card threshold and your progress. Free shipping is an additional benefit, not a requirement to wait indefinitely. Before reaching the threshold, ask through Help for paid delivery. We will state the delivery charge and estimated timing and obtain your agreement before arranging it; no optional delivery charge is preselected.
        </p>
      </Section>

      <Section title="4. Sourcing and preparation">
        <p>
          Some allocated cards may need to be sourced before dispatch. {BUSINESS_NAME} must obtain a genuine card matching the recorded result. The shipment can remain in preparation while this happens, but we will not silently substitute another card. If we cannot meet the agreed delivery arrangement, we will contact you and offer the remedy required by law, including cancellation and refund where applicable.
        </p>
      </Section>

      <Section title="5. Address checks">
        <CompactList>
          <li>Check the recipient, postcode and full address before submitting.</li>
          <li>Contact us immediately if an address is wrong. We cannot promise a change after packing or carrier hand-off.</li>
          <li>We use the address only for delivery, order administration, fraud prevention and legal record-keeping as explained in the Privacy Notice.</li>
        </CompactList>
      </Section>

      <Section title="6. Dispatch and tracking">
        <p>
          Shipment status appears in the Shipping Centre. Where the chosen carrier provides tracking, the tracking number and link are added there. Carrier estimates are estimates, not a removal of your rights if goods are late or do not arrive.
        </p>
      </Section>

      <Section title="7. Risk, loss and damage">
        <p>
          {BUSINESS_NAME} remains responsible for the goods until you, or a person you nominate other than the carrier, takes physical possession. If a parcel is lost or arrives damaged, contact us rather than being left to resolve the claim with the carrier. Keep the packaging and provide photographs where reasonably requested.
        </p>
      </Section>

      <Section title="8. Delay and cancellation">
        <p>
          If delivery misses an essential agreed date, or we fail to deliver within an additional reasonable period you set where the law requires one, you may be entitled to end the contract and receive a refund. Contact {SUPPORT_EMAIL || "the support address published before orders open"} or use Help → Support.
        </p>
      </Section>

      <Section title="9. Returns after delivery">
        <p>
          Change-of-mind cancellation, return postage, refund timing, excessive handling and faulty-goods remedies are explained on the{" "}
          <Link className="text-cyan-100 underline underline-offset-2" href="/returns">Refunds &amp; Returns page</Link>.
        </p>
      </Section>
    </TrustShell>
  );
}
