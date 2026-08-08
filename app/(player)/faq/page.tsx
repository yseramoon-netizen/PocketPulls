import { TrustShell } from "@/components/player/TrustShell";

const FAQS = [
  ["What is a wish?", "A wish is one prepaid credit that allocates one physical trading card from the current wish pool."],
  ["Do I always get a card?", "A successfully completed wish allocates one physical card. If the server transaction fails before allocation, the transaction is designed to roll back instead of intentionally consuming a wish without a card."],
  ["Can I choose the card I get?", "No. The card is selected randomly from the live physical pool."],
  ["How are the odds calculated?", "The odds are based on the physical copies currently available in the wish pool. More copies of a rarity in the pool means a higher combined chance of that rarity. See Live Odds for the current figures."],
  ["Why can the odds change?", "The pool changes when cards are added or pulled. Because the odds reflect the real pool, they update with it."],
  ["Can I pull duplicates?", "Yes. Duplicate copies are possible and are tracked in your Collection."],
  ["What does the star colour mean?", "The reveal star changes to match the rarity of the card that has already been allocated. It is a reveal effect, not a second roll."],
  ["Why does Mew sometimes appear?", "The special reveal is used for higher-rarity outcomes. It does not alter the card that the server already selected."],
  ["Where do my cards go after a wish?", "They are added to your Collection and remain associated with your account until you use the available shipping or trading tools."],
  ["Can I trade cards?", "Where the trade feature is available, eligible cards can be transferred between players through the in-app trade flow."],
  ["When can I ship my cards?", "Your Shipping page shows the cards currently available for shipping and any eligibility or delivery options that apply."],
  ["What does market value mean?", "It is a reference value for the card, not a guaranteed selling price and not a promise that Unown Pulls will buy the card from you."],
  ["Can I cash out wishes or cards?", "No. Unown Pulls does not provide a cash-out or cash-redemption system for wishes or pulled cards."],
  ["What is the minimum recharge?", "10 wishes. The starting pack is £5.00, equal to 50p per wish before any eligible first-recharge discount."],
  ["How does the first recharge discount work?", "An eligible account receives 20% off its first successful wish recharge. It applies once per account."],
  ["What if payment succeeds but my wishes do not appear?", "Give the payment confirmation a short moment to complete. If the balance still does not update, contact support so the payment record can be checked."],
  ["What if the animation closes or my connection drops?", "The animation is not the source of truth. Your server-side wish record and Collection determine what was actually allocated."],
  ["Are you affiliated with Pokémon?", "No. Unown Pulls is an independent reseller and is not affiliated with, sponsored by or endorsed by Nintendo, The Pokémon Company or Game Freak."],
] as const;

export default function FaqPage() {
  return (
    <TrustShell
      eyebrow="FAQ"
      title="Quick answers"
      intro="The common questions players should be able to answer without digging through legal text."
    >
      <div className="divide-y divide-white/[0.07]">
        {FAQS.map(([question, answer]) => (
          <details key={question} className="group py-4 first:pt-0 last:pb-0">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-black text-white [&::-webkit-details-marker]:hidden">
              {question}
              <span className="text-cyan-100/45 transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-white/48">{answer}</p>
          </details>
        ))}
      </div>
    </TrustShell>
  );
}
