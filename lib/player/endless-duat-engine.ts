export type Tab = "adventure" | "kingdom" | "relics" | "skins" | "forge";
export type Phase = "choice" | "combat" | "reward" | "event" | "defeat";
export type RoomKind =
  | "battle"
  | "elite"
  | "boss"
  | "vault"
  | "spring"
  | "mystery"
  | "altar";
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type SkinId =
  | "midnight"
  | "nile"
  | "lotus"
  | "scarab"
  | "sunstone"
  | "royal"
  | "pearl"
  | "sherry"
  | "bubbles"
  | "cosmic_nebu";
export type OathId = "wayfinder" | "ascendant" | "voidbound";
export type EnemyTrait = "armoured" | "frenzied" | "leeching" | "volatile";

export type Skin = {
  id: SkinId;
  name: string;
  title: string;
  icon: string;
  rarity: Rarity;
  family: string;
  description: string;
  passiveName: string;
  passive: string;
  burden: string;
  techniqueName: string;
  technique: string;
  accent: string;
  swatch: string;
  unlock: string;
  exclusive?: boolean;
};

export type Oath = {
  id: OathId;
  name: string;
  icon: string;
  description: string;
  enemyMultiplier: number;
  rewardMultiplier: number;
};

export type Resources = {
  dust: number;
  glyphs: number;
  flames: number;
  fragments: number;
  wishes: number;
};

export type Enemy = {
  name: string;
  icon: string;
  hp: number;
  maxHp: number;
  attack: number;
  elite: boolean;
  boss: boolean;
  trait: EnemyTrait | null;
  traitName: string | null;
  traitDescription: string | null;
  enraged: boolean;
  weakened: boolean;
  stunned: number;
};

export type BoonId =
  | "solar-claws"
  | "moon-ward"
  | "comet-heart"
  | "quick-paws"
  | "gold-whiskers"
  | "life-thread"
  | "pharaoh-curiosity"
  | "star-roar";

export type Boon = {
  id: BoonId;
  name: string;
  icon: string;
  family: "solar" | "lunar" | "cosmic";
  description: string;
  perLevel: string;
};

export type RouteChoice = {
  id: string;
  kind: RoomKind;
  eyebrow: string;
  title: string;
  description: string;
  danger: number;
  reward: string;
};

export type RunState = {
  phase: Phase;
  depth: number;
  maxDepth: number;
  hp: number;
  maxHp: number;
  attack: number;
  armor: number;
  enemy: Enemy | null;
  choices: RouteChoice[];
  skillReadyAt: number;
  guardReadyAt: number;
  guard: number;
  combo: number;
  discovery: string | null;
  boons: Record<BoonId, number>;
  pendingBoons: BoonId[];
  eventId: string | null;
  history: string[];
  oath: OathId;
  fate: number;
  fateSurge: boolean;
  chain: number;
  bestChain: number;
  skinReadyAt: number;
};

export type BuildingId =
  | "observatory"
  | "scarabWorks"
  | "moonGarden"
  | "sunTemple"
  | "sanctuary"
  | "pyramidGate";

export type GameState = {
  version: number;
  lastSeen: number;
  resources: Resources;
  run: RunState;
  buildings: Record<BuildingId, number>;
  relics: string[];
  eclipse: number;
  roomsCleared: number;
  enemiesDefeated: number;
  propheciesClaimed: string[];
  nextAdAt: number;
  selectedSkin: SkinId;
  ownedSkins: SkinId[];
  skinMastery: Record<SkinId, number>;
};

export type Relic = {
  id: string;
  name: string;
  icon: string;
  rarity: Rarity;
  description: string;
};

