"use client";
/* eslint-disable @next/next/no-img-element -- The awarded image URL is account data. */
import { useCallback, useEffect, useEffectEvent, useRef, useState, type CSSProperties } from 'react';
import type { BatchAward } from '@/lib/player/wishBatch';
import { getWishRevealConfig } from '@/lib/player/wish-reveal';
import useModalFocus from '@/lib/client/useModalFocus';
import RequestIcon from './RequestIcon';
import type { AstraAudio } from './AstraAudio';

export default function StaffWishMoment({ award, reduced, source, onPlace, onSeen, audio, skip }: {
  award: BatchAward | null; reduced: boolean; source: { x: number; y: number }; onPlace: () => void; onSeen: () => void; audio: AstraAudio | null; skip: boolean;
}) {
  const [stage, setStage] = useState<'travelling' | 'bloom' | 'card'>('travelling');
  const [imageFailed, setImageFailed] = useState(false), [slow, setSlow] = useState(false);
  const revealed = useRef(false), timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const revealNow = useCallback(() => { revealed.current = true; timers.current.forEach(clearTimeout); timers.current = []; setStage('card'); }, []);
  const config = getWishRevealConfig(award?.rarity, award?.marketValue);
  const modal = useModalFocus<HTMLDivElement>(true, () => { if (award) revealNow(); });
  const seen = useEffectEvent(onSeen);
  useEffect(() => { if (stage === 'card') { seen(); modal.current?.querySelector<HTMLButtonElement>('[data-autofocus]')?.focus({ preventScroll: true }); } }, [stage, modal]);
  useEffect(() => { const timer = setTimeout(() => setSlow(true), 6000); return () => clearTimeout(timer); }, []);
  useEffect(() => {
    if (!award || revealed.current) return;
    const bloom = setTimeout(() => { setStage('bloom'); audio?.cue('reveal', config.tier); }, reduced || skip ? 0 : 1100);
    const reveal = setTimeout(revealNow, reduced || skip ? 40 : 2600);
    timers.current = [bloom, reveal];
    return () => { clearTimeout(bloom); clearTimeout(reveal); };
  }, [award, reduced, skip, audio, config.tier, revealNow]);
  return <div ref={modal} className="as-wish-moment" data-stage={stage} data-reduced={reduced || skip} data-black-hole={config.blackHole && stage !== 'travelling'}
    role="dialog" aria-modal="true" aria-label="Your wish" tabIndex={-1}
    style={{ '--source-x': `${source.x}px`, '--source-y': `${source.y}px`, '--reward': stage === 'travelling' ? '#e6edf9' : config.primary, '--reward-secondary': config.secondary } as CSSProperties}>
    <div className="as-wish-shade" />
    <div className="as-orb" aria-hidden="true"><div className="as-orb-halo" /><RequestIcon name="star" /><i /><i /></div>
    <div className="as-wish-rays" aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ '--angle': `${i * 20}deg`, '--delay': `${i % 4 * .04}s` } as CSSProperties} />)}</div>
    {stage !== 'card' && <div className="as-wish-caption" role="status"><p>{award ? 'A star has answered.' : slow ? 'Still reaching the stars…' : 'Astra is listening…'}</p><span>{award ? 'A new story for your sky' : 'Your wish is being prepared'}</span></div>}
    {award && stage !== 'card' && <button className="as-skip" onClick={revealNow}>Reveal card <span>↗</span></button>}
    {award && stage === 'card' && <div className="as-reward" data-testid="wish-result">
      <p className="as-eyebrow">A STAR FOR YOUR SKY</p>
      <div className="as-card-aura"><div className="as-card-frame">{award.imageUrl && !imageFailed ? <img src={award.imageUrl} alt={award.name} onError={() => setImageFailed(true)} /> : <div className="as-missing-card"><RequestIcon name="star" /><span>{award.name}</span></div>}</div></div>
      <p className="as-rarity">{config.blackHole ? config.label : award.rarity}</p><h2>{award.name}</h2>
      <p className="as-card-meta">{award.setName}{award.cardNumber !== '-' ? ` · ${award.cardNumber}` : ''}</p>
      <button className="as-primary" data-autofocus onClick={() => { audio?.cue('place'); onPlace(); }}>Place in my constellation <RequestIcon name="star" /></button>
      <p className="as-balance-note">{award.wishBalance.toLocaleString('en-GB')} {award.wishBalance === 1 ? 'wish' : 'wishes'} remaining</p>
    </div>}
  </div>;
}
