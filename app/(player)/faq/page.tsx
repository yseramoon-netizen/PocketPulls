import { TrustShell } from "@/components/player/TrustShell";

const FAQS = [
  ["What is a wish?", "One prepaid credit that allocates one genuine physical trading-card result."],
  ["Do I always get a card?", "A successfully completed wish records one card result. If allocation fails before that result is recorded, the transaction is designed to roll back."],
  ["Can I choose the card I get?", "No. The rarity is selected using the published odds, then a card is selected from that rarity's enabled summon catalogue."],
  ["How are the odds calculated?", "Rarity odds are configured independently from warehouse quantity. The system selects the rarity first, then a card inside that rarity. Adding more Common cards therefore does not make Common automatically more likely."],
  ["Do you physically own every card in the summon catalogue?", "Not necessarily. Some cards may be sourced after they are pulled. Your result is recorded immediately; cards that are not already held must be sourced before dispatch."],
  ["Does adding more cards change the odds?", "Adding cards inside a rarity does not change that rarity tier's configured chance. It changes which individual cards can be selected within that tier."],
  ["Can I pull duplicates?", "Yes. Duplicate card results are possible and are tracked in your Collection."],
  ["What does the star colour mean?", "It reveals the rarity of the result already allocated by the server. It is not a second roll."],
  ["Why does Mew sometimes appear?", "The special reveal is used for higher-rarity outcomes. It does not alter the server result."],
  ["Where do my cards go?", "They are recorded in your Collection. Cards remain associated with your account until they are traded or processed through shipping."],
  ["What happens when I request shipping?", "Cards already physically held can move straight into fulfilment. Any outstanding sourced-on-demand cards are flagged for sourcing before the shipment is prepared."],
  ["Can I trade cards?", "Where trading is available, eligible cards can be transferred through the in-app trade flow."],
  ["What does market value mean?", "It is reference information only, not a guaranteed selling price or a promise that Unown Pulls will buy the card from you."],
  ["Can I cash out wishes or cards?", "No. Unown Pulls does not provide cash redemption for wishes or pulled cards."],
  ["What is the minimum recharge?", "10 wishes for £5.00 before any eligible first-recharge discount."],
  ["How does the first recharge discount work?", "An eligible account receives 20% off its first successful wish recharge. It applies once per account."],
  ["What if payment succeeds but my wishes do not appear?", "Give payment confirmation a short moment to complete. If the balance still does not update, contact support."],
  ["What if the animation closes or my connection drops?", "The animation is not the source of truth. Your server-side wish record and Collection determine the result."],
  ["Are you affiliated with Pokémon?", "No. Unown Pulls is an independent reseller and is not affiliated with, sponsored by or endorsed by Nintendo, The Pokémon Company or Game Freak."],
] as const;

export default function FaqPage() {
  return (
    <TrustShell
      eyebrow="FAQ"
      title="Quick answers"
      intro="The things players usually need to know."
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