export const RELICS: Relic[] = [
  { id: "solar-fang", name: "Solar Fang", icon: "✦", rarity: "rare", description: "+18% expedition attack." },
  { id: "bastet-thread", name: "Thread of Bastet", icon: "⌁", rarity: "epic", description: "Solar Pounce cools down 25% faster." },
  { id: "scarab-heart", name: "Scarab Heart", icon: "◆", rarity: "uncommon", description: "+20% Stardust from every source." },
  { id: "moon-vessel", name: "Moon Vessel", icon: "☾", rarity: "rare", description: "+25% maximum vitality." },
  { id: "pharaoh-eye", name: "The Pharaoh's Eye", icon: "◉", rarity: "legendary", description: "Elite rooms always yield a Celestial Flame." },
  { id: "duat-map", name: "Impossible Map", icon: "⌘", rarity: "epic", description: "Mystery rooms can contain relics." },
  { id: "sun-disk", name: "Cracked Sun Disk", icon: "☼", rarity: "common", description: "+8% expedition attack." },
  { id: "star-bell", name: "Star Bell", icon: "◇", rarity: "uncommon", description: "+1 Ancient Glyph after every fifth room." },
  { id: "nebu-crown", name: "Nebu's First Crown", icon: "♛", rarity: "legendary", description: "All kingdom production is doubled." },
];

