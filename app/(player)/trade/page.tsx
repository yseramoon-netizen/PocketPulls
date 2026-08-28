import { redirect } from "next/navigation";

type TradeRedirectProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function TradeRedirect({ searchParams }: TradeRedirectProps) {
  const params = await searchParams;
  const next = new URLSearchParams();
  const tradeId = first(params.trade);
  const friendId = first(params.friend);

  if (tradeId) next.set("trade", tradeId);
  else if (friendId) next.set("friend", friendId);
  else next.set("trade", "open");

  redirect(`/friends?${next.toString()}`);
}
