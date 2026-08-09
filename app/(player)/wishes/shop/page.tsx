"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

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
  colour: string;
  glow: string;
};

const SPARKS: Spark[] = Array.from({ length: 18 }, (_, index) => ({
  id: index,
  left: (index * 31 + 17) % 96,
  top: (index * 49 + 9) % 88,
  size: 2 + (index % 3),
  delay: (index % 7) * 0.45,
  duration: 3.8 + (index % 4) * 0.75,
}));

const ORBIT_STARS: OrbitStar[] = [
  { id: 1, ring: "one", angle: 0, radiusX: 150, radiusY: 76, delay: 0.1, size: 11, colour: "#fef3c7", glow: "rgba(254,243,199,0.85)" },
  { id: 2, ring: "one", angle: 72, radiusX: 150, radiusY: 76, delay: 0.5, size: 9, colour: "#93c5fd", glow: "rgba(147,197,253,0.75)" },
  { id: 3, ring: "one", angle: 145, radiusX: 150, radiusY: 76, delay: 0.2, size: 10, colour: "#ddd6fe", glow: "rgba(221,214,254,0.82)" },
  { id: 4, ring: "one", angle: 218, radiusX: 150, radiusY: 76, delay: 0.8, size: 10, colour: "#fbcfe8", glow: "rgba(251,207,232,0.8)" },
  { id: 5, ring: "one", angle: 292, radiusX: 150, radiusY: 76, delay: 0.35, size: 11, colour: "#fef08a", glow: "rgba(254,240,138,0.88)" },
  { id: 6, ring: "two", angle: 20, radiusX: 110, radiusY: 166, delay: 0.4, size: 8, colour: "#ffffff", glow: "rgba(255,255,255,0.9)" },
  { id: 7, ring: "two", angle: 92, radiusX: 110, radiusY: 166, delay: 0.1, size: 10, colour: "#67e8f9", glow: "rgba(103,232,249,0.84)" },
  { id: 8, ring: "two", angle: 168, radiusX: 110, radiusY: 166, delay: 0.65, size: 9, colour: "#fef3c7", glow: "rgba(254,243,199,0.82)" },
  { id: 9, ring: "two", angle: 244, radiusX: 110, radiusY: 166, delay: 0.3, size: 8, colour: "#c4b5fd", glow: "rgba(196,181,253,0.84)" },
  { id: 10, ring: "two", angle: 320, radiusX: 110, radiusY: 166, delay: 0.75, size: 10, colour: "#f9a8d4", glow: "rgba(249,168,212,0.82)" },
];

function formatMoney(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.max(0, pence) / 100);
}

