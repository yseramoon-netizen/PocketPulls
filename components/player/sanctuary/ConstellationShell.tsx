"use client";
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ASTRA_REQUESTS, type AstraRequest } from '@/lib/player/astraInteraction';
import { publishPlayerPreferences } from '@/lib/player/preferences';
import useModalFocus from '@/lib/client/useModalFocus';
import usePlayerPreferences from '../usePlayerPreferences';
import ConnectionStatus from '../ConnectionStatus';
import AstraCompanion from './AstraCompanion';
import RequestIcon from './RequestIcon';
import { AstraAudio } from './AstraAudio';
import useStaffWish from './useStaffWish';
import StaffWishMoment from './StaffWishMoment';

const Observatory = dynamic(() => import('../observatory/Observatory'), { ssr: false });
const Preferences = dynamic(() => import('../PlayerPreferences'), { ssr: false });
const Notifications = dynamic(() => import('../NotificationCentre'), { ssr: false });
const homePaths = new Set(['/observatory', '/hq', '/wishes', '/constellation', '/leaderboard']);
function subscribeMotion(notify: () => void) { const media = window.matchMedia('(prefers-reduced-motion: reduce)'); media.addEventListener('change', notify); return () => media.removeEventListener('change', notify); }
const TITLES: Record<string, string> = { collection: 'Your binder', catalogue: 'The catalogue', friends: 'Friends & trades', shipping: 'Shipping & orders', profile: 'Your profile', achievements: 'Your milestones', help: 'A little guidance', wishes: 'Recharge wishes', terms: 'Terms & conditions', privacy: 'Privacy', cookies: 'Cookies', returns: 'Returns & refunds', contact: 'Contact' };

