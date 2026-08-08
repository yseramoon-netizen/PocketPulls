export const SHAYMIN_MOOD_KEYS = [
  "gentle",
  "eager",
  "zoomies",
  "content",
  "joyful",
  "blooming",
  "playful",
  "curious",
  "surprised",
  "grumpy",
  "sad",
  "crying",
  "sleepy",
  "resting",
  "cheerful",
  "exploring",
  "determined",
  "shy",
] as const;

export type ShayminMoodKey =
  (typeof SHAYMIN_MOOD_KEYS)[number];

export type ShayminMotion =
  | "breathe"
  | "bounce"
  | "dash"
  | "sleep"
  | "settle"
  | "wiggle";

export type ShayminMoodDefinition = {
  key: ShayminMoodKey;
  label: string;
  shortLabel: string;
  whisper: string;
  image: string;
  aura: string;
  accent: string;
  motion: ShayminMotion;
};

export const SHAYMIN_MOODS: Record<
  ShayminMoodKey,
  ShayminMoodDefinition
> = {
  gentle: {
    key: "gentle",
    label: "Gentle garden heart",
    shortLabel: "Gentle",
    whisper:
      "The room feels safe, the leaves are soft, and Shaymin is happy simply being near you.",
    image: "/api/admin/shaymin-art/gentle",
    aura: "from-emerald-200/24 via-lime-100/14 to-cyan-100/10",
    accent: "#a7f3d0",
    motion: "breathe",
  },
  eager: {
    key: "eager",
    label: "Ready for the day",
    shortLabel: "Eager",
    whisper:
      "Those little paws are already moving. Shaymin has decided something lovely should happen next.",
    image: "/api/admin/shaymin-art/eager",
    aura: "from-lime-200/28 via-yellow-100/18 to-emerald-100/12",
    accent: "#bef264",
    motion: "bounce",
  },
  zoomies: {
    key: "zoomies",
    label: "Garden zoomies",
    shortLabel: "Zoomies",
    whisper:
      "A serious burst of tiny-footed speed is happening. The care room may never recover.",
    image: "/api/admin/shaymin-art/zoomies",
    aura: "from-sky-200/25 via-lime-100/18 to-emerald-100/12",
    accent: "#7dd3fc",
    motion: "dash",
  },
  content: {
    key: "content",
    label: "Softly content",
    shortLabel: "Content",
    whisper:
      "Warm paws, calm leaves and a quiet little smile. Everything is exactly where it should be.",
    image: "/api/admin/shaymin-art/content",
    aura: "from-emerald-200/24 via-lime-100/12 to-cyan-100/12",
    accent: "#86efac",
    motion: "settle",
  },
  joyful: {
    key: "joyful",
    label: "Bright as morning",
    shortLabel: "Joyful",
    whisper:
      "Shaymin is glowing with the kind of happiness that makes the whole room feel lighter.",
    image: "/api/admin/shaymin-art/joyful",
    aura: "from-yellow-100/25 via-lime-100/18 to-pink-100/12",
    accent: "#fde68a",
    motion: "bounce",
  },
  blooming: {
    key: "blooming",
    label: "Petal-perfect joy",
    shortLabel: "Blooming",
    whisper:
      "Every flower is open at once. Something kind has made the little garden guardian feel completely loved.",
    image: "/api/admin/shaymin-art/blooming",
    aura: "from-pink-200/30 via-lime-100/16 to-yellow-100/15",
    accent: "#f9a8d4",
    motion: "breathe",
  },
  playful: {
    key: "playful",
    label: "Mischief in the leaves",
    shortLabel: "Playful",
    whisper:
      "That wink means a game has already started, whether either keeper noticed or not.",
    image: "/api/admin/shaymin-art/playful",
    aura: "from-pink-200/22 via-lime-100/16 to-cyan-100/12",
    accent: "#f9a8d4",
    motion: "wiggle",
  },
  curious: {
    key: "curious",
    label: "Full of questions",
    shortLabel: "Curious",
    whisper:
      "Shaymin has heard something interesting and would now like the complete story, please.",
    image: "/api/admin/shaymin-art/curious",
    aura: "from-cyan-200/22 via-emerald-100/14 to-yellow-100/12",
    accent: "#67e8f9",
    motion: "breathe",
  },
  surprised: {
    key: "surprised",
    label: "Little leaf surprise",
    shortLabel: "Surprised",
    whisper:
      "One tiny gasp, four frozen paws and a flower that was absolutely not prepared for that.",
    image: "/api/admin/shaymin-art/surprised",
    aura: "from-orange-200/24 via-yellow-100/16 to-pink-100/12",
    accent: "#fdba74",
    motion: "bounce",
  },
  grumpy: {
    key: "grumpy",
    label: "Leafy little huff",
    shortLabel: "Grumpy",
    whisper:
      "The expression is dramatic. The problem is probably solvable with attention, a brush or a snack.",
    image: "/api/admin/shaymin-art/grumpy",
    aura: "from-amber-200/20 via-rose-100/12 to-emerald-100/10",
    accent: "#fbbf24",
    motion: "wiggle",
  },
  sad: {
    key: "sad",
    label: "Needs a gentle moment",
    shortLabel: "Sad",
    whisper:
      "Nothing is broken. Shaymin just wants one of its keepers to stay close for a little while.",
    image: "/api/admin/shaymin-art/sad",
    aura: "from-sky-200/20 via-violet-200/12 to-emerald-100/10",
    accent: "#93c5fd",
    motion: "settle",
  },
  crying: {
    key: "crying",
    label: "Big tiny feelings",
    shortLabel: "Crying",
    whisper:
      "The feelings have become much larger than the Pokémon. A calm care action will help them pass.",
    image: "/api/admin/shaymin-art/crying",
    aura: "from-blue-200/24 via-violet-200/14 to-pink-100/10",
    accent: "#bfdbfe",
    motion: "settle",
  },
  sleepy: {
    key: "sleepy",
    label: "Sleepy sprout",
    shortLabel: "Sleepy",
    whisper:
      "The leaves are folding in and the paws have found the softest possible place to rest.",
    image: "/api/admin/shaymin-art/sleepy",
    aura: "from-indigo-200/24 via-violet-200/12 to-emerald-100/10",
    accent: "#c4b5fd",
    motion: "sleep",
  },
  resting: {
    key: "resting",
    label: "Resting among flowers",
    shortLabel: "Resting",
    whisper:
      "A proper little garden nap is underway. Even the flowers are trying not to make a sound.",
    image: "/api/admin/shaymin-art/resting",
    aura: "from-pink-200/18 via-emerald-100/16 to-violet-100/12",
    accent: "#fbcfe8",
    motion: "sleep",
  },
  cheerful: {
    key: "cheerful",
    label: "Happy little steps",
    shortLabel: "Cheerful",
    whisper:
      "The tail is up, the smile is ready and the next care moment already looks promising.",
    image: "/api/admin/shaymin-art/cheerful",
    aura: "from-lime-200/26 via-sky-100/15 to-yellow-100/14",
    accent: "#bef264",
    motion: "bounce",
  },
  exploring: {
    key: "exploring",
    label: "Following the leaves",
    shortLabel: "Exploring",
    whisper:
      "Something interesting passed through the room. Shaymin is carefully investigating every last leaf.",
    image: "/api/admin/shaymin-art/exploring",
    aura: "from-emerald-200/25 via-cyan-100/12 to-lime-100/16",
    accent: "#6ee7b7",
    motion: "breathe",
  },
  determined: {
    key: "determined",
    label: "Tiny guardian focus",
    shortLabel: "Determined",
    whisper:
      "The little garden guardian has chosen a mission and is now taking it extremely seriously.",
    image: "/api/admin/shaymin-art/determined",
    aura: "from-lime-200/24 via-amber-100/14 to-emerald-100/12",
    accent: "#d9f99d",
    motion: "dash",
  },
  shy: {
    key: "shy",
    label: "Quietly hiding",
    shortLabel: "Shy",
    whisper:
      "Shaymin is still listening. A soft word or gentle pat will make it turn back around when it is ready.",
    image: "/api/admin/shaymin-art/shy",
    aura: "from-violet-200/18 via-emerald-100/12 to-slate-100/8",
    accent: "#d8b4fe",
    motion: "settle",
  },
};

export const SHAYMIN_MOOD_LIST =
  SHAYMIN_MOOD_KEYS.map((key) => SHAYMIN_MOODS[key]);

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
    detail: "A proper treat for a very good garden guardian.",
    icon: "🍪",
    effect: "+12 fullness · +7 affection · +3 comfort",
  },
  tea: {
    key: "tea",
    label: "Herbal Tea",
    detail: "Warm leaves, calm paws and a little more energy.",
    icon: "🍵",
    effect: "+6 fullness · +14 comfort · +5 energy",
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
