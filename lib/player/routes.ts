export const PLAYER_ROUTES = [
  { href: "/hq", label: "HQ", detail: "Your collection at a glance", keywords: "home dashboard", glyph: "⌂" },
  { href: "/wishes", label: "Wishes", detail: "Make a wish or replay your latest reveal", keywords: "pull nebu replay", glyph: "✦" },
  { href: "/collection", label: "Binder", detail: "Browse and arrange your cards", keywords: "collection owned duplicate signature", glyph: "▣" },
  { href: "/catalogue", label: "Catalogue", detail: "Explore cards and favourites", keywords: "cards pokemon sets favourite", glyph: "▤" },
  { href: "/constellation", label: "Constellation", detail: "Find your cards among the stars", keywords: "stars galaxy find", glyph: "✧" },
  { href: "/constellation?panel=history", label: "Latest pulls", detail: "Your wish history in Constellation", keywords: "history archive recent", glyph: "↺" },
  { href: "/friends", label: "Friends", detail: "Visit friends and open trades", keywords: "trade social trainer", glyph: "♢" },
  { href: "/leaderboard", label: "Universe Ranks", detail: "The top 100 galaxies", keywords: "leaderboard rank pharaoh", glyph: "◉" },
  { href: "/achievements", label: "Badges", detail: "Milestones and unlocked rewards", keywords: "achievement reward skin", glyph: "✪" },
  { href: "/shipping", label: "Shipping & orders", detail: "Select cards and follow your deliveries", keywords: "address order tracking delivery", glyph: "▰" },
  { href: "/wishes/shop", label: "Recharge", detail: "Wish packages and availability", keywords: "shop balance wishes", glyph: "✦" },
  { href: "/profile", label: "Profile", detail: "Your trainer profile and account", keywords: "name avatar password", glyph: "◉" },
  { href: "/help", label: "Help", detail: "Answers and support in one place", keywords: "support contact question refund", glyph: "?" },
] as const;

export function searchPlayerRoutes(query: string) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return PLAYER_ROUTES.filter((route) => words.every((word) =>
    `${route.label} ${route.detail} ${route.keywords}`.toLocaleLowerCase().includes(word),
  ));
}

export function isRouteActive(pathname: string, href: string) {
  // Recharge is a separate destination inside /wishes.
  if (href === "/wishes" && pathname.startsWith("/wishes/shop")) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}
