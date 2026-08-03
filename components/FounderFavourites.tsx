"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { supabase } from "@/lib/supabase";

type FounderOwner =
  | "lukas"
  | "skye";

type FavouriteCard = {
  owner: FounderOwner;
  founderName: string;
  updatedAt: string;

  card: {
    id: string;
    name: string;
    rarity: string;
    setName: string;
    cardNumber: string;
    imageUrl: string | null;
    marketValue: number;
  };
};

type FavouritesResponse = {
  success?: boolean;

  viewerOwner?:
    | FounderOwner
    | null;

  favourites?: {
    lukas:
      | FavouriteCard
      | null;

    skye:
      | FavouriteCard
      | null;
  };

  error?: string;
};

type FounderFavouriteButtonProps = {
  cardId: unknown;
  cardName: string;
};

const FAVOURITE_CHANGED_EVENT =
  "pocketpulls:founder-favourite-changed";

function normaliseIdentifier(
  value: unknown,
): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return String(value);
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  return "";
}

function formatCurrency(
  value: number,
): string {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",
    },
  ).format(value);
}

function formatDate(
  value: string,
): string {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Recently chosen";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    },
  ).format(date);
}

async function authenticatedFetch(
  input: string,
  init?: RequestInit,
) {
  const {
    data: { session },
    error,
  } =
    await supabase.auth.getSession();

  if (
    error ||
    !session?.access_token
  ) {
    throw new Error(
      "Your admin session could not be found. Log in again.",
    );
  }

  return fetch(input, {
    ...init,

    headers: {
      ...init?.headers,

      Authorization:
        `Bearer ${session.access_token}`,

      "Content-Type":
        "application/json",
    },

    cache: "no-store",
  });
}

export function FounderFavouritesDisplay() {
  const [
    response,
    setResponse,
  ] = useState<FavouritesResponse | null>(
    null,
  );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const loadFavourites =
    useCallback(
      async (
        background = false,
      ) => {
        if (!background) {
          setLoading(true);
        }

        setError("");

        try {
          const request =
            await authenticatedFetch(
              "/api/founder-favourites",
            );

          const payload =
            (await request.json()) as FavouritesResponse;

          if (
            !request.ok ||
            !payload.success
          ) {
            throw new Error(
              payload.error ||
                "The founder favourites could not be loaded.",
            );
          }

          setResponse(payload);
        } catch (
          loadError: unknown
        ) {
          console.error(
            "Favourite display error:",
            loadError,
          );

          setError(
            loadError instanceof Error
              ? loadError.message
              : "The founder favourites could not be loaded.",
          );
        } finally {
          setLoading(false);
        }
      },
      [],
    );

  useEffect(() => {
    void loadFavourites(false);

    function handleFavouriteChanged() {
      void loadFavourites(true);
    }

    window.addEventListener(
      FAVOURITE_CHANGED_EVENT,
      handleFavouriteChanged,
    );

    return () => {
      window.removeEventListener(
        FAVOURITE_CHANGED_EVENT,
        handleFavouriteChanged,
      );
    };
  }, [loadFavourites]);

  return (
    <section
      className="
        mt-8
        overflow-hidden
        rounded-[2.75rem]
        border
        border-amber-200/15
        bg-gradient-to-br
        from-amber-300/[0.08]
        via-white/[0.055]
        to-emerald-300/[0.06]
        shadow-[0_35px_110px_rgba(0,0,0,0.32)]
        backdrop-blur-3xl
      "
    >
      <div
        className="
          border-b
          border-white/10
          px-6
          py-6
          md:px-8
        "
      >
        <p
          className="
            text-xs
            font-black
            uppercase
            tracking-[0.24em]
            text-amber-200/55
          "
        >
          Founders Collection
        </p>

        <h2
          className="
            mt-2
            text-3xl
            font-black
            tracking-tight
            text-white
          "
        >
          We know ball
        </h2>

        <p
          className="
            mt-2
            text-sm
            font-semibold
            text-white/40
          "
        >
          Permanent showcase card 
        </p>
      </div>

      {loading ? (
        <div
          className="
            grid
            gap-4
            p-5
            md:grid-cols-2
            md:p-8
          "
        >
          <FavouriteSkeleton />

          <FavouriteSkeleton />
        </div>
      ) : error ? (
        <div
          className="
            m-5
            rounded-2xl
            border
            border-red-300/20
            bg-red-500/10
            px-5
            py-4
            font-bold
            text-red-100
            md:m-8
          "
        >
          {error}
        </div>
      ) : (
        <div
          className="
            grid
            gap-4
            p-5
            md:grid-cols-2
            md:p-8
          "
        >
          <FounderFavouriteCard
            founderName="Lukas"
            favourite={
              response
                ?.favourites
                ?.lukas ||
              null
            }
            viewerOwner={
              response?.viewerOwner ||
              null
            }
          />

          <FounderFavouriteCard
            founderName="Skye"
            favourite={
              response
                ?.favourites
                ?.skye ||
              null
            }
            viewerOwner={
              response?.viewerOwner ||
              null
            }
          />
        </div>
      )}
    </section>
  );
}

