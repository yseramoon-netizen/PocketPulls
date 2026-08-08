export type WishPackage = {
  id: string;
  name: string;
  subtitle: string;
  wishes: number;
  amountPence: number;
  bulkDiscountPercent: number;
  badge?: string;
};

export const FIRST_RECHARGE_DISCOUNT_PERCENT = 20;

export const WISH_PACKAGES: readonly WishPackage[] = [
  {
    id: "single",
    name: "Single Wish",
    subtitle: "Just one little star.",
    wishes: 1,
    amountPence: 50,
    bulkDiscountPercent: 0,
  },
  {
    id: "little-star",
    name: "Little Star",
    subtitle: "A small bundle for a few pulls.",
    wishes: 10,
    amountPence: 475,
    bulkDiscountPercent: 5,
  },
  {
    id: "wishing-cluster",
    name: "Wishing Cluster",
    subtitle: "Enough for a proper little session.",
    wishes: 25,
    amountPence: 1125,
    bulkDiscountPercent: 10,
  },
  {
    id: "starfall",
    name: "Starfall",
    subtitle: "A bigger reserve with stronger value.",
    wishes: 50,
    amountPence: 2125,
    bulkDiscountPercent: 15,
    badge: "Popular",
  },
  {
    id: "constellation",
    name: "Constellation",
    subtitle: "A serious stock of wishes.",
    wishes: 100,
    amountPence: 4000,
    bulkDiscountPercent: 20,
    badge: "Best balance",
  },
  {
    id: "celestial-vault",
    name: "Celestial Vault",
    subtitle: "Maximum package savings.",
    wishes: 250,
    amountPence: 9375,
    bulkDiscountPercent: 25,
    badge: "Best value",
  },
] as const;

export function getWishPackage(packageId: string): WishPackage | null {
  return WISH_PACKAGES.find((item) => item.id === packageId) ?? null;
}

export function applyFirstRechargeDiscount(amountPence: number): number {
  return Math.max(
    1,
    Math.round(
      Math.max(0, amountPence) *
        ((100 - FIRST_RECHARGE_DISCOUNT_PERCENT) / 100),
    ),
  );
}

export function formatPence(amountPence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.max(0, amountPence) / 100);
}
