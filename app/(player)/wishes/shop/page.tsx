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
};

type PurchaseStatusResponse = {
  ok: true;
  purchase: {
    status: string;
    wishes: number;
  };
  wishBalance: number;
};

const SPARKS = Array.from({ length: 28 }, (_, index) => ({
  id: index,
  left: (index * 37 + 9) % 96,
  top: (index * 53 + 6) % 88,
  delay: (index % 9) * 0.33,
  duration: 3.8 + (index % 5) * 0.65,
}));

const ORBIT_STARS = [
  [0, 150, 70, 0.1, 14, "one"],
  [72, 150, 70, 0.5, 12, "one"],
  [145, 150, 70, 0.2, 15, "one"],
  [218, 150, 70, 0.8, 13, "one"],
  [292, 150, 70, 0.35, 14, "one"],
  [20, 110, 166, 0.4, 12, "two"],
  [92, 110, 166, 0.1, 15, "two"],
  [168, 110, 166, 0.65, 14, "two"],
  [244, 110, 166, 0.3, 13, "two"],
  [320, 110, 166, 0.75, 12, "two"],
] as const;

function formatMoney(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.max(0, pence) / 100);
}

function perWish(pence: number, wishes: number): string {
  return `${(pence / Math.max(1, wishes)).toFixed(1)}p each`;
}