export const SKINS: Skin[] = [
  { id: "midnight", name: "Midnight Gold", title: "Nebu's Original Constellation", icon: "✦", rarity: "common", family: "Relic wayfinder", description: "The original navy, gold and turquoise Nebu coat from Ancient Pulls.", passiveName: "Curious Paws", passive: "+8% relic discovery and vaults grant 20% more Stardust.", burden: "No direct combat modifier.", techniqueName: "Guiding Star", technique: "Deal heavy damage and immediately gain two Starburst charges.", accent: "#45d7c8", swatch: "linear-gradient(135deg,#172a5b 0 48%,#f2b638 48% 76%,#45d7c8 76%)", unlock: "Original colours · always available" },
  { id: "nile", name: "Nile Dawn", title: "First Light", icon: "≈", rarity: "uncommon", family: "Recovery explorer", description: "Turquoise, rose and starlight colours earned with a player's first wish.", passiveName: "River's Memory", passive: "All healing is 30% stronger and Moon Springs also grant one Glyph.", burden: "Basic attacks deal 10% less damage.", techniqueName: "Flood of Stars", technique: "Restore 28% vitality and freeze the enemy's next attack.", accent: "#55e6e0", swatch: "linear-gradient(135deg,#0b7f91 0 48%,#f08aa4 48% 76%,#b9fff4 76%)", unlock: "Badge: First Light" },
  { id: "lotus", name: "Lotus Bloom", title: "Growing Binder", icon: "❀", rarity: "uncommon", family: "Sustain specialist", description: "Rose, violet and emerald colours earned by growing a collection.", passiveName: "Bloom Again", passive: "Recover 10 vitality after every guardian and gain Fate 20% faster.", burden: "Enemies have 8% more vitality.", techniqueName: "Lotus Pulse", technique: "Drain an enemy for damage and heal for half the damage dealt.", accent: "#e86aae", swatch: "linear-gradient(135deg,#b52f76 0 48%,#7b51d9 48% 76%,#65e0a3 76%)", unlock: "Badge: Growing Binder" },
  { id: "scarab", name: "Scarab Glow", title: "A Different Glow", icon: "◆", rarity: "rare", family: "Critical hunter", description: "Emerald, cyan and ruby colours awakened by the first rare pull.", passiveName: "Jeweled Instinct", passive: "+10% critical chance and elite victories gain 15 extra Fate.", burden: "Guardians deal 8% more damage.", techniqueName: "Scarab Swarm", technique: "A piercing strike that deals double damage to elites and bosses.", accent: "#55ead8", swatch: "linear-gradient(135deg,#087d69 0 48%,#55ead8 48% 76%,#f05d74 76%)", unlock: "Badge: A Different Glow" },
  { id: "sunstone", name: "Sunstone", title: "Week of Wishes", icon: "☼", rarity: "rare", family: "Solar striker", description: "Amber, copper and cream colours earned by a seven-day wish streak.", passiveName: "Dawn Incarnate", passive: "Solar Pounce deals 70% more damage and altars have +25% Flame chance.", burden: "Moon Ward takes 20% longer to recharge.", techniqueName: "Solar Flare", technique: "Detonate a miniature sun for extreme damage at a small vitality cost.", accent: "#ffb52f", swatch: "linear-gradient(135deg,#9d471f 0 48%,#ffb52f 48% 76%,#fff1b8 76%)", unlock: "Badge: Week of Wishes" },
  { id: "royal", name: "Royal Night", title: "Constellation Keeper", icon: "♛", rarity: "epic", family: "Treasure tactician", description: "Amethyst, indigo and jade colours carried by a constellation keeper.", passiveName: "Royal Tribute", passive: "+25% battle Stardust and elites always yield at least one Glyph.", burden: "Guardians have 15% more vitality.", techniqueName: "Royal Decree", technique: "Damage and permanently weaken the current guardian's attacks.", accent: "#a78bfa", swatch: "linear-gradient(135deg,#4e278f 0 48%,#8a69ef 48% 76%,#9ee9b4 76%)", unlock: "Badge: Constellation Keeper" },
  { id: "pearl", name: "Celestial Pearl", title: "Rare Constellation", icon: "☾", rarity: "epic", family: "Lunar defender", description: "Silver, moonlight and ice colours earned by finding twenty rares.", passiveName: "Moonlit Shell", passive: "Moon Ward blocks three attacks and grants two additional armour.", burden: "Basic attacks deal 10% less damage.", techniqueName: "Moon Mirror", technique: "Raise four wards and reflect a burst of the enemy's own power.", accent: "#d7e4ff", swatch: "linear-gradient(135deg,#77839e 0 48%,#eef2ff 48% 76%,#a5f3fc 76%)", unlock: "Badge: Rare Constellation" },
  { id: "sherry", name: "Sherry", title: "Oracle of the Black Veil", icon: "◉", rarity: "legendary", family: "Mystery assassin", description: "The account-exclusive black cat with deep green eyes.", passiveName: "Shadow Sight", passive: "+8% critical chance and mystery ambushes begin weakened.", burden: "Moon Springs restore only 70% vitality.", techniqueName: "Shadow Verdict", technique: "Instantly execute weakened enemies below 30% vitality, or land a triple critical strike.", accent: "#35c477", swatch: "linear-gradient(135deg,#070a09 0 58%,#0d5f35 58% 78%,#e8b338 78%)", unlock: "Sherry administrator account only", exclusive: true },
  { id: "bubbles", name: "Bubbles", title: "Guardian of the Moon Gate", icon: "◇", rarity: "legendary", family: "Guardian healer", description: "Skye's account-exclusive Bubbles: a calico coat with olive-green eyes.", passiveName: "Nine Lives Ward", passive: "Moon Ward blocks three attacks and restores 12 additional vitality.", burden: "Solar Pounce deals 15% less damage.", techniqueName: "Guardian's Call", technique: "Restore vitality, raise three wards and stun the guardian.", accent: "#779b38", swatch: "linear-gradient(135deg,#fffaf0 0 34%,#221b17 34% 58%,#c87924 58% 80%,#779b38 80%)", unlock: "Bubbles administrator account only", exclusive: true },
  { id: "cosmic_nebu", name: "Cosmic Nebu", title: "Living Constellation · Year One", icon: "∞", rarity: "legendary", family: "Ability glass-cannon", description: "The issue-numbered 1-in-100,000 Ancient Pulls prize, made from pure cosmic energy.", passiveName: "Supernova Soul", passive: "Abilities deal 25% more damage and bosses begin with one Starburst charge.", burden: "Basic attacks deal 20% less damage.", techniqueName: "Event Horizon", technique: "Collapse into a singularity for colossal damage, spending a little vitality.", accent: "#bc8cff", swatch: "linear-gradient(135deg,#050b3d 0 30%,#2563eb 30% 49%,#8b5cf6 49% 68%,#22d3ee 68% 82%,#f9d976 82%)", unlock: "Year One discovery · 1 in 100,000" },
];

