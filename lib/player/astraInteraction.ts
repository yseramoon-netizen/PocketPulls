import { getWishRevealConfig } from './wish-reveal';

export const STAFF_PULL_DISTANCE = 88;
export const STAFF_MAX_DISTANCE = 118;
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

export function staffGesture(dx: number, dy: number, travelled: number, cancelled = false): 'pull' | 'tap' | 'cancel' {
  if (cancelled || ![dx, dy, travelled].every(Number.isFinite)) return 'cancel';
  if (dy >= STAFF_PULL_DISTANCE && Math.abs(dx) <= Math.max(44, dy * .65)) return 'pull';
  return travelled <= STAFF_TAP_SLOP ? 'tap' : 'cancel';
}

export type AstraRequest = 'binder' | 'settings' | 'friends' | 'universe' | 'catalogue' | 'shipping' | 'profile' | 'help' | 'badges' | 'notifications';
export const ASTRA_REQUESTS: readonly { id: AstraRequest; label: string; reply: string; href?: string }[] = [
  { id: 'binder', label: 'Open my binder', reply: 'Let’s open your collection.', href: '/collection' },
  { id: 'friends', label: 'I want to trade with friends', reply: 'A little magic is better shared.', href: '/friends?panel=trade' },
  { id: 'settings', label: 'I want to change the settings', reply: 'Let’s make this feel like you.' },
  { id: 'universe', label: 'Show me the universe', reply: 'There’s so much more out there.' },
  { id: 'catalogue', label: 'Let me explore the cards', reply: 'Let’s see what’s waiting.', href: '/catalogue' },
  { id: 'shipping', label: 'Bring my cards home', reply: 'Your collection, on its way.', href: '/shipping' },
  { id: 'badges', label: 'Show me my milestones', reply: 'Look how far you’ve come.', href: '/achievements' },
  { id: 'notifications', label: 'Read my notifications', reply: 'Let’s see what’s new.' },
  { id: 'profile', label: 'Open my profile', reply: 'Your own place among the stars.', href: '/profile' },
  { id: 'help', label: 'Astra, I need some help', reply: 'Of course. I’m right here.', href: '/help' },
];
