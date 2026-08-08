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

const SPARKS: Spark[] = Array.from({ length: 24 }, (_, index) => ({
  id: index,
  left: (index * 37 + 11) % 96,
  top: (index * 53 + 7) % 88,
  size: 2 + (index % 3),
  delay: (index % 8) * 0.4,
  duration: 3.8 + (index % 5) * 0.7,
}));

function formatMoney(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.max(0, pence) / 100);
}

function formatWishPrice(pence: number, wishes: number): string {
  const each = wishes > 0 ? pence / wishes : pence;
  return `${each.toFixed(each < 10 ? 1 : 0)}p each`;
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

  const payload = (await response.json()) as
    | T
    | { error?: { message?: string } };

  if (!response.ok) {
    const message =
      typeof (payload as { error?: { message?: unknown } }).error?.message ===
        "string"
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

  const loadStore = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await playerFetch<StoreResponse>(
        "/api/player/wishes/store",
      );
      setStore(response);
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Jirachi could not open the wish shop.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const checkCompletedPurchase = useCallback(async (sessionId: string) => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        const response = await playerFetch<PurchaseStatusResponse>(
          `/api/player/wishes/purchase-status?session_id=${encodeURIComponent(
            sessionId,
          )}`,
        );

        if (response.purchase.status === "paid") {
          setSuccessMessage(
            `${response.purchase.wishes} wishes have landed in your balance. Jirachi approves.`,
          );
          setStarBursts((current) => current + 1);
          window.dispatchEvent(
            new CustomEvent("pocketpulls:wish-balance", {
              detail: {
                wishBalance: response.wishBalance,
              },
            }),
          );
          await loadStore();
          return;
        }
      } catch {
        // The webhook can arrive just after the redirect. Keep polling briefly.
      }

      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 1300);
      });
    }

    setSuccessMessage(
      "Payment received. Your wishes are still travelling through the stars — refresh in a moment if the balance has not updated yet.",
    );
  }, [loadStore]);

  useEffect(() => {
    void loadStore();

    const params = new URLSearchParams(window.location.search);
    const purchase = params.get("purchase");
    const sessionId = params.get("session_id");

    if (purchase === "success" && sessionId) {
      setSuccessMessage("Jirachi is counting your new wishes...");
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

  const startCheckout = useCallback(
    async (packageId: string) => {
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
          error instanceof Error
            ? error.message
            : "Jirachi could not start checkout.",
        );
        setBusyPackage(null);
      }
    },
    [],
  );

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
            <p className={styles.eyebrow}>Jirachi&apos;s Wish Exchange</p>
            <h1>Recharge your wishes</h1>
            <p>
              Every wish can open a real card from Unown Pulls. Start at 50p,
              or take a bigger constellation for a lower price per wish.
            </p>

            <div className={styles.heroActions}>
              <Link href="/wishes" className={styles.secondaryButton}>
                Back to Wishes
              </Link>
              <button
                type="button"
                onClick={() => setStarBursts((current) => current + 1)}
                className={styles.jirachiButton}
              >
                Make the stars twinkle ✦
              </button>
            </div>
          </div>

          <div className={styles.jirachiStage}>
            <div className={styles.jirachiHalo} />
            <div className={styles.orbitOne} />
            <div className={styles.orbitTwo} />
            <img
              src="/jirachi.png"
              alt="Jirachi"
              draggable={false}
              className={styles.jirachiImage}
            />
            <div className={styles.wishCounterBubble}>
              <span>Base rate</span>
              <strong>£0.50</strong>
              <small>per wish</small>
            </div>
          </div>
        </header>

        {store?.firstRechargeAvailable ? (
          <div className={styles.firstRechargeBanner}>
            <div>
              <p className={styles.bannerKicker}>First recharge blessing</p>
              <h2>20% off your first wish recharge</h2>
              <p>
                The discount stacks on top of the package savings below, so
                your first big recharge gets the strongest value.
              </p>
            </div>
            <span className={styles.discountOrb}>-20%</span>
          </div>
        ) : null}

        {errorMessage ? (
          <div className={styles.errorBanner}>{errorMessage}</div>
        ) : null}

        {successMessage ? (
          <div className={styles.successBanner}>{successMessage}</div>
        ) : null}

        {loading ? (
          <div className={styles.loadingCard}>
            <div className={styles.loadingStar}>✦</div>
            <p>Jirachi is arranging the wish crystals...</p>
          </div>
        ) : (
          <div className={styles.shopGrid}>
            <div className={styles.packagesGrid}>
              {(store?.packages ?? []).map((item) => {
                const active = item.id === selectedPackageId;
                const firstPrice = store?.firstRechargeAvailable
                  ? item.firstRechargeAmountPence
                  : null;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedPackageId(item.id)}
                    className={`${styles.packageCard} ${
                      active ? styles.packageCardActive : ""
                    }`}
                  >
                    {item.badge ? (
                      <span className={styles.packageBadge}>{item.badge}</span>
                    ) : null}

                    <div className={styles.packageStars} aria-hidden="true">
                      <span>✦</span>
                      <span>✧</span>
                      <span>✦</span>
                    </div>

                    <p className={styles.packageName}>{item.name}</p>
                    <p className={styles.packageWishes}>
                      {item.wishes.toLocaleString("en-GB")} Wishes
                    </p>
                    <p className={styles.packageSubtitle}>{item.subtitle}</p>

                    <div className={styles.packagePriceBlock}>
                      {firstPrice !== null ? (
                        <span className={styles.originalPrice}>
                          {formatMoney(item.amountPence)}
                        </span>
                      ) : null}
                      <strong>
                        {formatMoney(firstPrice ?? item.amountPence)}
                      </strong>
                      <small>
                        {formatWishPrice(
                          firstPrice ?? item.amountPence,
                          item.wishes,
                        )}
                      </small>
                    </div>

                    <div className={styles.savingsRow}>
                      {item.bulkDiscountPercent > 0 ? (
                        <span>{item.bulkDiscountPercent}% package saving</span>
                      ) : (
                        <span>Standard rate</span>
                      )}
                      {firstPrice !== null ? <span>+ 20% first recharge</span> : null}
                    </div>
                  </button>
                );
              })}
            </div>

            <aside className={styles.checkoutCard}>
              <p className={styles.eyebrow}>Your selected constellation</p>

              {selectedPackage ? (
                <>
                  <div className={styles.checkoutWishOrb}>
                    <span>✦</span>
                    <strong>{selectedPackage.wishes}</strong>
                    <small>Wishes</small>
                  </div>

                  <h2>{selectedPackage.name}</h2>
                  <p className={styles.checkoutDescription}>
                    {selectedPackage.subtitle} Wishes are credited to your
                    Unown Pulls balance only after Stripe confirms payment.
                  </p>

                  <div className={styles.checkoutBreakdown}>
                    <div>
                      <span>Package price</span>
                      <strong>{formatMoney(selectedPackage.amountPence)}</strong>
                    </div>
                    <div>
                      <span>Bulk saving</span>
                      <strong>{selectedPackage.bulkDiscountPercent}%</strong>
                    </div>
                    {store?.firstRechargeAvailable ? (
                      <div className={styles.firstDiscountLine}>
                        <span>First recharge</span>
                        <strong>-20%</strong>
                      </div>
                    ) : null}
                    <div className={styles.totalLine}>
                      <span>Total</span>
                      <strong>
                        {formatMoney(
                          store?.firstRechargeAvailable
                            ? selectedPackage.firstRechargeAmountPence
                            : selectedPackage.amountPence,
                        )}
                      </strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void startCheckout(selectedPackage.id)}
                    disabled={busyPackage !== null}
                    className={styles.checkoutButton}
                  >
                    {busyPackage === selectedPackage.id
                      ? "Opening secure checkout..."
                      : `Recharge ${selectedPackage.wishes} Wishes`}
                  </button>

                  <p className={styles.secureNote}>
                    Secure checkout · GBP · wish balance updates after verified
                    payment confirmation
                  </p>
                </>
              ) : null}
            </aside>
          </div>
        )}

        <section className={styles.explainerGrid}>
          <article>
            <span className={styles.explainerGlyph}>✦</span>
            <h3>Bigger constellations cost less</h3>
            <p>
              The base is 50p per wish, with package savings increasing to 25%
              at the largest tier.
            </p>
          </article>
          <article>
            <span className={styles.explainerGlyph}>20%</span>
            <h3>First recharge stacks</h3>
            <p>
              Your one-time 20% first recharge discount is applied after the
              package saving, making the first top-up especially worthwhile.
            </p>
          </article>
          <article>
            <span className={styles.explainerGlyph}>✓</span>
            <h3>Credited only after payment</h3>
            <p>
              The browser never grants wishes. A signed Stripe webhook tells the
              server to credit the wallet exactly once.
            </p>
          </article>
        </section>
      </div>
    </section>
  );
}