async function playerFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.access_token) {
    throw new Error("Your trainer session expired. Sign in again.");
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
  const [selectedPackageId, setSelectedPackageId] = useState("constellation");
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
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Aaru could not open the wish shop.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const checkCompletedPurchase = useCallback(async (sessionId: string) => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        const response = await playerFetch<PurchaseStatusResponse>(
          `/api/player/wishes/purchase-status?session_id=${encodeURIComponent(sessionId)}`,
        );

        if (response.purchase.status === "paid") {
          setSuccessMessage(
            `${response.purchase.wishes} wishes have landed in your balance. Aaru approves.`,
          );
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
        // Wait briefly for the webhook after redirect.
      }

      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 1300);
      });
    }

    setSuccessMessage(
      "Payment received. Your wishes are still travelling through the stars — refresh in a moment if the balance has not updated yet.",
    );
  }, [loadStore, triggerTwinkle]);

  useEffect(() => {
    void loadStore();

    const params = new URLSearchParams(window.location.search);
    const purchase = params.get("purchase");
    const sessionId = params.get("session_id");

    if (purchase === "success" && sessionId) {
      setSuccessMessage("Aaru is counting your new wishes...");
      void checkCompletedPurchase(sessionId);
    } else if (purchase === "cancelled") {
      setErrorMessage("Checkout was cancelled. No wishes were charged.");
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
      setErrorMessage(
        error instanceof Error ? error.message : "Aaru could not start checkout.",
      );
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
        <div className={styles.topBar}>
          <Link href="/wishes" className={styles.backLink}>
            ← Back to Wishes
          </Link>

          <span className={styles.securePill}>Secure checkout</span>
        </div>

        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Wish recharge</p>
            <h1>Recharge wishes</h1>
            <p className={styles.heroBody}>
              Pick your wish bundle and head straight to checkout.
            </p>

            {store?.firstRechargeAvailable ? (
              <div className={styles.promoCard}>
                <span className={styles.promoBadge}>FIRST RECHARGE</span>
                <div>
                  <strong>20% OFF</strong>
                  <small>Automatically applied at checkout</small>
                </div>
              </div>
            ) : null}
          </div>

          <div className={styles.jirachiStage}>
            <div className={styles.jirachiHalo} />
            <div className={styles.orbitOne} />
            <div className={styles.orbitTwo} />

            {ORBIT_STARS.map((star) => (
              <span
                key={`${star.id}-${starBursts}`}
                className={star.ring === "one" ? styles.orbitStarOne : styles.orbitStarTwo}
                aria-hidden="true"
                style={{
                  ["--angle" as string]: `${star.angle}deg`,
                  ["--radius-x" as string]: `${star.radiusX}px`,
                  ["--radius-y" as string]: `${star.radiusY}px`,
                  ["--delay" as string]: `${star.delay}s`,
                  ["--size" as string]: `${star.size}px`,
                  background: star.colour,
                  boxShadow: `0 0 ${star.size * 2.2}px ${star.size * 0.45}px ${star.glow}`,
                }}
              />
            ))}

            <button
              type="button"
              className={styles.jirachiImageButton}
              onClick={triggerTwinkle}
              aria-label="Make Aaru twinkle the stars"
            >
              <img
                src="/ancient-pulls/celestial-cat.png"
                alt="Aaru"
                draggable={false}
                className={styles.jirachiImage}
              />
            </button>

            <div className={styles.burstLayer} aria-hidden="true">
              {Array.from({ length: 12 }, (_, index) => (
                <span
                  key={`burst-${index}-${starBursts}`}
                  className={styles.burstStar}
                  style={{
                    ["--burst-angle" as string]: `${index * 30}deg`,
                    ["--burst-distance" as string]: `${96 + (index % 3) * 18}px`,
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
            <div className={styles.loadingStar}>✦</div>
            <p>Aaru is preparing the wish bundles...</p>
          </div>
        ) : (
          <div className={styles.mainGrid}>
            <section className={styles.packagesPanel}>
              <div className={styles.sectionHeading}>
                <div>
                  <p className={styles.sectionEyebrow}>Choose a bundle</p>
                  <h2>Wish packages</h2>
                </div>
              </div>

              <div className={styles.packagesGrid}>
                {(store?.packages ?? []).map((pkg) => {
                  const effectivePrice = store?.firstRechargeAvailable
                    ? pkg.firstRechargeAmountPence
                    : pkg.amountPence;

                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      className={`${styles.packageCard} ${selectedPackage?.id === pkg.id ? styles.packageCardActive : ""}`}
                      onClick={() => setSelectedPackageId(pkg.id)}
                    >
                      <div className={styles.packageTopRow}>
                        <div>
                          <p className={styles.packageName}>{pkg.name}</p>
                          <h3 className={styles.packageWishes}>{pkg.wishes} wishes</h3>
                        </div>

                        {pkg.badge ? <span className={styles.packageBadge}>{pkg.badge}</span> : null}
                      </div>

                      <p className={styles.packageSubtitle}>{pkg.subtitle}</p>

                      <div className={styles.packageFooter}>
                        <div>
                          <strong className={styles.packagePrice}>{formatMoney(effectivePrice)}</strong>
                        </div>

                        {pkg.bulkDiscountPercent > 0 ? (
                          <span className={styles.savingsTag}>Save {pkg.bulkDiscountPercent}%</span>
                        ) : (
                          <span className={styles.savingsTagMuted}>Base rate</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <aside className={styles.summaryCard}>
              <p className={styles.sectionEyebrow}>Selected package</p>
              <h2>{selectedPackage?.name ?? "Choose a bundle"}</h2>
              <p className={styles.summaryBody}>
                {selectedPackage?.subtitle ?? "Pick a wish package to continue to checkout."}
              </p>

              {selectedPackage ? (
                <div className={styles.summaryRows}>
                  <div className={styles.summaryRow}>
                    <span>Wishes</span>
                    <strong>{selectedPackage.wishes}</strong>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Bundle saving</span>
                    <strong>
                      {selectedPackage.bulkDiscountPercent > 0
                        ? `${selectedPackage.bulkDiscountPercent}%`
                        : "—"}
                    </strong>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>First recharge</span>
                    <strong>{store?.firstRechargeAvailable ? "20% off" : "Used"}</strong>
                  </div>
                  <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                    <span>Total</span>
                    <strong>{formatMoney(selectedPrice)}</strong>
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                className={styles.checkoutButton}
                disabled={!selectedPackage || busyPackage !== null}
                onClick={() => {
                  if (selectedPackage) {
                    void startCheckout(selectedPackage.id);
                  }
                }}
              >
                {busyPackage === selectedPackage?.id ? "Opening checkout..." : "Continue to checkout"}
              </button>

              <p className={styles.summaryNote}>
                Wishes are credited after payment succeeds.
              </p>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