async function playerFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session?.access_token) {
    throw new Error("Your session expired. Sign in again.");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.access_token}`);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, { ...init, headers, cache: "no-store" });
  const payload = (await response.json()) as T | { error?: { message?: string } };

  if (!response.ok) {
    const message = (payload as { error?: { message?: string } }).error?.message;
    throw new Error(message || "The wish shop request failed.");
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
  const [accepted, setAccepted] = useState(false);
  const [starBursts, setStarBursts] = useState(0);

  const triggerTwinkle = useCallback(() => setStarBursts((value) => value + 1), []);

  const loadStore = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await playerFetch<StoreResponse>("/api/player/wishes/store");
      setStore(response);
      setSelectedPackageId((current) =>
        response.packages.some((item) => item.id === current)
          ? current
          : response.packages[0]?.id || "little-star",
      );
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "The wish shop could not be opened.");
    } finally {
      setLoading(false);
    }
  }, []);

  const checkPurchase = useCallback(async (sessionId: string) => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        const response = await playerFetch<PurchaseStatusResponse>(
          `/api/player/wishes/purchase-status?session_id=${encodeURIComponent(sessionId)}`,
        );

        if (response.purchase.status === "paid") {
          setSuccessMessage(`${response.purchase.wishes} wishes added.`);
          triggerTwinkle();
          window.dispatchEvent(new CustomEvent("pocketpulls:wish-balance", {
            detail: { wishBalance: response.wishBalance },
          }));
          await loadStore();
          return;
        }
      } catch {
        // Webhook can complete just after redirect.
      }

      await new Promise<void>((resolve) => window.setTimeout(resolve, 1300));
    }

    setSuccessMessage("Payment received. Your balance may take a moment to update.");
  }, [loadStore, triggerTwinkle]);

  useEffect(() => {
    void loadStore();

    const params = new URLSearchParams(window.location.search);
    const purchase = params.get("purchase");
    const sessionId = params.get("session_id");

    if (purchase === "success" && sessionId) {
      setSuccessMessage("Adding your wishes...");
      void checkPurchase(sessionId);
    } else if (purchase === "cancelled") {
      setErrorMessage("Checkout cancelled. You were not charged.");
    }
  }, [checkPurchase, loadStore]);

  const selectedPackage = useMemo(
    () => store?.packages.find((item) => item.id === selectedPackageId) ?? store?.packages[0] ?? null,
    [selectedPackageId, store],
  );

  const selectedPrice = selectedPackage
    ? store?.firstRechargeAvailable
      ? selectedPackage.firstRechargeAmountPence
      : selectedPackage.amountPence
    : 0;

  const startCheckout = useCallback(async (packageId: string) => {
    if (!accepted) {
      setErrorMessage("Confirm the purchase notice before continuing.");
      return;
    }

    setBusyPackage(packageId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await playerFetch<CheckoutResponse>("/api/player/wishes/checkout", {
        method: "POST",
        body: JSON.stringify({ packageId, purchaseNoticeAccepted: true }),
      });
      window.location.assign(response.checkoutUrl);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Checkout could not be started.");
      setBusyPackage(null);
    }
  }, [accepted]);

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
              <Link href="/wishes" className={styles.backButton}>← Wishes</Link>
              {store?.firstRechargeAvailable ? (
                <span className={styles.firstRechargePill}>First recharge −20%</span>
              ) : null}
            </div>
            <p className={styles.eyebrow}>Wish Shop</p>
            <h1>Choose your wishes.</h1>
            <p className={styles.heroLine}>Starts at 50p per wish. Bigger packs cost less.</p>
          </div>

          <div className={styles.jirachiStage}>
            <div className={styles.jirachiHalo} />
            <div className={styles.orbitOne} />
            <div className={styles.orbitTwo} />

            {ORBIT_STARS.map(([angle, radiusX, radiusY, delay, size, ring], index) => (
              <span
                key={`${index}-${starBursts}`}
                className={ring === "one" ? styles.orbitStarOne : styles.orbitStarTwo}
                style={{
                  ["--angle" as string]: `${angle}deg`,
                  ["--radius-x" as string]: `${radiusX}px`,
                  ["--radius-y" as string]: `${radiusY}px`,
                  ["--delay" as string]: `${delay}s`,
                  ["--size" as string]: `${size}px`,
                }}
              >✦</span>
            ))}

            <button type="button" className={styles.jirachiButton} onClick={triggerTwinkle} aria-label="Make the stars twinkle">
              <img src="/jirachi.png" alt="Jirachi" draggable={false} className={styles.jirachiImage} />
            </button>
          </div>
        </header>

        {errorMessage ? <div className={styles.errorBanner}>{errorMessage}</div> : null}
        {successMessage ? <div className={styles.successBanner}>{successMessage}</div> : null}

        {loading ? (
          <div className={styles.loadingCard}><span>✦</span><p>Opening the wish shop...</p></div>
        ) : (
          <>
            <div className={styles.packagesGrid}>
              {(store?.packages ?? []).map((pkg) => {
                const price = store?.firstRechargeAvailable ? pkg.firstRechargeAmountPence : pkg.amountPence;
                const selected = selectedPackage?.id === pkg.id;

                return (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => {
                      setSelectedPackageId(pkg.id);
                      setAccepted(false);
                    }}
                    className={`${styles.packageCard} ${selected ? styles.packageCardActive : ""}`}
                  >
                    <div className={styles.packageTopRow}>
                      <span className={styles.packageName}>{pkg.name}</span>
                      {pkg.badge ? <span className={styles.packageBadge}>{pkg.badge}</span> : null}
                    </div>
                    <strong className={styles.packageWishes}>{pkg.wishes}</strong>
                    <span className={styles.wishesLabel}>wishes</span>
                    <div className={styles.packagePriceRow}>
                      <strong>{formatMoney(price)}</strong>
                      <span>{perWish(price, pkg.wishes)}</span>
                    </div>
                    {store?.firstRechargeAvailable ? (
                      <span className={styles.originalPrice}>{formatMoney(pkg.amountPence)}</span>
                    ) : pkg.bulkDiscountPercent > 0 ? (
                      <span className={styles.saving}>{pkg.bulkDiscountPercent}% below base rate</span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {selectedPackage ? (
              <section className={styles.checkoutBar}>
                <div className={styles.checkoutMain}>
                  <div>
                    <p className={styles.checkoutLabel}>{selectedPackage.name}</p>
                    <p className={styles.checkoutWishes}>{selectedPackage.wishes} wishes</p>
                  </div>
                  <div className={styles.checkoutPrice}>
                    <strong>{formatMoney(selectedPrice)}</strong>
                    <span>{perWish(selectedPrice, selectedPackage.wishes)}</span>
                  </div>
                </div>

                <label className={styles.confirmRow}>
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(event) => setAccepted(event.target.checked)}
                  />
                  <span>
                    I&apos;m 18+ and understand each wish gives one random physical card. I agree to the <Link href="/terms">Terms</Link>.
                  </span>
                </label>

                <button
                  type="button"
                  disabled={!accepted || busyPackage !== null}
                  onClick={() => void startCheckout(selectedPackage.id)}
                  className={styles.checkoutButton}
                >
                  {busyPackage ? "Opening checkout..." : `Buy ${selectedPackage.wishes} wishes`}
                </button>
              </section>
            ) : null}

            <nav className={styles.trustLinks} aria-label="Wish information">
              <Link href="/how-wishes-work">How wishes work</Link>
              <Link href="/odds">Live odds</Link>
              <Link href="/player-protection">Player protection</Link>
              <Link href="/faq">FAQ</Link>
            </nav>
          </>
        )}
      </div>
    </section>
  );
}
