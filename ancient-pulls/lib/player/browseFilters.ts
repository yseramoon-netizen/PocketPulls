export type BrowseFilters = {
  search: string;
  setName: string;
  rarity: string;
  availability: "all" | "available" | "reserved" | "duplicates";
  page: number;
  favouritesOnly: boolean;
};
export const DEFAULT_BROWSE_FILTERS: BrowseFilters = {
  search: "", setName: "", rarity: "", availability: "all", page: 1, favouritesOnly: false,
};
export function parseBrowseFilters(query: string): BrowseFilters {
  const params = new URLSearchParams(query);
  const availability = params.get("availability");
  const page = Number(params.get("page"));
  return {
    favouritesOnly: params.get("favourites") === "1",
    search: (params.get("q") || "").trim().slice(0, 200),
    setName: (params.get("set") || "").slice(0, 200),
    rarity: (params.get("rarity") || "").slice(0, 100),
    availability: availability === "available" || availability === "reserved" || availability === "duplicates" ? availability : "all",
    page: Number.isSafeInteger(page) ? Math.max(1, Math.min(100000, page)) : 1,
  };
}
export function writeBrowseFilters(query: string, filters: BrowseFilters): string {
  const params = new URLSearchParams(query);
  for (const [key, value] of Object.entries({
    favourites: filters.favouritesOnly ? "1" : "",
    q: filters.search, set: filters.setName, rarity: filters.rarity,
    availability: filters.availability === "all" ? "" : filters.availability,
    page: filters.page > 1 ? String(filters.page) : "",
  })) {
    if (value) params.set(key, value); else params.delete(key);
  }
  return params.toString();
}