export default function ConstellationShell({ children, userId, displayName, wishBalance, maintenance, maintenanceMessage }: {
  children: ReactNode; userId: string; displayName: string; wishBalance: number; maintenance: boolean; maintenanceMessage: string;
}) {
  const pathname = usePathname(), router = useRouter(), preferences = usePlayerPreferences();
  const systemReduced = useSyncExternalStore(subscribeMotion, () => window.matchMedia('(prefers-reduced-motion: reduce)').matches, () => false);
  const reduced = preferences.reducedMotion || systemReduced;
  const [audio] = useState(() => new AstraAudio()), [sound, setSound] = useState(false);
  const [moment, setMoment] = useState(false), [source, setSource] = useState({ x: 0, y: 0 });
  const [preferencesOpen, setPreferencesOpen] = useState(false), [cinema, setCinema] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [astraMenu, setAstraMenu] = useState(false);
  const wish = useStaffWish(userId), routePanel = !homePaths.has(pathname), background = useRef<HTMLDivElement>(null);
  const closePanel = useCallback(() => router.push('/observatory', { scroll: false }), [router]);
  const panel = useModalFocus<HTMLElement>(routePanel, closePanel);
  const title = pathname === '/wishes/recovery' ? 'Recover your wishes' : TITLES[pathname.split('/')[1]] || 'Ancient Pulls';
  useEffect(() => {
    const instrument = audio;
    const initial = requestAnimationFrame(() => { try { setSound(localStorage.getItem('ancientpulls:astra-sound') === 'on'); } catch {} });
    const visibility = () => { if (document.hidden) instrument.hush(); };
    document.addEventListener('visibilitychange', visibility);
    document.documentElement.dataset.sanctuary = 'true';
    return () => { cancelAnimationFrame(initial); instrument.dispose(); document.removeEventListener('visibilitychange', visibility); delete document.documentElement.dataset.sanctuary; };
  }, [audio]);
  useEffect(() => { audio?.configure(sound, preferences.sfxVolume); }, [audio, sound, preferences.sfxVolume]);
  useEffect(() => {
    const sync = (event: Event) => setPreferencesOpen(!!(event as CustomEvent<{ open: boolean }>).detail.open);
    const cinemaChanged = (event: Event) => setCinema(!!(event as CustomEvent<{ open: boolean }>).detail.open);
    const notificationsChanged = (event: Event) => setNotificationsOpen(!!(event as CustomEvent<{ open: boolean }>).detail.open);
    const menuChanged = (event: Event) => setAstraMenu(!!(event as CustomEvent<{ open: boolean }>).detail.open);
    window.addEventListener('ancientpulls:preferences-visibility', sync); window.addEventListener('ancientpulls:observatory-cinema', cinemaChanged);
    window.addEventListener('ancientpulls:notifications-visibility', notificationsChanged);
    window.addEventListener('ancientpulls:astra-menu', menuChanged);
    return () => { window.removeEventListener('ancientpulls:preferences-visibility', sync); window.removeEventListener('ancientpulls:observatory-cinema', cinemaChanged); window.removeEventListener('ancientpulls:notifications-visibility', notificationsChanged); window.removeEventListener('ancientpulls:astra-menu', menuChanged); };
  }, []);
  useEffect(() => {
    if (wish.error) window.dispatchEvent(new Event('ancientpulls:call-astra'));
  }, [wish.error]);
  const request = (id: AstraRequest) => {
    if (id === 'settings') { window.dispatchEvent(new Event('ancientpulls:open-preferences')); return; }
    if (id === 'notifications') { window.dispatchEvent(new Event('ancientpulls:open-notifications')); return; }
    if (id === 'universe') { window.dispatchEvent(new CustomEvent('ancientpulls:sky-command', { detail: { action: 'universe' } })); return; }
    const href = ASTRA_REQUESTS.find(item => item.id === id)?.href;
    if (href) router.push(href, { scroll: false });
  };
  const startWish = (position: { x: number; y: number }) => { setSource(position); setMoment(true); void wish.summon(); };
  const place = () => { wish.place(); setMoment(false); };
  const toggleSound = () => { const next = !sound; setSound(next); audio?.configure(next, preferences.sfxVolume); if (next) audio?.cue('menu'); try { localStorage.setItem('ancientpulls:astra-sound', next ? 'on' : 'off'); } catch {} };
  const showingMoment = moment && !wish.error;
  const overlay = routePanel || preferencesOpen || notificationsOpen || showingMoment;

  return <div className="as-sanctuary unknown-pulls-shell" data-testid="constellation-shell" data-overlay={overlay} data-reduced={reduced}>
    <a href="#main-content" className="skip-link">Skip to constellation</a>
    <div ref={background} className="as-world" inert={overlay || astraMenu}>
      <main id="main-content" tabIndex={-1} aria-label="Your constellation"><Observatory embedded suspended={overlay || astraMenu} /></main>
      {!cinema && <>
        <header className="as-brand"><Link href="/observatory" aria-label="Ancient Pulls home"><RequestIcon name="star" /><span>ANCIENT <b>PULLS</b></span></Link><div><span className="as-live-dot" />{displayName.split(' ')[0]}’s constellation</div></header>
        <div className="as-connection"><ConnectionStatus />{maintenance && <p role="status">{maintenanceMessage || 'Wishes are resting during maintenance. Your collection is safe.'}</p>}</div>
        <div className="as-floor"><button className="as-sound" aria-label={sound ? 'Turn sound off' : 'Turn sound on'} aria-pressed={sound} onClick={toggleSound}><RequestIcon name={sound ? 'sound' : 'muted'} /><span>Sound {sound ? 'on' : 'off'}</span></button><Link href="/help">Help & information</Link></div>
      </>}
    </div>
    <div className="as-guide" hidden={cinema} inert={overlay}>
      <AstraCompanion balance={wishBalance} reduced={reduced} low={preferences.lowVisualEffects || preferences.dataSaver} audio={audio} onRequest={request} onWish={startWish} onRecharge={() => router.push('/wishes/shop', { scroll: false })} busy={wish.busy || !!wish.award} pending={wish.pending} error={wish.error} serverExhausted={wish.exhausted} batchPending={wish.batchPending} onBatch={() => router.push('/wishes/recovery', { scroll: false })} maintenance={maintenance} />
    </div>
    <Preferences hideTrigger />
    <Notifications hideTrigger />
    {routePanel && <div className="as-panel-scrim"><button className="as-panel-dismiss" aria-label="Return to constellation" tabIndex={-1} onClick={closePanel} /><section ref={panel} className="as-panel" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
      <div className="as-panel-bar"><div><RequestIcon name="star" /><span>{title}</span></div><button data-autofocus onClick={closePanel} aria-label="Close panel and return to constellation"><span>Back to the stars</span><RequestIcon name="close" /></button></div>
      <div className="as-panel-content">{children}</div>
    </section></div>}
    {showingMoment && <StaffWishMoment award={wish.award} source={source} reduced={reduced} skip={preferences.skipPullCinematic && preferences.cinematicSeen} audio={audio} onPlace={place} onSeen={() => { if (!preferences.cinematicSeen) publishPlayerPreferences({ ...preferences, cinematicSeen: true }); }} />}
  </div>;
}