export const OATHS: Oath[] = [
  { id: "wayfinder", name: "Wayfinder's Oath", icon: "✦", description: "The intended expedition balance.", enemyMultiplier: 1, rewardMultiplier: 1 },
  { id: "ascendant", name: "Ascendant's Oath", icon: "♛", description: "+25% guardian power · +35% expedition spoils.", enemyMultiplier: 1.25, rewardMultiplier: 1.35 },
  { id: "voidbound", name: "Voidbound Oath", icon: "◉", description: "+60% guardian power · +75% expedition spoils.", enemyMultiplier: 1.6, rewardMultiplier: 1.75 },
];

export function getSkin(id: SkinId) {
  return SKINS.find((skin) => skin.id === id) ?? SKINS[0];
}

export function getOath(id: OathId) {
  return OATHS.find((oath) => oath.id === id) ?? OATHS[0];
}

export function emptySkinMastery(): Record<SkinId, number> {
  return Object.fromEntries(SKINS.map((skin) => [skin.id, 0])) as Record<SkinId, number>;
}

export const BOONS: Boon[] = [
  { id: "solar-claws", name: "Claws of Ra", icon: "☼", family: "solar", description: "Nebu's basic attacks burn brighter.", perLevel: "+20% attack damage" },
  { id: "moon-ward", name: "Moon Ward", icon: "☾", family: "lunar", description: "Silver light hardens around Nebu.", perLevel: "+2 armour" },
  { id: "comet-heart", name: "Comet Heart", icon: "◇", family: "cosmic", description: "A newborn star beats beneath Nebu's coat.", perLevel: "+14 vitality and heal" },
  { id: "quick-paws", name: "Quick Paws", icon: "⌁", family: "lunar", description: "Time folds around every celestial leap.", perLevel: "-12% ability cooldown" },
  { id: "gold-whiskers", name: "Golden Whiskers", icon: "✦", family: "solar", description: "Treasure reveals itself wherever Nebu walks.", perLevel: "+15% battle Stardust" },
  { id: "life-thread", name: "Thread of Nine Lives", icon: "∞", family: "lunar", description: "Defeated guardians return a little life.", perLevel: "+8 healing after battle" },
  { id: "pharaoh-curiosity", name: "Pharaoh's Curiosity", icon: "◉", family: "cosmic", description: "Nebu can smell impossible relics through stone.", perLevel: "+5% relic chance" },
  { id: "star-roar", name: "Roar of the First Star", icon: "✺", family: "cosmic", description: "Solar Pounce becomes a miniature supernova.", perLevel: "+45% ability damage" },
];

export function emptyBoons(): Record<BoonId, number> {
  return {
    "solar-claws": 0,
    "moon-ward": 0,
    "comet-heart": 0,
    "quick-paws": 0,
    "gold-whiskers": 0,
    "life-thread": 0,
    "pharaoh-curiosity": 0,
    "star-roar": 0,
  };
}

export function makeBoonChoices(boons: Record<BoonId, number>): BoonId[] {
  const pool = BOONS.filter((boon) => boons[boon.id] < 5).map((boon) => boon.id);
  const choices: BoonId[] = [];
  while (choices.length < Math.min(3, pool.length)) {
    const pick = randomFrom(pool);
    if (!choices.includes(pick)) choices.push(pick);
  }
  return choices;
}

