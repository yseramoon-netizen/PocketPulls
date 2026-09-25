import { getWishRevealConfig } from './wish-reveal';

export const STAFF_MAX_ANGLE = 45;
export const STAFF_RELEASE_ANGLE = 42;
export const STAFF_PIVOT = { x: 168, y: 163 } as const;
export const STAFF_RADIUS = 82;
export const STAFF_TAP_SLOP = 7;

/** Wallet colour is cosmetic. It never changes the odds or reveals a future result. */
export const STAFF_POWER_STEPS = [
  { at: 1, rarity: 'Common' },
  { at: 5, rarity: 'Uncommon' },
  { at: 15, rarity: 'Rare' },
  { at: 30, rarity: 'Double Rare' },
  { at: 60, rarity: 'Ultra Rare' },
  { at: 100, rarity: 'Illustration Rare' },
  { at: 150, rarity: 'Special Illustration Rare' },
  { at: 200, rarity: 'Hyper Rare' },
  { at: 250, rarity: 'Crown Rare' },
] as const;

export function staffPower(balance: number) {
  const count = Number.isFinite(balance) ? Math.max(0, Math.floor(balance)) : 0;
  const step = [...STAFF_POWER_STEPS].reverse().find(step => count >= step.at);
  const theme = getWishRevealConfig(step?.rarity ?? 'Common');
  return { count, capped: Math.min(count, 250), dormant: count === 0,
    label: count ? theme.label : 'Resting',
    primary: count ? theme.primary : '#8992a7', secondary: count ? theme.secondary : '#586277' };
}

/** Clockwise degrees from upright. Radial tolerance accepts a human thumb's imperfect arc. */
export function staffArc(x: number, y: number, pivotX: number, pivotY: number, radius: number, startAngle = 0) {
  const dx = x - pivotX, dy = pivotY - y;
  const raw = Math.atan2(dx, dy) * 180 / Math.PI - startAngle;
  const ratio = Math.hypot(dx, dy) / radius;
  const valid = [raw, ratio, radius].every(Number.isFinite) && radius > 0 && raw >= -12 && raw <= 74 && ratio >= .55 && ratio <= 1.65;
  return { angle: Math.max(0, Math.min(STAFF_MAX_ANGLE, Number.isFinite(raw) ? raw : 0)), valid, raw };
}
export function staffGesture(angle: number, valid: boolean, travelled: number, cancelled = false): 'pull' | 'tap' | 'cancel' {
  if (cancelled || ![angle, travelled].every(Number.isFinite)) return 'cancel';
  if (valid && angle >= STAFF_RELEASE_ANGLE && travelled > STAFF_TAP_SLOP) return 'pull';
  return travelled <= STAFF_TAP_SLOP ? 'tap' : 'cancel';
}

export type AstraRequest = 'binder' | 'settings' | 'friends' | 'universe' | 'galaxies' | 'catalogue' | 'shipping' | 'profile' | 'help' | 'badges' | 'notifications';
export const ASTRA_REQUESTS: readonly { id: AstraRequest; label: string; reply: string; href?: string }[] = [
  { id: 'binder', label: 'Open my binder', reply: 'Let’s open your collection.', href: '/collection' },
  { id: 'friends', label: 'I want to trade with friends', reply: 'A little magic is better shared.', href: '/friends?panel=trade' },
  { id: 'settings', label: 'I want to change the settings', reply: 'Let’s make this feel like you.' },
  { id: 'universe', label: 'Show me the universe', reply: 'There’s so much more out there.' },
  { id: 'galaxies', label: 'Find someone’s galaxy', reply: 'Who shall we visit?' },
  { id: 'catalogue', label: 'Let me explore the cards', reply: 'Let’s see what’s waiting.', href: '/catalogue' },
  { id: 'shipping', label: 'Bring my cards home', reply: 'Your collection, on its way.', href: '/shipping' },
  { id: 'badges', label: 'Show me my milestones', reply: 'Look how far you’ve come.', href: '/achievements' },
  { id: 'notifications', label: 'Read my notifications', reply: 'Let’s see what’s new.' },
  { id: 'profile', label: 'Open my profile', reply: 'Your own place among the stars.', href: '/profile' },
  { id: 'help', label: 'Astra, I need some help', reply: 'Of course. I’m right here.', href: '/help' },
];

export function searchAstraRequests(query: string) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const synonyms: Partial<Record<AstraRequest, string>> = { binder: 'collection cards book', settings: 'sound audio volume accessibility motion', friends: 'trade trading social', galaxies: 'rank leaderboard player galaxy', help: 'support contact questions', shipping: 'orders delivery post', profile: 'account username avatar', badges: 'achievements rewards', notifications: 'messages news alerts' };
  return ASTRA_REQUESTS.filter(item => words.every(word => `${item.label} ${item.id} ${synonyms[item.id] || ''}`.toLowerCase().includes(word)));
}
