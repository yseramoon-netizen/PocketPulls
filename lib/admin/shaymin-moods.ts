export const SHAYMIN_MOOD_KEYS = [
  "morning",
  "content",
  "busy",
  "gardener",
  "proud",
  "worried",
  "celebration",
  "sleeping",
  "seed",
  "golden",
  "together",
  "lukas",
  "skye",
] as const;

export type ShayminMoodKey =
  (typeof SHAYMIN_MOOD_KEYS)[number];

export type ShayminMoodDefinition = {
  key: ShayminMoodKey;
  label: string;
  whisper: string;
  image: string;
  aura: string;
};

export const SHAYMIN_MOODS: Record<
  ShayminMoodKey,
  ShayminMoodDefinition
> = {
  morning: {
    key: "morning",
    label: "Morning dew",
    whisper: "The first leaves are opening. Let us make today gentle and useful.",
    image: "/shaymin-moods/morning.png",
    aura: "from-sky-200/25 via-emerald-200/12 to-yellow-100/20",
  },
  content: {
    key: "content",
    label: "Content",
    whisper: "The forest is steady. Small careful work is still growth.",
    image: "/shaymin-moods/content.png",
    aura: "from-emerald-200/24 via-lime-200/10 to-cyan-100/14",
  },
  busy: {
    key: "busy",
    label: "Busy paws",
    whisper: "There are cards to plant and wishes to prepare. Shaymin is helping.",
    image: "/shaymin-moods/busy.png",
    aura: "from-cyan-200/24 via-emerald-200/12 to-violet-200/14",
  },
  gardener: {
    key: "gardener",
    label: "Garden keeper",
    whisper: "Every card added is another seed beneath your shared canopy.",
    image: "/shaymin-moods/gardener.png",
    aura: "from-lime-200/28 via-emerald-200/14 to-amber-100/12",
  },
  proud: {
    key: "proud",
    label: "Proud",
    whisper: "Look at what you two have kept alive. Shaymin noticed all of it.",
    image: "/shaymin-moods/proud.png",
    aura: "from-yellow-200/24 via-lime-200/14 to-emerald-200/12",
  },
  worried: {
    key: "worried",
    label: "Needs a little care",
    whisper: "Nothing is broken. The garden is only asking for one small next step.",
    image: "/shaymin-moods/worried.png",
    aura: "from-violet-200/20 via-sky-200/12 to-emerald-200/10",
  },
  celebration: {
    key: "celebration",
    label: "Celebrating",
    whisper: "A wish found a home. The whole garden is throwing petals.",
    image: "/shaymin-moods/celebration.png",
    aura: "from-pink-200/24 via-yellow-200/18 to-emerald-200/14",
  },
  sleeping: {
    key: "sleeping",
    label: "Dreaming",
    whisper: "The roots keep growing while you rest. Tomorrow can wait until tomorrow.",
    image: "/shaymin-moods/sleeping.png",
    aura: "from-indigo-200/20 via-violet-200/14 to-cyan-100/10",
  },
  seed: {
    key: "seed",
    label: "New seed",
    whisper: "Great things begin quietly. This one belongs to both of you.",
    image: "/shaymin-moods/seed.png",
    aura: "from-amber-100/22 via-lime-200/14 to-emerald-200/12",
  },
  golden: {
    key: "golden",
    label: "Golden bloom",
    whisper: "A rare light has reached the canopy. Keep this moment.",
    image: "/shaymin-moods/golden.png",
    aura: "from-yellow-100/35 via-amber-200/22 to-emerald-200/12",
  },
  together: {
    key: "together",
    label: "Together",
    whisper: "Two keepers, one garden. Shaymin grows best when both of you are near.",
    image: "/shaymin-moods/together.png",
    aura: "from-pink-200/22 via-emerald-200/16 to-cyan-100/14",
  },
  lukas: {
    key: "lukas",
    label: "Lukas is here",
    whisper: "The left branch is awake. Shaymin saved you a place beside the roots.",
    image: "/shaymin-moods/lukas.png",
    aura: "from-emerald-200/24 via-cyan-200/12 to-yellow-100/12",
  },
  skye: {
    key: "skye",
    label: "Skye is here",
    whisper: "The right branch is awake. The flowers always lean a little closer.",
    image: "/shaymin-moods/skye.png",
    aura: "from-pink-200/22 via-violet-200/14 to-emerald-200/12",
  },
};

export function isShayminMoodKey(
  value: unknown,
): value is ShayminMoodKey {
  return (
    typeof value === "string" &&
    (SHAYMIN_MOOD_KEYS as readonly string[]).includes(value)
  );
}

export function getShayminMood(
  value: unknown,
): ShayminMoodDefinition {
  return isShayminMoodKey(value)
    ? SHAYMIN_MOODS[value]
    : SHAYMIN_MOODS.content;
}