export const BUILDINGS: Array<{
  id: BuildingId;
  name: string;
  icon: string;
  description: string;
  effect: (level: number) => string;
}> = [
  { id: "observatory", name: "Celestial Observatory", icon: "◒", description: "Charts falling stars while you are away.", effect: (level) => `+${Math.round(level * 18)} Stardust / min` },
  { id: "scarabWorks", name: "Scarab Works", icon: "◆", description: "Clockwork scarabs recover ancient glyphs.", effect: (level) => `+${Math.round(level * 8)}% glyph finds` },
  { id: "moonGarden", name: "Moon Garden", icon: "☾", description: "Restorative flowers strengthen Nebu.", effect: (level) => `+${level * 10} maximum vitality` },
  { id: "sunTemple", name: "Sun Temple", icon: "☼", description: "Condenses rare Celestial Flames.", effect: (level) => `+${level * 4}% flame chance` },
  { id: "sanctuary", name: "Nebu's Sanctuary", icon: "△", description: "Permanent training between expeditions.", effect: (level) => `+${level * 3} attack` },
  { id: "pyramidGate", name: "Pyramid Gateway", icon: "⟁", description: "Bends the Duat and magnifies all production.", effect: (level) => `+${level * 12}% total production` },
];

const ENEMIES = [
  ["Sand Wraith", "♧"],
  ["Hollow Jackal", "♜"],
  ["Duat Sentinel", "♟"],
  ["Starved Sphinx", "♞"],
  ["Void Scarab", "◆"],
  ["Astral Devourer", "◈"],
] as const;

const BOSSES = [
  ["Apep, Eater of Dawn", "☍"],
  ["The Drowned Pharaoh", "♛"],
  ["Sekhem the Star Breaker", "✺"],
  ["The Sphinx Without a Name", "◬"],
  ["Maw of the Last Eclipse", "◉"],
] as const;

export const BIOMES = [
  { from: 0, name: "The Sand Veil", subtitle: "Where forgotten names whisper" },
  { from: 8, name: "Sunken Palace", subtitle: "Gold sleeps beneath black water" },
  { from: 18, name: "River of Stars", subtitle: "The sky flows underfoot" },
  { from: 30, name: "The Black Pyramid", subtitle: "Nothing casts this shadow" },
  { from: 45, name: "Cosmic Maw", subtitle: "The Duat dreams of infinity" },
];

export function biomeFor(depth: number) {
  const cycleDepth = depth % 60;
  const base = [...BIOMES].reverse().find((biome) => cycleDepth >= biome.from) ?? BIOMES[0];
  const cycle = Math.floor(depth / 60);
  return cycle === 0 ? base : { ...base, name: `${base.name} · Echo ${cycle + 1}` };
}

export function relicAttackMultiplier(relics: string[]) {
  return 1 + (relics.includes("solar-fang") ? 0.18 : 0) + (relics.includes("sun-disk") ? 0.08 : 0);
}

export function relicDustMultiplier(relics: string[]) {
  return (relics.includes("scarab-heart") ? 1.2 : 1) * (relics.includes("nebu-crown") ? 2 : 1);
}

export function maxVitality(buildings: GameState["buildings"], relics: string[], eclipse = 0) {
  return Math.round((100 + buildings.moonGarden * 10 + eclipse * 12) * (relics.includes("moon-vessel") ? 1.25 : 1));
}

export function attackPower(buildings: GameState["buildings"], relics: string[], eclipse = 0) {
  return Math.round((12 + buildings.sanctuary * 3 + eclipse * 2) * relicAttackMultiplier(relics));
}

export function productionPerMinute(state: GameState) {
  const gate = 1 + state.buildings.pyramidGate * 0.12;
  return state.buildings.observatory * 18 * gate * relicDustMultiplier(state.relics);
}

export function upgradeCost(id: BuildingId, level: number) {
  const index = BUILDINGS.findIndex((building) => building.id === id);
  const base = 90 + index * 75;
  return {
    dust: Math.round(base * Math.pow(1.72, level)),
    glyphs: level < 2 ? 0 : Math.ceil((level - 1) * (1 + index / 3)),
  };
}

const ENEMY_TRAITS: Record<EnemyTrait, { name: string; description: string }> = {
  armoured: { name: "Obsidian Shell", description: "Basic strikes deal 20% less damage." },
  frenzied: { name: "Solar Frenzy", description: "Deals 20% more damage." },
  leeching: { name: "Soul Drinker", description: "Recovers vitality whenever it lands a hit." },
  volatile: { name: "Unstable Star", description: "Hits much harder but has less vitality." },
};

