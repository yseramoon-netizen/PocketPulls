import Link from "next/link";

import {
  CompactList,
  InfoCallout,
  Section,
  TrustShell,
} from "@/components/player/TrustShell";
import {
  BUSINESS_ADDRESS,
  BUSINESS_LEGAL_NAME,
  BUSINESS_NAME,
  SUPPORT_EMAIL,
} from "@/lib/player/legal";

export default function ReturnsPage() {
  return (
    <TrustShell
      eyebrow="Refunds & returns"
      title="Cancel clearly. Return fairly. Keep every statutory right."
      intro="This policy explains the practical process for wish credits and physical cards bought online from Ancient Pulls."
    >
      <InfoCallout title="Nothing here writes away the law" tone="emerald">
        Change-of-mind cancellation rights and remedies for faulty, damaged, incorrect or misdescribed goods are different. Your legal remedies remain available even if a separate return condition below does not apply.
      </InfoCallout>

      <Section title="1. Your 14-day cancellation period">
        <CompactList>
          <li>For unused wish credits, tell us within 14 days after the purchase contract is made.</li>
          <li>For a physical card, the usual cancellation period ends 14 days after you, or someone you nominate, receives it.</li>
          <li>You do not need to give a reason. Any clear statement that you want to cancel is enough.</li>
          <li>If required cancellation information was not provided, the legal cancellation period may be extended.</li>
        </CompactList>
      </Section>

      <Section title="2. Immediate access to wish credits">
        <p>
          At checkout, you can expressly request that credits are added immediately. If all credits remain unused and you cancel in time, we return the amount paid for them. If you use some credits during the cancellation period, we may deduct only a lawful, proportionate amount for the part supplied. The calculation uses the effective per-credit price actually paid for that bundle, not a card&apos;s later market value.
        </p>
        <p>
          Using a wish or seeing its random result does not remove remedies for a technical failure, an incorrect allocation, an unavailable card, misleading information, or goods that are faulty or not as described.
        </p>
      </Section>

      <Section title="3. How to cancel or request a return">
        <CompactList>
          <li>
            Email {SUPPORT_EMAIL || "the customer-service address shown before orders open"} or open Help → Support and choose the closest problem type.
          </li>
          <li>Include your name, account email, order reference, the credits or cards concerned and a clear statement that you want to cancel or seek a remedy.</li>
          <li>Do not include a password or complete payment-card details.</li>
          <li>We will confirm the next step and, where goods must be returned, provide the return instructions and return address.</li>
        </CompactList>
        <p>
          Cancelling through Help keeps the request and replies attached to your account, but email or another clear statement is also valid.
        </p>
      </Section>

      <Section title="4. Model cancellation form">
        <div className="rounded-2xl border border-white/10 bg-black/15 p-4 text-white/65">
          <p>To: {BUSINESS_LEGAL_NAME || BUSINESS_NAME}, {BUSINESS_ADDRESS || "business address shown on the Contact page"}</p>
          <p>I give notice that I cancel my contract for the following: [wish bundle / physical card].</p>
          <p>Order reference: [reference]</p>
          <p>Ordered on / received on: [date]</p>
          <p>Name and address: [details]</p>
          <p>Signature: [only if sent on paper] · Date: [date]</p>
        </div>
        <p>You can use this wording, but you do not have to.</p>
      </Section>

      <Section title="5. Returning physical cards">
        <CompactList>
          <li>Send the goods back within 14 days after telling us you are cancelling, unless we agree to collect them.</li>
          <li>Pack cards securely. Reasonable inspection is allowed; a deduction may be made if handling goes beyond what is necessary to establish the card&apos;s nature, identity, characteristics and condition and reduces its value.</li>
          <li>For a change-of-mind return, you normally pay the direct return cost. Use a tracked or otherwise evidenced service because the parcel remains your responsibility until it reaches us.</li>
          <li>We pay reasonable return costs where a card is faulty, damaged on arrival, incorrect or not as described.</li>
        </CompactList>
      </Section>

      <Section title="6. Refund timing and method">
        <CompactList>
          <li>Refunds go to the original payment method unless you expressly agree otherwise.</li>
          <li>For unused credits or other cancellation not involving returned goods, we refund without undue delay and normally within 14 days after being told.</li>
          <li>For returned goods, we may wait until we receive them or you provide evidence of return, whichever happens first; the refund is then made within the legal 14-day limit.</li>
          <li>Where required, we refund the original standard delivery charge. We do not have to refund the extra cost of a delivery upgrade you chose above the standard service.</li>
          <li>A lawful deduction for excessive handling will be explained rather than hidden as a fee.</li>
        </CompactList>
      </Section>

      <Section title="7. Faulty, damaged, incorrect or misdescribed goods">
        <p>
          These are not treated as ordinary change-of-mind returns. Contact us promptly with the order reference and photographs where useful. Depending on the circumstances and the Consumer Rights Act 2015, remedies can include rejection and refund, repair or replacement, or a price reduction. We will not require you to accept store credit instead of a refund where the law entitles you to money back.
        </p>
      </Section>

      <Section title="8. Non-delivery, sourcing failure and unauthorised payment">
        <p>
          If an allocated card cannot be supplied as recorded, or delivery does not occur within the agreed arrangement, contact us. We will not silently substitute another card. If a payment appears unauthorised, contact your payment provider and us immediately so the account and order can be secured.
        </p>
      </Section>

      <Section title="9. Need help?">
        <p>
          Use the Support panel inside{" "}
          <Link className="text-cyan-100 underline underline-offset-2" href="/help#support">Help</Link>
          {" "}or email {SUPPORT_EMAIL || "the published support address"}. Shipping timings and lost-parcel handling are in the{" "}
          <Link className="text-cyan-100 underline underline-offset-2" href="/shipping-policy">Shipping Policy</Link>.
        </p>
      </Section>
    </TrustShell>
  );
}
