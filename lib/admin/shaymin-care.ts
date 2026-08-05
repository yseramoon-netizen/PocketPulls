export const SHAYMIN_MOOD_KEYS = [
  "sleepy",
  "joyful",
  "content",
  "hungry",
  "worried",
  "snacking",
  "playful",
  "celebrating",
  "together",
  "lukas",
  "skye",
  "golden",
] as const;

export type ShayminMoodKey =
  (typeof SHAYMIN_MOOD_KEYS)[number];

export type ShayminMoodDefinition = {
  key: ShayminMoodKey;
  label: string;
  whisper: string;
  image: string;
  aura: string;
  accent: string;
};

export const SHAYMIN_MOODS: Record<
  ShayminMoodKey,
  ShayminMoodDefinition
> = {
  sleepy: {
    key: "sleepy",
    label: "Sleepy sprout",
    whisper:
      "The little leaves are folding in. A quiet nap would be lovely.",
    image: "/shaymin-care/sleepy.png",
    aura: "from-indigo-200/24 via-violet-200/12 to-emerald-100/10",
    accent: "#c4b5fd",
  },
  joyful: {
    key: "joyful",
    label: "Bright as morning",
    whisper:
      "Everything feels light today. Shaymin is practically sparkling.",
    image: "/shaymin-care/joyful.png",
    aura: "from-sky-200/28 via-lime-100/16 to-yellow-100/20",
    accent: "#bae6fd",
  },
  content: {
    key: "content",
    label: "Softly content",
    whisper:
      "The garden is calm, the paws are warm, and all is well.",
    image: "/shaymin-care/content.png",
    aura: "from-emerald-200/24 via-lime-100/12 to-cyan-100/12",
    accent: "#a7f3d0",
  },
  hungry: {
    key: "hungry",
    label: "Snack thoughts",
    whisper:
      "Those eyes are definitely following the berry tray.",
    image: "/shaymin-care/hungry.png",
    aura: "from-amber-200/24 via-orange-100/12 to-emerald-100/10",
    accent: "#fde68a",
  },
  worried: {
    key: "worried",
    label: "Needs a little care",
    whisper:
      "Nothing is wrong. Shaymin just wants a gentle moment with one of you.",
    image: "/shaymin-care/worried.png",
    aura: "from-violet-200/20 via-sky-200/12 to-emerald-100/10",
    accent: "#c4b5fd",
  },
  snacking: {
    key: "snacking",
    label: "Happy little bites",
    whisper:
      "A very serious snack inspection is currently underway.",
    image: "/shaymin-care/snacking.png",
    aura: "from-lime-200/26 via-yellow-100/16 to-emerald-100/12",
    accent: "#bef264",
  },
  playful: {
    key: "playful",
    label: "Mischief in the leaves",
    whisper:
      "That wink means a game has already started, whether you noticed or not.",
    image: "/shaymin-care/playful.png",
    aura: "from-pink-200/22 via-lime-100/16 to-cyan-100/12",
    accent: "#f9a8d4",
  },
  celebrating: {
    key: "celebrating",
    label: "Petal celebration",
    whisper:
      "Something good happened. The petals have decided everyone should know.",
    image: "/shaymin-care/celebrating.png",
    aura: "from-pink-200/28 via-yellow-100/18 to-emerald-100/12",
    accent: "#fbcfe8",
  },
  together: {
    key: "together",
    label: "Both keepers are here",
    whisper:
      "Two people, one tiny garden guardian, and a very full heart.",
    image: "/shaymin-care/together.png",
    aura: "from-pink-200/24 via-emerald-100/18 to-cyan-100/12",
    accent: "#f9a8d4",
  },
  lukas: {
    key: "lukas",
    label: "Lukas on duty",
    whisper:
      "Cape secured. Leaves ready. The left branch has a hero today.",
    image: "/shaymin-care/lukas.png",
    aura: "from-sky-200/28 via-yellow-100/16 to-emerald-100/12",
    accent: "#7dd3fc",
  },
  skye: {
    key: "skye",
    label: "Skye on duty",
    whisper:
      "The right branch is glowing. Shaymin dressed up for the occasion.",
    image: "/shaymin-care/skye.png",
    aura: "from-violet-200/26 via-pink-100/16 to-cyan-100/12",
    accent: "#d8b4fe",
  },
  golden: {
    key: "golden",
    label: "Golden promise",
    whisper:
      "A rare light has reached the garden. This one is worth remembering.",
    image: "/shaymin-care/golden.png",
    aura: "from-yellow-100/38 via-amber-200/24 to-emerald-100/12",
    accent: "#fde68a",
  },
};

export const SHAYMIN_ACTION_KEYS = [
  "pat",
  "feed",
  "play",
  "groom",
  "nap",
  "talk",
  "boop",
  "cheer",
] as const;

export type ShayminActionKey =
  (typeof SHAYMIN_ACTION_KEYS)[number];

export const SHAYMIN_SNACK_KEYS = [
  "berry",
  "poffin",
  "tea",
] as const;

export type ShayminSnackKey =
  (typeof SHAYMIN_SNACK_KEYS)[number];

export type ShayminSnackDefinition = {
  key: ShayminSnackKey;
  label: string;
  detail: string;
  icon: string;
  effect: string;
};

export const SHAYMIN_SNACKS: Record<
  ShayminSnackKey,
  ShayminSnackDefinition
> = {
  berry: {
    key: "berry",
    label: "Lum Berry",
    detail: "Fresh, bright and reliably loved.",
    icon: "🫐",
    effect: "+18 fullness · +2 affection",
  },
  poffin: {
    key: "poffin",
    label: "Soft Poffin",
    detail: "A proper treat for very good garden guardians.",
    icon: "🍪",
    effect: "+12 fullness · +7 affection",
  },
  tea: {
    key: "tea",
    label: "Herbal Tea",
    detail: "Warm leaves, calm paws and a little more energy.",
    icon: "🍵",
    effect: "+14 comfort · +5 energy",
  },
};

export function isShayminMoodKey(
  value: unknown,
): value is ShayminMoodKey {
  return (
    typeof value === "string" &&
    (SHAYMIN_MOOD_KEYS as readonly string[]).includes(
      value,
    )
  );
}

export function isShayminActionKey(
  value: unknown,
): value is ShayminActionKey {
  return (
    typeof value === "string" &&
    (SHAYMIN_ACTION_KEYS as readonly string[]).includes(
      value,
    )
  );
}

export function isShayminSnackKey(
  value: unknown,
): value is ShayminSnackKey {
  return (
    typeof value === "string" &&
    (SHAYMIN_SNACK_KEYS as readonly string[]).includes(
      value,
    )
  );
}

export function getShayminMood(
  value: unknown,
): ShayminMoodDefinition {
  return isShayminMoodKey(value)
    ? SHAYMIN_MOODS[value]
    : SHAYMIN_MOODS.content;
}
