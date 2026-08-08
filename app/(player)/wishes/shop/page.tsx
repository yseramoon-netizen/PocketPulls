"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase";

import styles from "./shop.module.css";

type StorePackage = {
  id: string;
  name: string;
  subtitle: string;
  wishes: number;
  amountPence: number;
  bulkDiscountPercent: number;
  badge?: string;
  firstRechargeAmountPence: number;
};

type StoreResponse = {
  ok: true;
  firstRechargeAvailable: boolean;
  firstRechargeDiscountPercent: number;
  packages: StorePackage[];
};

type CheckoutResponse = {
  ok: true;
  checkoutUrl: string;
  orderId: string;
  firstRecharge: boolean;
  wishes: number;
  amountPence: number;
};

type PurchaseStatusResponse = {
  ok: true;
  purchase: {
    id: string;
    status: string;
    wishes: number;
    amount_pence: number;
    first_recharge: boolean;
    paid_at: string | null;
  };
  wishBalance: number;
};

type Spark = {
  id: number;
  left: number;
  top: number;
  size: number;
  delay: number;
  duration: number;
};

type OrbitStar = {
  id: number;
  ring: "one" | "two";
  angle: number;
  radiusX: number;
  radiusY: number;
  delay: number;
  size: number;
};

const SPARKS: Spark[] = Array.from({ length: 28 }, (_, index) => ({
  id: index,
  left: (index * 37 + 9) % 96,
  top: (index * 53 + 6) % 88,
  size: 2 + (index % 3),
  delay: (index % 9) * 0.33,
  duration: 3.8 + (index % 5) * 0.65,
}));

const ORBIT_STARS: OrbitStar[] = [
  { id: 1, ring: "one", angle: 0, radiusX: 150, radiusY: 70, delay: 0.1, size: 14 },
  { id: 2, ring: "one", angle: 72, radiusX: 150, radiusY: 70, delay: 0.5, size: 12 },
  { id: 3, ring: "one", angle: 145, radiusX: 150, radiusY: 70, delay: 0.2, size: 15 },
  { id: 4, ring: "one", angle: 218, radiusX: 150, radiusY: 70, delay: 0.8, size: 13 },
  { id: 5, ring: "one", angle: 292, radiusX: 150, radiusY: 70, delay: 0.35, size: 14 },
  { id: 6, ring: "two", angle: 20, radiusX: 110, radiusY: 166, delay: 0.4, size: 12 },
  { id: 7, ring: "two", angle: 92, radiusX: 110, radiusY: 166, delay: 0.1, size: 15 },
  { id: 8, ring: "two", angle: 168, radiusX: 110, radiusY: 166, delay: 0.65, size: 14 },
  { id: 9, ring: "two", angle: 244, radiusX: 110, radiusY: 166, delay: 0.3, size: 13 },
  { id: 10, ring: "two", angle: 320, radiusX: 110, radiusY: 166, delay: 0.75, size: 12 },
];

function formatMoney(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.max(0, pence) / 100);
}

function pricePerWish(pence: number, wishes: number): string {
  const each = wishes > 0 ? pence / wishes : pence;
  return `${each.toFixed(1)}p / wish`;
}