export function makeEnemy(depth: number, eclipse: number, elite = false, boss = false, oathMultiplier = 1, skin: SkinId = "midnight"): Enemy {
  const index = Math.min(ENEMIES.length - 1, Math.floor((depth % 60) / 10));
  const bossIndex = Math.floor(depth / 5) % BOSSES.length;
  const [baseName, icon] = boss ? BOSSES[bossIndex] : ENEMIES[index];
  const scale = 1 + depth * 0.14 + eclipse * 0.45;
  const eliteScale = boss ? 4.1 : elite ? 2.15 : 1;
  const traitPool: EnemyTrait[] = ["armoured", "frenzied", "leeching", "volatile"];
  const trait = depth >= 3 || elite || boss ? randomFrom(traitPool) : null;
  const skinHp = skin === "lotus" ? 1.08 : skin === "royal" ? 1.15 : 1;
  const traitHp = trait === "armoured" ? 1.2 : trait === "volatile" ? 0.84 : 1;
  const hp = Math.round(58 * scale * eliteScale * oathMultiplier * skinHp * traitHp);
  const skinAttack = skin === "scarab" ? 1.08 : 1;
  const traitAttack = trait === "frenzied" ? 1.2 : trait === "volatile" ? 1.35 : 1;
  return {
    name: boss ? baseName : elite ? `Ascended ${baseName}` : baseName,
    icon,
    hp,
    maxHp: hp,
    attack: Math.max(4, Math.round((7 + depth * 0.38 + eclipse * 1.2) * (boss ? 1.68 : elite ? 1.45 : 1) * oathMultiplier * skinAttack * traitAttack)),
    elite: elite || boss,
    boss,
    trait,
    traitName: trait ? ENEMY_TRAITS[trait].name : null,
    traitDescription: trait ? ENEMY_TRAITS[trait].description : null,
    enraged: false,
    weakened: false,
    stunned: 0,
  };
}

const ROUTES: Record<RoomKind, Omit<RouteChoice, "id" | "kind">> = {
  battle: { eyebrow: "Hostile presence", title: "Jackal Gate", description: "A guarded path with reliable spoils.", danger: 2, reward: "Stardust · Glyph chance" },
  elite: { eyebrow: "Ominous pulse", title: "Eclipse Chamber", description: "A stronger guardian protects exceptional treasure.", danger: 5, reward: "Flame · High relic chance" },
  boss: { eyebrow: "The Duat holds its breath", title: "Guardian of the Fifth Gate", description: "A named horror bars every path forward. Defeat it to evolve your build.", danger: 5, reward: "Boon · Flame · Guaranteed relic" },
  vault: { eyebrow: "Ancient signal", title: "Forgotten Vault", description: "A sealed reliquary waits to remember its owner.", danger: 1, reward: "Relic · Stardust" },
  spring: { eyebrow: "Familiar song", title: "Moon Spring", description: "Rest beneath silver reeds and restore vitality.", danger: 0, reward: "Full heal · Small blessing" },
  mystery: { eyebrow: "Unknown omen", title: "Door Without a Shadow", description: "No map agrees on what waits beyond it.", danger: 3, reward: "Unknown" },
  altar: { eyebrow: "Solar resonance", title: "Unlit Altar", description: "Offer Stardust to call down celestial fire.", danger: 1, reward: "Flame chance · Attack blessing" },
};

function randomFrom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

