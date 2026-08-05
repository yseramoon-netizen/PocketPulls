import {
  adminErrorResponse,
  requireAdmin,
} from "@/lib/admin/server-auth";
import { loadGrowthSnapshot } from "@/lib/admin/growth";
import {
  getShayminMood,
  isShayminMoodKey,
  type ShayminMoodKey,
} from "@/lib/admin/shaymin-moods";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type MoodMode = "automatic" | "manual";

type MoodState = {
  mode: MoodMode;
  mood: ShayminMoodKey;
  note: string;
  updatedBy: string;
  updatedAt: string | null;
};

function textValue(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function viewerName(email: string): string {
  if (
    email === "pullspocket@gmail.com" ||
    email.includes("lukas")
  ) {
    return "Lukas";
  }

  if (email.includes("skye")) {
    return "Skye";
  }

  const prefix = email
    .split("@")[0]
    ?.replace(/[._-]+/g, " ")
    .trim();

  return prefix
    ? prefix.replace(/\b\w/g, (letter) =>
        letter.toUpperCase(),
      )
    : "Keeper";
}

function recommendedMood(
  tree: Awaited<ReturnType<typeof loadGrowthSnapshot>>,
): {
  key: ShayminMoodKey;
  reason: string;
} {
  const hour = new Date().getHours();
  const latest = tree.latestActivityAt
    ? new Date(tree.latestActivityAt).getTime()
    : 0;
  const minutesSinceActivity = latest
    ? (Date.now() - latest) / 60_000
    : Number.POSITIVE_INFINITY;

  if (hour < 6 || hour >= 23) {
    return {
      key: "sleeping",
      reason: "The garden has entered its quiet hours.",
    };
  }

  if (hour < 10) {
    return {
      key: "morning",
      reason: "Morning light has reached the leaves.",
    };
  }

  if (tree.wishesToday > 0) {
    return {
      key: "celebration",
      reason: `${tree.wishesToday} wish${tree.wishesToday === 1 ? "" : "es"} found a home today.`,
    };
  }

  if (tree.bothActiveThisWeek) {
    return {
      key: "together",
      reason: "Both of the tree's keeper branches have been active this week.",
    };
  }

  if (tree.growthScore >= 15000) {
    return {
      key: "golden",
      reason: "The garden has crossed a rare golden growth milestone.",
    };
  }

  if (tree.cardsPlantedToday >= 20) {
    return {
      key: "proud",
      reason: `${tree.cardsPlantedToday} cards were planted today.`,
    };
  }

  if (minutesSinceActivity <= 30) {
    return {
      key: "busy",
      reason: "The business has been active within the last half hour.",
    };
  }

  if (tree.stockCards <= 0) {
    return {
      key: "seed",
      reason: "The next chapter is waiting for its first new seed.",
    };
  }

  if (
    latest &&
    Date.now() - latest > 5 * 24 * 60 * 60 * 1000
  ) {
    return {
      key: "worried",
      reason: "The garden has been quiet for a few days and wants a little attention.",
    };
  }

  if (tree.stageIndex >= 3) {
    return {
      key: "gardener",
      reason: "The tree is established and asking for steady care.",
    };
  }

  return {
    key: "content",
    reason: "The forest is healthy and growing at a calm pace.",
  };
}

async function loadStoredMood(
  admin: any,
): Promise<MoodState | null> {
  try {
    const result = await admin
      .from("shaymin_mood_state")
      .select(
        "mode,mood,note,updated_by,updated_at",
      )
      .eq("id", 1)
      .maybeSingle();

    if (result.error || !result.data) {
      return null;
    }

    const mode: MoodMode =
      result.data.mode === "manual"
        ? "manual"
        : "automatic";

    const mood = isShayminMoodKey(
      result.data.mood,
    )
      ? result.data.mood
      : "content";

    return {
      mode,
      mood,
      note: textValue(result.data.note).slice(0, 180),
      updatedBy: textValue(result.data.updated_by),
      updatedAt: textValue(result.data.updated_at) || null,
    };
  } catch {
    return null;
  }
}

async function buildResponse(
  admin: any,
  email: string,
) {
  const tree = await loadGrowthSnapshot(admin);
  const stored = await loadStoredMood(admin);
  const recommended = recommendedMood(tree);
  const chosenKey =
    stored?.mode === "manual"
      ? stored.mood
      : recommended.key;
  const definition = getShayminMood(chosenKey);

  return {
    ok: true as const,
    viewer: {
      email,
      name: viewerName(email),
    },
    mood: {
      key: definition.key,
      label: definition.label,
      whisper: stored?.note || definition.whisper,
      reason:
        stored?.mode === "manual"
          ? `Chosen by ${stored.updatedBy || "one of the keepers"}.`
          : recommended.reason,
      mode: stored?.mode || "automatic",
      note: stored?.note || "",
      updatedBy: stored?.updatedBy || "",
      updatedAt: stored?.updatedAt || null,
      recommendedKey: recommended.key,
    },
    tree,
  };
}

export async function GET(request: Request) {
  try {
    const { admin, email } =
      await requireAdmin(request);

    return Response.json(
      await buildResponse(admin, email),
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error: unknown) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { admin, email } =
      await requireAdmin(request);

    const body = (await request.json()) as {
      mode?: unknown;
      mood?: unknown;
      note?: unknown;
    };

    const mode: MoodMode =
      body.mode === "manual"
        ? "manual"
        : "automatic";

    if (
      mode === "manual" &&
      !isShayminMoodKey(body.mood)
    ) {
      return Response.json(
        {
          ok: false,
          error: {
            code: "invalid_shaymin_mood",
            message: "Choose a recognised Shaymin mood.",
          },
        },
        { status: 400 },
      );
    }

    const note = textValue(body.note).slice(0, 180);
    const mood = isShayminMoodKey(body.mood)
      ? body.mood
      : "content";

    const result = await (
      admin.from("shaymin_mood_state") as any
    ).upsert(
      {
        id: 1,
        mode,
        mood,
        note,
        updated_by: viewerName(email),
        updated_by_email: email,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "id",
      },
    );

    if (result.error) {
      throw result.error;
    }

    return Response.json(
      await buildResponse(admin, email),
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error: unknown) {
    return adminErrorResponse(error);
  }
}
