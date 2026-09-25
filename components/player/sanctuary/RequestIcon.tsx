import type { AstraRequest } from '@/lib/player/astraInteraction';
export default function RequestIcon({ name }: { name: AstraRequest | 'sound' | 'muted' | 'close' | 'star' | 'down' }) {
  const paths = {
    badges: 'M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM7 12l-2 10 7-4 7 4-2-10',
    notifications: 'M5 17V9a7 7 0 0 1 14 0v8l2 2H3Zm5 5h4',
    binder: 'M5 4h14v17H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm3 0v17m4-12h3m-3 4h3',
    settings: 'm10 2-.8 3-2 .9-2.8-.7-2 3.5 2 2.1v2.4l-2 2.1 2 3.5 2.8-.7 2 .9.8 3h4l.8-3 2-.9 2.8.7 2-3.5-2-2.1v-2.4l2-2.1-2-3.5-2.8.7-2-.9-.8-3Zm6 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    friends: 'M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM6 21v-3a6 6 0 0 1 12 0v3M18 4a3 3 0 0 1 0 6m2 4a5 5 0 0 1 2 4v2',
    universe: 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM3 16c-2-3 1-8 6-11s11-3 12 0-1 8-6 11S5 19 3 16Z',
    galaxies: 'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0Zm-1 5 6 6M10 6v8m-4-4h8',
    catalogue: 'M3 3h7v8H3Zm11 0h7v8h-7ZM3 15h7v6H3Zm11 0h7v6h-7Z',
    shipping: 'm3 6 9-4 9 4v12l-9 4-9-4Zm0 0 9 5 9-5M12 11v11M7 4l9 5v5',
    profile: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 22v-3a8 8 0 0 1 16 0v3',
    help: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM9 8a3 3 0 1 1 4 3c-1 .5-1 1-1 3m0 3v.1',
    sound: 'm4 9 4 0 5-4v14l-5-4H4Zm13-2a7 7 0 0 1 0 10m3-13a11 11 0 0 1 0 16',
    muted: 'm4 9 4 0 5-4v14l-5-4H4Zm13 0 5 6m0-6-5 6',
    close: 'm6 6 12 12M6 18 18 6', star: 'm12 1 2.8 8.2L23 12l-8.2 2.8L12 23l-2.8-8.2L1 12l8.2-2.8Z', down: 'M12 3v17m-6-6 6 6 6-6',
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