async function playerFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.access_token) {
    throw new Error("Your session expired. Sign in again.");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.access_token}`);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...init,
    headers,
    cache: "no-store",
  });

  const payload = (await response.json()) as T | { error?: { message?: string } };

  if (!response.ok) {
    const message =
      typeof (payload as { error?: { message?: unknown } }).error?.message === "string"
        ? (payload as { error: { message: string } }).error.message
        : "The wish shop request failed.";
    throw new Error(message);
  }

  return payload as T;
}

export default function WishShopPage() {
  const [store, setStore] = useState<StoreResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyPackage, setBusyPackage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedPackageId, setSelectedPackageId] = useState("starfall");
  const [starBursts, setStarBursts] = useState(0);

  const triggerTwinkle = useCallback(() => {
    setStarBursts((current) => current + 1);
  }, []);

  const loadStore = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await playerFetch<StoreResponse>("/api/player/wishes/store");
      setStore(response);

      if (response.packages.length > 0) {
        setSelectedPackageId((current) =>
          response.packages.some((item) => item.id === current)
            ? current
            : response.packages[0].id,
        );
      }
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "The wish shop could not be opened.");
    } finally {
      setLoading(false);
    }
  }, []);

  const checkCompletedPurchase = useCallback(
    async (sessionId: string) => {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        try {
          const response = await playerFetch<PurchaseStatusResponse>(
            `/api/player/wishes/purchase-status?session_id=${encodeURIComponent(sessionId)}`,
          );

          if (response.purchase.status === "paid") {
            setSuccessMessage(`${response.purchase.wishes} wishes added.`);
            triggerTwinkle();
            window.dispatchEvent(
              new CustomEvent("pocketpulls:wish-balance", {
                detail: { wishBalance: response.wishBalance },
              }),
            );
            await loadStore();
            return;
          }
        } catch {
          // Webhook delivery can complete just after the checkout redirect.
        }

        await new Promise<void>((resolve) => window.setTimeout(resolve, 1300));
      }

      setSuccessMessage("Payment received. Your balance may take a moment to update.");
    },
    [loadStore, triggerTwinkle],
  );

  useEffect(() => {
    void loadStore();

    const params = new URLSearchParams(window.location.search);
    const purchase = params.get("purchase");
    const sessionId = params.get("session_id");

    if (purchase === "success" && sessionId) {
      setSuccessMessage("Adding your wishes...");
      void checkCompletedPurchase(sessionId);
    } else if (purchase === "cancelled") {
      setErrorMessage("Checkout cancelled. You were not charged.");
    }
  }, [checkCompletedPurchase, loadStore]);

  const selectedPackage = useMemo(
    () =>
      store?.packages.find((item) => item.id === selectedPackageId) ??
      store?.packages[0] ??
      null,
    [selectedPackageId, store],
  );

  const selectedPrice = selectedPackage
    ? store?.firstRechargeAvailable
      ? selectedPackage.firstRechargeAmountPence
      : selectedPackage.amountPence
    : 0;

  const startCheckout = useCallback(async (packageId: string) => {
    setBusyPackage(packageId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await playerFetch<CheckoutResponse>(
        "/api/player/wishes/checkout",
        {
          method: "POST",
          body: JSON.stringify({ packageId }),
        },
      );

      window.location.assign(response.checkoutUrl);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Checkout could not be started.");
      setBusyPackage(null);
    }
  }, []);

  return (
    <section className={styles.page}>
      <div className={styles.sky} aria-hidden="true">
        {SPARKS.map((spark) => (
          <span
            key={`${spark.id}-${starBursts}`}
            className={styles.spark}
            style={{
              left: `${spark.left}%`,
              top: `${spark.top}%`,
              width: `${spark.size}px`,
              height: `${spark.size}px`,
              animationDelay: `${spark.delay}s`,
              animationDuration: `${spark.duration}s`,
            }}
          />
        ))}
      </div>

      <div className={styles.content}>
        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <div className={styles.topRow}>
              <Link href="/wishes" className={styles.backButton}>
                ← Wishes
              </Link>

              {store?.firstRechargeAvailable ? (
                <span className={styles.firstRechargePill}>First recharge −20%</span>
              ) : null}
            </div>

            <p className={styles.eyebrow}>Wish Shop</p>
            <h1>Choose your wishes.</h1>
            <p className={styles.heroLine}>10 wishes minimum. Bigger packs cost less per wish.</p>
          </div>

          <div className={styles.jirachiStage}>
            <div className={styles.jirachiHalo} />
            <div className={styles.orbitOne} />
            <div className={styles.orbitTwo} />

            {ORBIT_STARS.map((star) => (
              <span
                key={`${star.id}-${starBursts}`}
                className={star.ring === "one" ? styles.orbitStarOne : styles.orbitStarTwo}
                style={{
                  ["--angle" as string]: `${star.angle}deg`,
                  ["--radius-x" as string]: `${star.radiusX}px`,
                  ["--radius-y" as string]: `${star.radiusY}px`,
                  ["--delay" as string]: `${star.delay}s`,
                  ["--size" as string]: `${star.size}px`,
                }}
              >
                ✦
              </span>
            ))}

            <button
              type="button"
              className={styles.jirachiButton}
              onClick={triggerTwinkle}
              aria-label="Make the stars twinkle"
            >
              <img src="/jirachi.png" alt="Jirachi" draggable={false} className={styles.jirachiImage} />
            </button>

            <div className={styles.burstLayer} aria-hidden="true">
              {Array.from({ length: 12 }, (_, index) => (
                <span
                  key={`burst-${index}-${starBursts}`}
                  className={styles.burstStar}
                  style={{
                    ["--burst-angle" as string]: `${index * 30}deg`,
                    ["--burst-distance" as string]: `${94 + (index % 3) * 18}px`,
                    ["--burst-delay" as string]: `${(index % 4) * 0.05}s`,
                  }}
                >
                  ✦
                </span>
              ))}
            </div>
          </div>
        </header>

        {errorMessage ? <div className={styles.errorBanner}>{errorMessage}</div> : null}
        {successMessage ? <div className={styles.successBanner}>{successMessage}</div> : null}

        {loading ? (
          <div className={styles.loadingCard}>
            <span>✦</span>
            <p>Loading wish packs...</p>
          </div>
        ) : (
          <section className={styles.buyArea}>
            <div className={styles.packagesGrid}>
              {(store?.packages ?? []).map((pkg) => {
                const active = selectedPackage?.id === pkg.id;
                const price = store?.firstRechargeAvailable
                  ? pkg.firstRechargeAmountPence
                  : pkg.amountPence;

                return (
                  <button
                    key={pkg.id}
                    type="button"
                    className={`${styles.packageCard} ${active ? styles.packageCardActive : ""}`}
                    onClick={() => setSelectedPackageId(pkg.id)}
                  >
                    <div className={styles.packageTopRow}>
                      <span className={styles.packageName}>{pkg.name}</span>
                      {pkg.badge ? <span className={styles.packageBadge}>{pkg.badge}</span> : null}
                    </div>

                    <strong className={styles.packageWishes}>{pkg.wishes}</strong>
                    <span className={styles.wishesLabel}>wishes</span>

                    <div className={styles.packagePriceRow}>
                      <strong>{formatMoney(price)}</strong>
                      <span>{pricePerWish(price, pkg.wishes)}</span>
                    </div>

                    <div className={styles.packageFooter}>
                      <span>{pkg.bulkDiscountPercent}% bundle saving</span>
                      {store?.firstRechargeAvailable ? (
                        <span className={styles.originalPrice}>{formatMoney(pkg.amountPence)}</span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedPackage ? (
              <aside className={styles.purchaseCard}>
                <div className={styles.purchaseGlow} />
                <div className={styles.purchaseStar}>✦</div>

                <div className={styles.purchaseCopy}>
                  <p>{selectedPackage.name}</p>
                  <h2>{selectedPackage.wishes} wishes</h2>
                  <div className={styles.purchasePriceLine}>
                    <strong>{formatMoney(selectedPrice)}</strong>
                    {store?.firstRechargeAvailable ? (
                      <span>{formatMoney(selectedPackage.amountPence)}</span>
                    ) : null}
                  </div>
                  <small>{pricePerWish(selectedPrice, selectedPackage.wishes)}</small>
                </div>

                <button
                  type="button"
                  className={styles.checkoutButton}
                  disabled={busyPackage !== null}
                  onClick={() => void startCheckout(selectedPackage.id)}
                >
                  {busyPackage === selectedPackage.id
                    ? "Opening checkout..."
                    : `Buy ${selectedPackage.wishes} wishes`}
                </button>

                <p className={styles.secureLine}>Secure checkout</p>
              </aside>
            ) : null}
          </section>
        )}
      </div>
    </section>
  );
}
