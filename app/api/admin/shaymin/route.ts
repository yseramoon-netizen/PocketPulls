import {
  adminErrorResponse,
  requireAdmin,
  type ServerAdminClient,
} from "@/lib/admin/server-auth";
import {
  loadGrowthSnapshot,
  type GrowthSnapshot,
} from "@/lib/admin/growth";
import {
  getShayminMood,
  isShayminActionKey,
  isShayminSnackKey,
  type ShayminActionKey,
  type ShayminMoodKey,
  type ShayminSnackKey,
} from "@/lib/admin/shaymin-care";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type UnknownRow = Record<string, unknown>;

type CareState = {
  affection: number;
  fullness: number;
  energy: number;
  comfort: number;
  lastAction: string;
  lastItem: string;
  lastActorName: string;
  lastActorEmail: string;
  lastActionAt: string | null;
  updatedAt: string | null;
};

type CareEvent = {
  id: string;
  action: ShayminActionKey;
  item: string;
  note: string;
  actorName: string;
  actorEmail: string;
  affectionDelta: number;
  fullnessDelta: number;
  energyDelta: number;
  comfortDelta: number;
  createdAt: string;
};

type CareRpcRow = {
  affection?: unknown;
  fullness?: unknown;
  energy?: unknown;
  comfort?: unknown;
  last_action?: unknown;
  last_item?: unknown;
  last_actor_name?: unknown;
  last_actor_email?: unknown;
  last_action_at?: unknown;
  updated_at?: unknown;
};

type EventRow = {
  id?: unknown;
  action?: unknown;
  item?: unknown;
  note?: unknown;
  actor_name?: unknown;
  actor_email?: unknown;
  affection_delta?: unknown;
  fullness_delta?: unknown;
  energy_delta?: unknown;
  comfort_delta?: unknown;
  created_at?: unknown;
};

type RpcClient = {
  rpc(
    name: string,
    parameters?: Record<string, unknown>,
  ): Promise<{
    data: unknown;
    error: unknown;
  }>;
};

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampStat(value: unknown): number {
  return Math.max(
    0,
    Math.min(100, Math.round(numberValue(value))),
  );
}

