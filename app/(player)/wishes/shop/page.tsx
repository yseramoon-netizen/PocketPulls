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

type FloatingRune = {
  id: number;
  glyph: string;
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

const ORBIT_STARS: OrbitStar[] = [
  { id: 1, ring: "one", angle: 0, radiusX: 152, radiusY: 72, delay: 0.1, size: 12, colour: "#fef3c7", glow: "rgba(254,243,199,0.85)" },
  { id: 2, ring: "one", angle: 72, radiusX: 152, radiusY: 72, delay: 0.5, size: 9, colour: "#93c5fd", glow: "rgba(147,197,253,0.75)" },
  { id: 3, ring: "one", angle: 145, radiusX: 152, radiusY: 72, delay: 0.2, size: 11, colour: "#ddd6fe", glow: "rgba(221,214,254,0.82)" },
  { id: 4, ring: "one", angle: 218, radiusX: 152, radiusY: 72, delay: 0.8, size: 10, colour: "#fbcfe8", glow: "rgba(251,207,232,0.8)" },
  { id: 5, ring: "one", angle: 292, radiusX: 152, radiusY: 72, delay: 0.35, size: 12, colour: "#fef08a", glow: "rgba(254,240,138,0.88)" },
  { id: 6, ring: "two", angle: 20, radiusX: 112, radiusY: 170, delay: 0.4, size: 9, colour: "#ffffff", glow: "rgba(255,255,255,0.9)" },
  { id: 7, ring: "two", angle: 92, radiusX: 112, radiusY: 170, delay: 0.1, size: 11, colour: "#67e8f9", glow: "rgba(103,232,249,0.84)" },
  { id: 8, ring: "two", angle: 168, radiusX: 112, radiusY: 170, delay: 0.65, size: 10, colour: "#fef3c7", glow: "rgba(254,243,199,0.82)" },
  { id: 9, ring: "two", angle: 244, radiusX: 112, radiusY: 170, delay: 0.3, size: 9, colour: "#c4b5fd", glow: "rgba(196,181,253,0.84)" },
  { id: 10, ring: "two", angle: 320, radiusX: 112, radiusY: 170, delay: 0.75, size: 11, colour: "#f9a8d4", glow: "rgba(249,168,212,0.82)" },
];

const FLOATING_RUNES: FloatingRune[] = [
  { id: 1, glyph: "✦", left: 9, top: 12, size: 1.1, delay: 0, duration: 11 },
  { id: 2, glyph: "✧", left: 20, top: 71, size: 1.45, delay: 1.4, duration: 15 },
  { id: 3, glyph: "◇", left: 31, top: 27, size: 1, delay: 0.8, duration: 13 },
  { id: 4, glyph: "✦", left: 48, top: 14, size: 1.6, delay: 2.2, duration: 12 },
  { id: 5, glyph: "✧", left: 58, top: 74, size: 1.2, delay: 0.6, duration: 16 },
  { id: 6, glyph: "✦", left: 72, top: 22, size: 1.35, delay: 1.8, duration: 14 },
  { id: 7, glyph: "◇", left: 86, top: 62, size: 1.15, delay: 0.9, duration: 12 },
  { id: 8, glyph: "✧", left: 93, top: 28, size: 1.45, delay: 2.6, duration: 15 },
];

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

  const triggerTwinkle = useCallback(() => {
    setStarBursts((current) => current + 1);
  }, []);

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
          triggerTwinkle();
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
  }, [loadStore, triggerTwinkle]);

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

        {FLOATING_RUNES.map((rune) => (
          <span
            key={`rune-${rune.id}`}
            className={styles.floatingRune}
            style={{
              left: `${rune.left}%`,
              top: `${rune.top}%`,
              fontSize: `${rune.size}rem`,
              animationDelay: `${rune.delay}s`,
              animationDuration: `${rune.duration}s`,
            }}
          >
            {rune.glyph}
          </span>
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
                onClick={triggerTwinkle}
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
              aria-label="Make Jirachi twinkle the stars"
            >
              <img
                src="/jirachi.png"
                alt="Jirachi"
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
            <p>Jirachi is preparing the wish bundles...</p>
          </div>
        ) : (
          <>
            <section className={styles.shopGrid}>
              <div className={styles.packagesGrid}>
                {(store?.packages ?? []).map((pkg) => {
                  const firstRechargeActive = store?.firstRechargeAvailable;
                  const effectivePrice = firstRechargeActive
                    ? pkg.firstRechargeAmountPence
                    : pkg.amountPence;
                  const basePrice = pkg.wishes * 50;

                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      className={`${styles.packageCard} ${
                        selectedPackage?.id === pkg.id
                          ? styles.packageCardActive
                          : ""
                      }`}
                      onClick={() => setSelectedPackageId(pkg.id)}
                    >
                      {pkg.badge ? (
                        <span className={styles.packageBadge}>{pkg.badge}</span>
                      ) : null}

                      <div className={styles.packageStars} aria-hidden="true">
                        <span>✦</span>
                        <span>✧</span>
                        <span>✦</span>
                      </div>

                      <p className={styles.packageName}>{pkg.name}</p>
                      <h3 className={styles.packageWishes}>
                        {pkg.wishes} wishes
                      </h3>
                      <p className={styles.packageSubtitle}>{pkg.subtitle}</p>

                      <div className={styles.packagePriceBlock}>
                        {pkg.bulkDiscountPercent > 0 ? (
                          <span className={styles.originalPrice}>
                            Normally {formatMoney(basePrice)}
                          </span>
                        ) : (
                          <span className={styles.originalPrice}>
                            Base package
                          </span>
                        )}

                        <strong className={styles.packagePrice}>
                          {formatMoney(effectivePrice)}
                        </strong>

                        <span className={styles.packagePriceMeta}>
                          {formatWishPrice(effectivePrice, pkg.wishes)}
                        </span>
                      </div>

                      <div className={styles.packageSavingsRow}>
                        {pkg.bulkDiscountPercent > 0 ? (
                          <span className={styles.savingsTag}>
                            {pkg.bulkDiscountPercent}% bundle saving
                          </span>
                        ) : (
                          <span className={styles.savingsTagMuted}>
                            Standard rate
                          </span>
                        )}

                        {firstRechargeActive ? (
                          <span className={styles.firstRechargeTag}>
                            +20% first recharge
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>

              <aside className={styles.checkoutCard}>
                <p className={styles.cardKicker}>Selected package</p>
                <h2>{selectedPackage?.name ?? "Choose a wish bundle"}</h2>
                <p className={styles.checkoutBody}>
                  {selectedPackage?.subtitle ??
                    "Pick the bundle that feels right and Jirachi will guide you to checkout."}
                </p>

                {selectedPackage ? (
                  <div className={styles.checkoutSummary}>
                    <div className={styles.checkoutRow}>
                      <span>Wishes</span>
                      <strong>{selectedPackage.wishes}</strong>
                    </div>
                    <div className={styles.checkoutRow}>
                      <span>Bundle saving</span>
                      <strong>
                        {selectedPackage.bulkDiscountPercent > 0
                          ? `${selectedPackage.bulkDiscountPercent}%`
                          : "—"}
                      </strong>
                    </div>
                    <div className={styles.checkoutRow}>
                      <span>First recharge bonus</span>
                      <strong>
                        {store?.firstRechargeAvailable ? "20% off" : "Used"}
                      </strong>
                    </div>
                    <div className={styles.checkoutRow}>
                      <span>Effective price</span>
                      <strong>
                        {formatMoney(
                          store?.firstRechargeAvailable
                            ? selectedPackage.firstRechargeAmountPence
                            : selectedPackage.amountPence,
                        )}
                      </strong>
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
                  {busyPackage === selectedPackage?.id
                    ? "Opening checkout..."
                    : "Continue to secure checkout"}
                </button>

                <p className={styles.checkoutFinePrint}>
                  Stripe handles payment, but the browser does not decide your
                  price or wishes. The server calculates the package and your
                  first recharge discount, then a verified webhook credits your
                  wish balance once payment succeeds.
                </p>
              </aside>
            </section>

            <section className={styles.explainerGrid}>
              <article className={styles.explainerCard}>
                <span>✦</span>
                <h3>Every wish opens a real card</h3>
                <p>
                  Wishes are not cosmetic. Each one can pull a real card from
                  the Unown Pulls stock pool.
                </p>
              </article>

              <article className={styles.explainerCard}>
                <span>✧</span>
                <h3>Bigger bundles stretch further</h3>
                <p>
                  The price per wish falls as you choose larger packages, making
                  bigger recharges more attractive.
                </p>
              </article>

              <article className={styles.explainerCard}>
                <span>◇</span>
                <h3>First recharge is blessed</h3>
                <p>
                  The first wish purchase receives an extra 20% off the package
                  total, on top of the bulk saving.
                </p>
              </article>
            </section>
          </>
        )}
      </div>
    </section>
  );
}