function FounderFavouriteCard({
  founderName,
  favourite,
  viewerOwner,
}: {
  founderName:
    | "Lukas"
    | "Skye";

  favourite:
    | FavouriteCard
    | null;

  viewerOwner:
    | FounderOwner
    | null;
}) {
  const owner =
    founderName === "Lukas"
      ? "lukas"
      : "skye";

  const isViewer =
    viewerOwner === owner;

  if (!favourite) {
    return (
      <article
        className="
          flex
          min-h-72
          flex-col
          items-center
          justify-center
          rounded-[2rem]
          border
          border-dashed
          border-white/15
          bg-black/15
          px-6
          text-center
        "
      >
        <div
          className="
            flex
            h-20
            w-20
            items-center
            justify-center
            rounded-[1.75rem]
            border
            border-white/10
            bg-white/[0.05]
            text-4xl
          "
        >
          ♡
        </div>

        <h3
          className="
            mt-5
            text-2xl
            font-black
            text-white
          "
        >
          {founderName}&apos;s Favourite
        </h3>

        <p
          className="
            mt-3
            max-w-sm
            text-sm
            font-semibold
            leading-6
            text-white/35
          "
        >
          {isViewer
            ? "Choose any card below and press Set as my favourite."
            : `${founderName} has not chosen a showcase card yet.`}
        </p>
      </article>
    );
  }

  return (
    <article
      className="
        group
        relative
        overflow-hidden
        rounded-[2rem]
        border
        border-amber-200/20
        bg-black/20
        p-5
        shadow-[0_0_45px_rgba(252,211,77,0.07)]
      "
    >
      <div
        className="
          pointer-events-none
          absolute
          inset-x-0
          top-0
          h-1
          bg-gradient-to-r
          from-amber-300
          via-yellow-100
          to-emerald-300
        "
      />

      <div
        className="
          flex
          flex-col
          gap-5
          sm:flex-row
        "
      >
        <div
          className="
            flex
            h-72
            w-full
            flex-none
            items-center
            justify-center
            overflow-hidden
            rounded-[1.5rem]
            border
            border-white/10
            bg-black/25
            sm:w-48
          "
        >
          {favourite.card.imageUrl ? (
            <img
              src={
                favourite.card
                  .imageUrl
              }
              alt={
                favourite.card.name
              }
              className="
                h-full
                w-full
                object-contain
                p-3
                drop-shadow-2xl
                transition
                duration-500
                group-hover:scale-105
              "
            />
          ) : (
            <span className="text-6xl">
              🎴
            </span>
          )}
        </div>

        <div
          className="
            flex
            min-w-0
            flex-1
            flex-col
            justify-center
          "
        >
          <p
            className="
              text-xs
              font-black
              uppercase
              tracking-[0.2em]
              text-amber-200/55
            "
          >
            {favourite.founderName}&apos;s Favourite
          </p>

          <h3
            className="
              mt-3
              text-3xl
              font-black
              tracking-tight
              text-white
            "
          >
            {favourite.card.name}
          </h3>

          <p
            className="
              mt-2
              font-semibold
              text-white/40
            "
          >
            {favourite.card.setName}

            {favourite.card.cardNumber
              ? ` - #${favourite.card.cardNumber}`
              : ""}
          </p>

          <div
            className="
              mt-5
              flex
              flex-wrap
              gap-2
            "
          >
            <span
              className="
                rounded-full
                border
                border-violet-200/20
                bg-violet-300/10
                px-3
                py-1.5
                text-xs
                font-black
                text-violet-100
              "
            >
              {favourite.card.rarity}
            </span>

            <span
              className="
                rounded-full
                border
                border-emerald-200/20
                bg-emerald-300/10
                px-3
                py-1.5
                text-xs
                font-black
                text-emerald-100
              "
            >
              {formatCurrency(
                favourite.card
                  .marketValue,
              )}
            </span>
          </div>

          <p
            className="
              mt-5
              text-xs
              font-semibold
              text-white/25
            "
          >
            Chosen{" "}
            {formatDate(
              favourite.updatedAt,
            )}
          </p>

          {isViewer && (
            <p
              className="
                mt-3
                text-xs
                font-black
                text-amber-100/50
              "
            >
              Only your account can replace this card.
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

export function FounderFavouriteButton({
  cardId,
  cardName,
}: FounderFavouriteButtonProps) {
  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [failed, setFailed] =
    useState(false);

  async function saveFavourite() {
    if (saving) {
      return;
    }

    const resolvedCardId =
      normaliseIdentifier(
        cardId,
      );

    if (!resolvedCardId) {
      setFailed(true);

      setMessage(
        "Invalid card ID",
      );

      return;
    }

    setSaving(true);
    setFailed(false);
    setMessage("");

    try {
      const request =
        await authenticatedFetch(
          "/api/founder-favourites",
          {
            method: "POST",

            body:
              JSON.stringify({
                cardId:
                  resolvedCardId,
              }),
          },
        );

      const payload =
        (await request.json()) as FavouritesResponse;

      if (
        !request.ok ||
        !payload.success
      ) {
        throw new Error(
          payload.error ||
            "The favourite could not be saved.",
        );
      }

      const owner =
        payload.viewerOwner;

      const founderName =
        owner === "lukas"
          ? "Lukas"
          : owner === "skye"
            ? "Skye"
            : "Founder";

      setMessage(
        `${founderName}'s favourite`,
      );

      window.dispatchEvent(
        new Event(
          FAVOURITE_CHANGED_EVENT,
        ),
      );

      window.setTimeout(() => {
        setMessage("");
      }, 4000);
    } catch (
      saveError: unknown
    ) {
      console.error(
        "Favourite update error:",
        saveError,
      );

      setFailed(true);

      setMessage(
        saveError instanceof Error
          ? saveError.message
          : "Could not save favourite",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() =>
          void saveFavourite()
        }
        disabled={saving}
        title={`Set ${cardName} as your founder favourite`}
        className="
          mt-2
          rounded-lg
          border
          border-amber-200/15
          bg-amber-300/[0.07]
          px-3
          py-1.5
          text-xs
          font-black
          text-amber-100/70
          transition
          hover:border-amber-200/35
          hover:bg-amber-300/15
          hover:text-amber-100
          disabled:cursor-not-allowed
          disabled:opacity-50
        "
      >
        {saving
          ? "Saving..."
          : "Set as my favourite"}
      </button>

      {message && (
        <p
          className={`
            mt-2
            max-w-48
            text-[0.65rem]
            font-black
            leading-4
            ${
              failed
                ? "text-red-200"
                : "text-emerald-200"
            }
          `}
        >
          {message}
        </p>
      )}
    </div>
  );
}

function FavouriteSkeleton() {
  return (
    <div
      className="
        min-h-72
        animate-pulse
        rounded-[2rem]
        border
        border-white/10
        bg-white/[0.04]
      "
    />
  );
}