function textValue(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function dateValue(value: unknown): string | null {
  const text = textValue(value);

  if (!text) {
    return null;
  }

  const time = new Date(text).getTime();
  return Number.isFinite(time) ? text : null;
}

function asRow(value: unknown): UnknownRow | null {
  return typeof value === "object" && value !== null
    ? (value as UnknownRow)
    : null;
}

function firstRow(value: unknown): UnknownRow | null {
  if (Array.isArray(value)) {
    return asRow(value[0]);
  }

  return asRow(value);
}

function viewerName(email: string): string {
  const normalised = email.toLowerCase();

  if (
    normalised === "pullspocket@gmail.com" ||
    normalised.includes("lukas")
  ) {
    return "Lukas";
  }

  if (normalised.includes("skye")) {
    return "Skye";
  }

  const prefix = normalised
    .split("@")[0]
    ?.replace(/[._-]+/g, " ")
    .trim();

  return prefix
    ? prefix.replace(/\b\w/g, (letter) =>
        letter.toUpperCase(),
      )
    : "Keeper";
}

function parseState(value: unknown): CareState {
  const raw = firstRow(value) as CareRpcRow | null;

  return {
    affection: clampStat(raw?.affection ?? 60),
    fullness: clampStat(raw?.fullness ?? 70),
    energy: clampStat(raw?.energy ?? 75),
    comfort: clampStat(raw?.comfort ?? 80),
    lastAction: textValue(raw?.last_action),
    lastItem: textValue(raw?.last_item),
    lastActorName: textValue(raw?.last_actor_name),
    lastActorEmail: textValue(raw?.last_actor_email),
    lastActionAt: dateValue(raw?.last_action_at),
    updatedAt: dateValue(raw?.updated_at),
  };
}

function parseEvent(value: unknown): CareEvent | null {
  const raw = asRow(value) as EventRow | null;

  if (!raw) {
    return null;
  }

  const action = textValue(raw.action);
  const createdAt = dateValue(raw.created_at);

  if (!isShayminActionKey(action) || !createdAt) {
    return null;
  }

  return {
    id: textValue(raw.id) || crypto.randomUUID(),
    action,
    item: textValue(raw.item),
    note: textValue(raw.note),
    actorName: textValue(raw.actor_name) || "Keeper",
    actorEmail: textValue(raw.actor_email),
    affectionDelta: numberValue(raw.affection_delta),
    fullnessDelta: numberValue(raw.fullness_delta),
    energyDelta: numberValue(raw.energy_delta),
    comfortDelta: numberValue(raw.comfort_delta),
    createdAt,
  };
}

async function callRpc(
  admin: ServerAdminClient,
  name: string,
  parameters: Record<string, unknown> = {},
): Promise<unknown> {
  const result = await (
    admin as unknown as RpcClient
  ).rpc(name, parameters);

  if (result.error) {
    throw result.error;
  }

  return result.data;
}

async function refreshState(
  admin: ServerAdminClient,
): Promise<CareState> {
  const data = await callRpc(
    admin,
    "refresh_shaymin_care_state",
  );

  return parseState(data);
}

async function loadRecentEvents(
  admin: ServerAdminClient,
): Promise<CareEvent[]> {
  const result = await (
    admin.from("shaymin_care_events") as any
  )
    .select(
      [
        "id",
        "action",
        "item",
        "note",
        "actor_name",
        "actor_email",
        "affection_delta",
        "fullness_delta",
        "energy_delta",
        "comfort_delta",
        "created_at",
      ].join(","),
    )
    .order("created_at", {
      ascending: false,
    })
    .limit(1000);

  if (result.error) {
    throw result.error;
  }

  return Array.isArray(result.data)
    ? result.data
        .map((row: unknown) => parseEvent(row))
        .filter(
          (row: CareEvent | null): row is CareEvent =>
            row !== null,
        )
    : [];
}


async function loadTotalCareCount(
  admin: ServerAdminClient,
): Promise<number> {
  try {
    const result = await (
      admin.from("shaymin_care_events") as any
    ).select("id", {
      count: "exact",
      head: true,
    });

    if (result.error) {
      throw result.error;
    }

    return Math.max(
      0,
      Math.round(numberValue(result.count)),
    );
  } catch (error: unknown) {
    console.warn(
      "Total Shaymin care count unavailable:",
      error,
    );
    return 0;
  }
}

function localDateKey(timestamp: string): string {
  const date = new Date(timestamp);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = new Map(
    parts.map((part) => [part.type, part.value]),
  );

  return [
    values.get("year") || "0000",
    values.get("month") || "00",
    values.get("day") || "00",
  ].join("-");
}

function londonHour(): number {
  const value = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : new Date().getHours();
}

function todayKey(): string {
  return localDateKey(new Date().toISOString());
}

function careStreak(events: CareEvent[]): number {
  const activeDays = new Set(
    events.map((event) => localDateKey(event.createdAt)),
  );

  let streak = 0;
  const cursor = new Date();

  for (let index = 0; index < 365; index += 1) {
    const key = [
      cursor.getFullYear(),
      String(cursor.getMonth() + 1).padStart(2, "0"),
      String(cursor.getDate()).padStart(2, "0"),
    ].join("-");

    if (!activeDays.has(key)) {
      if (index === 0) {
        cursor.setDate(cursor.getDate() - 1);
        continue;
      }

      break;
    }

    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function keeperIdentity(event: CareEvent): string {
  const combined = `${event.actorName} ${event.actorEmail}`.toLowerCase();

  if (
    combined.includes("lukas") ||
    combined.includes("pullspocket")
  ) {
    return "lukas";
  }

  if (combined.includes("skye")) {
    return "skye";
  }

  return event.actorEmail || event.actorName.toLowerCase();
}

function favouriteSnack(
  events: CareEvent[],
): ShayminSnackKey | null {
  const counts: Record<ShayminSnackKey, number> = {
    berry: 0,
    poffin: 0,
    tea: 0,
  };

  for (const event of events) {
    if (
      event.action === "feed" &&
      isShayminSnackKey(event.item)
    ) {
      counts[event.item] += 1;
    }
  }

  const entries = Object.entries(counts) as Array<
    [ShayminSnackKey, number]
  >;

  entries.sort(
    (first, second) => second[1] - first[1],
  );

  return entries[0]?.[1] > 0 ? entries[0][0] : null;
}

function minutesSince(timestamp: string | null): number {
  if (!timestamp) {
    return Number.POSITIVE_INFINITY;
  }

  const time = new Date(timestamp).getTime();

  return Number.isFinite(time)
    ? Math.max(0, (Date.now() - time) / 60_000)
    : Number.POSITIVE_INFINITY;
}

function deriveMood(
  state: CareState,
  events: CareEvent[],
  tree: GrowthSnapshot,
): {
  key: ShayminMoodKey;
  reason: string;
} {
  const hour = londonHour();
  const recent = events[0] || null;
  const recentMinutes = minutesSince(
    recent?.createdAt || state.lastActionAt,
  );
  const today = todayKey();
  const todayKeepers = new Set(
    events
      .filter(
        (event) => localDateKey(event.createdAt) === today,
      )
      .map(keeperIdentity),
  );
  const bothCaredToday =
    todayKeepers.has("lukas") &&
    todayKeepers.has("skye");

  if (tree.growthScore >= 1_000_000) {
    return {
      key: "golden",
      reason:
        "PocketPulls has crossed the million-growth promise milestone.",
    };
  }

  if (recent && recentMinutes <= 12) {
    if (recent.action === "feed") {
      return {
        key: "snacking",
        reason: `${recent.actorName} brought a snack a moment ago.`,
      };
    }

    if (recent.action === "play") {
      return {
        key: "playful",
        reason: `${recent.actorName} started a game.`,
      };
    }

    if (recent.action === "nap") {
      return {
        key: "sleepy",
        reason: `${recent.actorName} tucked the little garden guardian in.`,
      };
    }

    if (recent.action === "cheer") {
      const key =
        recent.item === "skye" ? "skye" : "lukas";

      return {
        key,
        reason: `${recent.actorName} called for a keeper-on-duty outfit.`,
      };
    }

    if (
      recent.action === "pat" ||
      recent.action === "boop"
    ) {
      return {
        key: bothCaredToday ? "together" : "joyful",
        reason: `${recent.actorName} gave a little affection.`,
      };
    }

    if (
      recent.action === "groom" ||
      recent.action === "talk"
    ) {
      return {
        key: bothCaredToday ? "together" : "content",
        reason: `${recent.actorName} spent a quiet moment here.`,
      };
    }
  }

  if (bothCaredToday) {
    return {
      key: "together",
      reason:
        "Both keeper branches have visited the care room today.",
    };
  }

  if (
    state.energy <= 26 ||
    hour < 6 ||
    hour >= 23
  ) {
    return {
      key: "sleepy",
      reason: "The day has become quiet and the leaves are getting heavy.",
    };
  }

  if (state.fullness <= 30) {
    return {
      key: "hungry",
      reason: "The snack meter is low enough to earn some very hopeful eyes.",
    };
  }

  if (
    state.comfort <= 32 ||
    state.affection <= 30
  ) {
    return {
      key: "worried",
      reason: "A gentle pat, brush or conversation would help.",
    };
  }

  if (tree.wishesToday > 0) {
    return {
      key: "celebrating",
      reason: `${tree.wishesToday} wish${tree.wishesToday === 1 ? "" : "es"} found a home today.`,
    };
  }

  if (hour >= 6 && hour < 10) {
    return {
      key: "joyful",
      reason: "Morning light has reached the care room.",
    };
  }

  return {
    key: "content",
    reason: "Every care meter is settled and the garden feels safe.",
  };
}

function bondDetails(
  state: CareState,
  totalCare: number,
): {
  level: number;
  title: string;
  progress: number;
} {
  const score =
    state.affection * 3 +
    state.comfort * 2 +
    Math.min(500, totalCare * 2);
  const level = Math.max(
    1,
    Math.min(25, Math.floor(score / 40) + 1),
  );
  const progress = Math.max(
    0,
    Math.min(100, Math.round((score % 40) * 2.5)),
  );

  const title =
    level >= 25
      ? "Forever garden family"
      : level >= 18
        ? "Heart-bloom keepers"
        : level >= 12
          ? "Trusted garden family"
          : level >= 7
            ? "Favourite keepers"
            : level >= 3
              ? "Gentle friends"
              : "Newly acquainted";

  return {
    level,
    title,
    progress,
  };
}

function dailySecret(
  state: CareState,
  tree: GrowthSnapshot,
  bothCaredToday: boolean,
): string {
  const messages = [
    "A tiny pink petal has been hidden behind the left flower.",
    "The warmest patch of moss has been reserved for both keepers.",
    "Someone tried to count every card in the roots and fell asleep at seven.",
    "The care room keeps one little light on until both of you are safely home.",
    "A berry has been placed beside the L and S carving for later.",
    "Today the leaves are leaning toward whichever keeper arrives next.",
    "The smallest flower in the room only opens after a kind word.",
  ];
  const day = Math.floor(Date.now() / 86_400_000);
  const seed =
    day +
    state.affection +
    state.comfort +
    tree.growthScore +
    (bothCaredToday ? 13 : 0);

  return messages[Math.abs(seed) % messages.length];
}

async function buildResponse(
  admin: ServerAdminClient,
  email: string,
) {
  const [state, events, tree, exactTotalCare] = await Promise.all([
    refreshState(admin),
    loadRecentEvents(admin),
    loadGrowthSnapshot(admin),
    loadTotalCareCount(admin),
  ]);
  const today = todayKey();
  const todayEvents = events.filter(
    (event) => localDateKey(event.createdAt) === today,
  );
  const todayKeepers = new Set(
    todayEvents.map(keeperIdentity),
  );
  const bothCaredToday =
    todayKeepers.has("lukas") &&
    todayKeepers.has("skye");
  const moodResult = deriveMood(state, events, tree);
  const mood = getShayminMood(moodResult.key);
  const totalCare = Math.max(
    exactTotalCare,
    events.length,
  );
  const bond = bondDetails(state, totalCare);

  return {
    ok: true as const,
    viewer: {
      email,
      name: viewerName(email),
    },
    mood: {
      ...mood,
      reason: moodResult.reason,
    },
    state,
    summary: {
      totalCare,
      todayCareCount: todayEvents.length,
      careStreak: careStreak(events),
      bothCaredToday,
      favouriteSnack: favouriteSnack(events),
      bondLevel: bond.level,
      bondTitle: bond.title,
      bondProgress: bond.progress,
      dailySecret: dailySecret(
        state,
        tree,
        bothCaredToday,
      ),
    },
    recentEvents: events.slice(0, 14),
    tree: {
      growthScore: tree.growthScore,
      wishesToday: tree.wishesToday,
      cardsPlantedToday: tree.cardsPlantedToday,
      bothActiveThisWeek: tree.bothActiveThisWeek,
    },
  };
}

function migrationRequiredResponse() {
  return Response.json(
    {
      ok: false,
      error: {
        code: "shaymin_care_migration_required",
        message:
          "Run the V11 Shaymin care SQL migration in Supabase, then reload this page.",
      },
    },
    {
      status: 409,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function looksLikeMissingMigration(error: unknown): boolean {
  const text =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error);

  return /refresh_shaymin_care_state|care_for_shaymin|shaymin_care_state|shaymin_care_events|PGRST202|42883|42P01/i.test(
    text,
  );
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
    if (looksLikeMissingMigration(error)) {
      return migrationRequiredResponse();
    }

    return adminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { admin, email } =
      await requireAdmin(request);
    const body = (await request.json()) as {
      action?: unknown;
      item?: unknown;
      note?: unknown;
    };

    if (!isShayminActionKey(body.action)) {
      return Response.json(
        {
          ok: false,
          error: {
            code: "invalid_shaymin_action",
            message: "Choose a recognised care action.",
          },
        },
        { status: 400 },
      );
    }

    const action = body.action;
    const item = textValue(body.item).slice(0, 32);
    const note = textValue(body.note).slice(0, 180);

    if (
      action === "feed" &&
      !isShayminSnackKey(item)
    ) {
      return Response.json(
        {
          ok: false,
          error: {
            code: "invalid_shaymin_snack",
            message: "Choose a snack from the shared tray.",
          },
        },
        { status: 400 },
      );
    }

    if (action === "talk" && !note) {
      return Response.json(
        {
          ok: false,
          error: {
            code: "shaymin_note_required",
            message: "Write a tiny note before sharing it.",
          },
        },
        { status: 400 },
      );
    }

    await callRpc(
      admin,
      "care_for_shaymin",
      {
        p_action: action,
        p_item: item || null,
        p_note: note || null,
        p_actor_email: email,
        p_actor_name: viewerName(email),
      },
    );

    return Response.json(
      await buildResponse(admin, email),
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error: unknown) {
    if (looksLikeMissingMigration(error)) {
      return migrationRequiredResponse();
    }

    return adminErrorResponse(error);
  }
}
