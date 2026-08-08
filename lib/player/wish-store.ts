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
export const MINIMUM_WISH_RECHARGE = 10;

export const WISH_PACKAGES: readonly WishPackage[] = [
  {
    id: "little-star",
    name: "Little Star",
    subtitle: "10 wishes",
    wishes: 10,
    amountPence: 475,
    bulkDiscountPercent: 5,
  },
  {
    id: "wishing-cluster",
    name: "Wishing Cluster",
    subtitle: "25 wishes",
    wishes: 25,
    amountPence: 1125,
    bulkDiscountPercent: 10,
  },
  {
    id: "starfall",
    name: "Starfall",
    subtitle: "50 wishes",
    wishes: 50,
    amountPence: 2125,
    bulkDiscountPercent: 15,
    badge: "Popular",
  },
  {
    id: "constellation",
    name: "Constellation",
    subtitle: "100 wishes",
    wishes: 100,
    amountPence: 4000,
    bulkDiscountPercent: 20,
    badge: "Best balance",
  },
  {
    id: "celestial-vault",
    name: "Celestial Vault",
    subtitle: "250 wishes",
    wishes: 250,
    amountPence: 9375,
    bulkDiscountPercent: 25,
    badge: "Best value",
  },
] as const;

export function getWishPackage(packageId: string): WishPackage | null {
  const wishPackage = WISH_PACKAGES.find((item) => item.id === packageId) ?? null;

  if (!wishPackage || wishPackage.wishes < MINIMUM_WISH_RECHARGE) {
    return null;
  }

  return wishPackage;
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