export function makeChoices(depth: number): RouteChoice[] {
  if (depth > 0 && (depth + 1) % 5 === 0) {
    return [{ ...ROUTES.boss, id: `boss-${depth}-${Date.now()}`, kind: "boss" }];
  }
  const first: RoomKind = Math.random() < 0.18 ? "elite" : "battle";
  const pool: RoomKind[] = ["vault", "spring", "mystery", "altar", "battle"];
  if (depth < 2) pool.splice(pool.indexOf("mystery"), 1);
  const second = randomFrom(pool);
  let third = randomFrom(pool);
  while (third === second) third = randomFrom(pool);
  return [first, second, third].map((kind, index) => ({
    ...ROUTES[kind],
    id: `${Date.now()}-${depth}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
  }));
}

function startingChoices(): RouteChoice[] {
  const kinds: RoomKind[] = ["battle", "spring", "vault"];
  return kinds.map((kind, index) => ({
    ...ROUTES[kind],
    id: `origin-${index}`,
    kind,
  }));
}

export function initialState(): GameState {
  const buildings: GameState["buildings"] = { observatory: 1, scarabWorks: 0, moonGarden: 0, sunTemple: 0, sanctuary: 0, pyramidGate: 0 };
  const relics: string[] = [];
  const maxHp = maxVitality(buildings, relics);
  return {
    version: 1,
    lastSeen: 0,
    resources: { dust: 180, glyphs: 2, flames: 0, fragments: 0, wishes: 0 },
    run: {
      phase: "choice",
      depth: 0,
      maxDepth: 0,
      hp: maxHp,
      maxHp,
      attack: attackPower(buildings, relics),
      armor: 1,
      enemy: null,
      choices: startingChoices(),
      skillReadyAt: 0,
      guardReadyAt: 0,
      guard: 0,
      combo: 0,
      discovery: null,
      boons: emptyBoons(),
      pendingBoons: [],
      eventId: null,
      history: ["Nebu entered the Sand Veil."],
      oath: "wayfinder",
      fate: 0,
      fateSurge: false,
      chain: 0,
      bestChain: 0,
      skinReadyAt: 0,
    },
    buildings,
    relics,
    eclipse: 0,
    roomsCleared: 0,
    enemiesDefeated: 0,
    propheciesClaimed: [],
    nextAdAt: 0,
    selectedSkin: "midnight",
    ownedSkins: SKINS.map((skin) => skin.id),
    skinMastery: emptySkinMastery(),
  };
}

export function safeLoad(raw: string | null): GameState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as GameState;
    if (parsed.version !== 1 || !parsed.resources || !parsed.run || !parsed.buildings) return null;
    const fresh = initialState();
    parsed.run = {
      ...fresh.run,
      ...parsed.run,
      boons: { ...emptyBoons(), ...(parsed.run.boons ?? {}) },
      pendingBoons: parsed.run.pendingBoons ?? [],
      history: parsed.run.history ?? ["The Duat remembers an earlier journey."],
    };
    parsed.run.combo = Math.min(3, parsed.run.combo ?? 0);
    const legacySkins: Record<string, SkinId> = { nebu: "midnight", pharaoh: "royal", "sun-god": "sunstone" };
    parsed.selectedSkin = legacySkins[parsed.selectedSkin] ?? parsed.selectedSkin ?? "midnight";
    if (!SKINS.some((skin) => skin.id === parsed.selectedSkin)) parsed.selectedSkin = "midnight";
    parsed.ownedSkins = (parsed.ownedSkins ?? SKINS.map((skin) => skin.id))
      .map((skin) => legacySkins[skin] ?? skin)
      .filter((skin, index, all): skin is SkinId => SKINS.some((item) => item.id === skin) && all.indexOf(skin) === index);
    for (const skin of SKINS) if (!parsed.ownedSkins.includes(skin.id)) parsed.ownedSkins.push(skin.id);
    parsed.skinMastery = { ...emptySkinMastery(), ...(parsed.skinMastery ?? {}) };
    return parsed;
  } catch {
    return null;
  }
}

export function discoverRelic(owned: string[], boosted = false) {
  const available = RELICS.filter((relic) => !owned.includes(relic.id));
  if (available.length === 0) return null;
  const weighted = available.filter((relic) => {
    const roll = Math.random();
    if (relic.rarity === "legendary") return roll < (boosted ? 0.45 : 0.08);
    if (relic.rarity === "epic") return roll < (boosted ? 0.7 : 0.25);
    return true;
  });
  return randomFrom(weighted.length ? weighted : available);
}
