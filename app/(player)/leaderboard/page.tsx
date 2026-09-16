"use client";

import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import AstralIcon from "@/components/player/observatory/AstralIcon";
import { paintUniverseFrame, cameraDamping, MAX_VISIBLE_RANKS, buildGalaxyNodes, parseRows, clamp, lerp, resolveGalaxyPosition, type GalaxyNode, type GalaxyHit, type HoverLabel, type LeaderboardPlayer, type Camera } from "@/components/player/observatory/UniverseRenderer";
import SceneHeader from "@/components/player/observatory/SceneHeader";
import usePlayerPreferences from "@/components/player/usePlayerPreferences";
import { OrbitClock } from "@/components/player/observatory/OrbitClock";
import useModalFocus from "@/lib/client/useModalFocus";

import {
  formatMoney,
  formatWholeNumber,
  getErrorMessage,
  toNumber,
  toWholeNumber,
} from "@/lib/player/format";
import { supabase } from "@/lib/supabase";

import styles from "./Leaderboard.module.css";

export default function LeaderboardPage() {
  const preferences=usePlayerPreferences();
  const lastFrameRef=useRef<number|null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const clockRef = useRef(new OrbitClock());
  const spritesRef=useRef(new Map<string,HTMLCanvasElement>());
  const gesturePointsRef = useRef(new Map<number,{x:number;y:number}>());
  const pinchRef = useRef<number | null>(null);
  const dragDistanceRef = useRef(0);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const hitsRef = useRef<GalaxyHit[]>([]);
  const nodesRef = useRef<GalaxyNode[]>([]);
  const pharaohRef = useRef<LeaderboardPlayer | null>(null);
  const selectedRef = useRef<LeaderboardPlayer | null>(null);
  const hoveredRef = useRef<LeaderboardPlayer | null>(null);
  const reducedMotionRef = useRef(false);
  const pageVisibleRef = useRef(true);
  const motionOverrideRef = useRef<boolean | null>(null);
  const pointerRef = useRef({ down: false, moved: false, x: 0, y: 0 });
  const centreCaptionRef=useRef<HTMLDivElement|null>(null);
  const hoverLabelRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<Camera>({ yaw: 0, pitch: 0, zoom: 1, focusX: 0, focusY: 0, focusZ: 0 });
  const cameraTargetRef = useRef<Camera>({ yaw: 0, pitch: 0, zoom: 1, focusX: 0, focusY: 0, focusZ: 0 });

  const [players, setPlayers] = useState<LeaderboardPlayer[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<LeaderboardPlayer | null>(null);
  const [hoverLabel, setHoverLabel] = useState<HoverLabel | null>(null);
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);
  const [rankSearch, setRankSearch] = useState("");
  const [rankListOpen, setRankListOpen] = useState(false);
  const listRef=useModalFocus<HTMLElement>(rankListOpen,()=>setRankListOpen(false));
  const [motionActive, setMotionActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadLeaderboard = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.rpc("get_player_leaderboard", {
        p_limit: MAX_VISIBLE_RANKS,
      });
      if (error) throw error;

      const parsed = parseRows(data);
      const { data: cosmicHolders, error: cosmicError } = await supabase.rpc(
        "get_public_cosmic_nebu_holders",
        { p_user_ids: parsed.map((player) => player.userId).filter(Boolean) },
      );
      const cosmicByUser = new Map<string, number>();
      if (!cosmicError && Array.isArray(cosmicHolders)) {
        for (const holder of cosmicHolders as Array<{ user_id?: unknown; issue_number?: unknown }>) {
          const userId = typeof holder.user_id === "string" ? holder.user_id : "";
          const issue = toWholeNumber(holder.issue_number);
          if (userId && issue > 0) cosmicByUser.set(userId, issue);
        }
      }

      const nextPlayers = parsed.map((player) => ({
        ...player,
        cosmicIssueNumber: cosmicByUser.get(player.userId) ?? null,
      }));
      setPlayers(nextPlayers);
      setSelectedPlayer((current) =>
        current
          ? nextPlayers.find((player) => player.userId === current.userId) ?? null
          : null,
      );
    } catch (error: unknown) {
      console.error("Universe ranks error:", error);
      setErrorMessage(getErrorMessage(error, "The universe ranks could not be loaded."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void loadLeaderboard());
    return () => window.cancelAnimationFrame(frame);
  }, [loadLeaderboard]);

  const nodes = useMemo(() => buildGalaxyNodes(players), [players]);
  const pharaoh = players.find((player) => player.rank === 1) ?? null;
  const currentPlayer = players.find((player) => player.isCurrentUser) ?? null;
  const communityCards = useMemo(
    () => players.reduce((total, player) => total + player.totalCards, 0),
    [players],
  );
  const communityWishes = useMemo(
    () => players.reduce((total, player) => total + player.lifetimeWishes, 0),
    [players],
  );

  useEffect(() => { nodesRef.current = nodes; spritesRef.current.clear(); }, [nodes]);
  useEffect(() => { pharaohRef.current = pharaoh; }, [pharaoh]);
  useEffect(() => { selectedRef.current = selectedPlayer; }, [selectedPlayer]);

  const renderScene = useCallback(function renderFrame(stamp: number) {
    const time = clockRef.current.sample(stamp, !reducedMotionRef.current && pageVisibleRef.current);
    frameRef.current = null;
    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    if (!canvas || !viewport) return;

    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    if (width <= 0 || height <= 0) return;
    const mobile = width < 768;
    const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.28 : 1.62, Math.sqrt(1900000 / (width * height)));
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
    }

    const context = canvas.getContext("2d", { alpha: false, desynchronized: true });
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.fillStyle = "#02030b";
    context.fillRect(0, 0, width, height);

    const camera = cameraRef.current;
    const target = cameraTargetRef.current;
    const trackedPlayer = selectedRef.current;
    if (trackedPlayer && trackedPlayer.rank > 1) {
      const trackedNode = nodesRef.current.find(
        (node) => node.player.userId === trackedPlayer.userId,
      );
      if (trackedNode) {
        const trackedPosition = resolveGalaxyPosition(
          trackedNode,
          time,
          reducedMotionRef.current,
        );
        target.focusX = -trackedPosition.x * 0.34;
        target.focusY = -trackedPosition.y * 0.34;
        target.focusZ = -trackedPosition.z * 0.12;
      }
    }
    const dt=lastFrameRef.current===null?1000/60:Math.min(80,Math.max(0,stamp-lastFrameRef.current));
    lastFrameRef.current=stamp;
    const settle = reducedMotionRef.current ? 1 : cameraDamping(dt);
    camera.yaw = lerp(camera.yaw, target.yaw, settle);
    camera.pitch = lerp(camera.pitch, target.pitch, settle);
    camera.zoom = lerp(camera.zoom, target.zoom, settle);
    camera.focusX = lerp(camera.focusX, target.focusX, settle);
    camera.focusY = lerp(camera.focusY, target.focusY, settle);
    camera.focusZ = lerp(camera.focusZ, target.focusZ, settle);

    const {hits,centre,holeRadius,pendingSprites}=paintUniverseFrame(context,width,height,camera,time,nodesRef.current,pharaohRef.current,selectedRef.current?.userId??null,hoveredRef.current?.userId??null,reducedMotionRef.current,spritesRef.current,mobile);
    hitsRef.current=hits;
    const hovered=hits.find(hit=>hit.player.userId===hoveredRef.current?.userId);
    if(hovered&&hoverLabelRef.current)hoverLabelRef.current.style.transform=`translate3d(${hovered.x}px,${hovered.y}px,0) translate(-50%,calc(-100% - 1rem))`;
    if(centreCaptionRef.current){centreCaptionRef.current.style.left=`${centre.x}px`;centreCaptionRef.current.style.top=`${centre.y+holeRadius*1.1}px`;}

    if (pageVisibleRef.current && (pendingSprites>0 || !reducedMotionRef.current ||
      Math.abs(camera.yaw - target.yaw) > 0.001 ||
      Math.abs(camera.pitch - target.pitch) > 0.001 ||
      Math.abs(camera.zoom - target.zoom) > 0.001 ||
      Math.abs(camera.focusX - target.focusX) > 0.001 ||
      Math.abs(camera.focusY - target.focusY) > 0.001 ||
      Math.abs(camera.focusZ - target.focusZ) > 0.001)) {
      frameRef.current = window.requestAnimationFrame(renderFrame);
    }
  }, []);

  const queueRender = useCallback(() => {
    if (frameRef.current === null) frameRef.current = window.requestAnimationFrame(renderScene);
  }, [renderScene]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncReduced = () => {
      const active = motionOverrideRef.current ?? !(reduced.matches || preferences.reducedMotion || preferences.dataSaver);
      reducedMotionRef.current = !active;
      clockRef.current.suspend();
      setMotionActive(active);
      queueRender();
    };
    syncReduced();
    reduced.addEventListener("change", syncReduced);
    return () => reduced.removeEventListener("change", syncReduced);
  }, [queueRender, preferences.reducedMotion, preferences.dataSaver]);

  useEffect(() => {
    const syncVisibility = () => {
      pageVisibleRef.current = document.visibilityState === "visible";
      clockRef.current.suspend();
      if (pageVisibleRef.current) {
        queueRender();
      } else if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, [queueRender]);

  useEffect(() => {
    queueRender();
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(queueRender);
    observer.observe(viewport);
    return () => {
      observer.disconnect();
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [nodes, pharaoh, queueRender]);

  const toggleMotion = useCallback(() => {
    const nextActive = reducedMotionRef.current;
    motionOverrideRef.current = nextActive;
    reducedMotionRef.current = !nextActive;
    clockRef.current.suspend();
    setMotionActive(nextActive);
    queueRender();
  }, [queueRender]);

  const findHit = useCallback((clientX: number, clientY: number): GalaxyHit | null => {
    const bounds = viewportRef.current?.getBoundingClientRect();
    if (!bounds) return null;
    const x = clientX - bounds.left;
    const y = clientY - bounds.top;
    for (const hit of hitsRef.current) {
      if (Math.hypot(x - hit.x, y - hit.y) <= hit.radius) return hit;
    }
    return null;
  }, []);

  const selectPlayer = useCallback((player: LeaderboardPlayer | null) => {
    setSelectedPlayer(player);
    setInfoPanelOpen(false);
    setRankListOpen(false);
    if (!player) {
      cameraTargetRef.current = { yaw: 0, pitch: 0, zoom: 1, focusX: 0, focusY: 0, focusZ: 0 };
      queueRender();
      return;
    }

    if (player.rank === 1) {
      cameraTargetRef.current = { yaw: 0, pitch: 0, zoom: 1.1, focusX: 0, focusY: 0, focusZ: 0 };
    } else {
      const node = nodesRef.current.find((candidate) => candidate.player.userId === player.userId);
      if (node) {
        const position = resolveGalaxyPosition(node, clockRef.current.time, reducedMotionRef.current);
        cameraTargetRef.current = {
          yaw: clamp(-position.x * 0.14, -0.16, 0.16),
          pitch: clamp(position.y * 0.11, -0.11, 0.11),
          zoom: window.innerWidth < 768 ? 1.16 : 1.24,
          focusX: -position.x * 0.34,
          focusY: -position.y * 0.34,
          focusZ: -position.z * 0.12,
        };
      }
    }
    queueRender();
  }, [queueRender]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    if(gesturePointsRef.current.has(event.pointerId))gesturePointsRef.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(gesturePointsRef.current.size===2){
      const [a,b]=[...gesturePointsRef.current.values()];const distance=Math.hypot(a.x-b.x,a.y-b.y);
      if(pinchRef.current && distance>0)cameraTargetRef.current.zoom=clamp(cameraTargetRef.current.zoom*distance/pinchRef.current,.65,2.2);
      pinchRef.current=distance;pointer.moved=true;queueRender();return;
    }

    if (pointer.down) {
      const deltaX = event.clientX - pointer.x;
      const deltaY = event.clientY - pointer.y;
      dragDistanceRef.current += Math.hypot(deltaX, deltaY);
      if (dragDistanceRef.current > 5) pointer.moved = true;
      cameraTargetRef.current.yaw += deltaX * 0.006;
      cameraTargetRef.current.pitch -= deltaY * 0.006;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      setHoverLabel(null);
    } else if (event.pointerType !== "touch") {
      const hit = findHit(event.clientX, event.clientY);
      if (hoveredRef.current?.userId !== hit?.player.userId) {
        hoveredRef.current = hit?.player ?? null;
        setHoverLabel(hit ? { player: hit.player, x: hit.x, y: hit.y } : null);
      }
      event.currentTarget.style.cursor = hit ? "pointer" : "grab";
    }
    queueRender();
  }, [findHit, queueRender]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    gesturePointsRef.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(gesturePointsRef.current.size===2){const [a,b]=[...gesturePointsRef.current.values()];pinchRef.current=Math.hypot(a.x-b.x,a.y-b.y);pointerRef.current.moved=true;return;}
    dragDistanceRef.current = 0;
    pointerRef.current = { down: true, moved: false, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.style.cursor = "grabbing";
  }, []);

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    gesturePointsRef.current.delete(event.pointerId);pinchRef.current=null;
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    if(gesturePointsRef.current.size){const next=[...gesturePointsRef.current.values()][0];pointer.x=next.x;pointer.y=next.y;pointer.moved=true;return;}
    if (!pointer.moved) {
      const hit = findHit(event.clientX, event.clientY);
      if (hit) selectPlayer(hit.player);
    }
    pointer.down = false;
    event.currentTarget.style.cursor = "grab";
  }, [findHit, selectPlayer]);

  const handleWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();
    cameraTargetRef.current.zoom = clamp(
      cameraTargetRef.current.zoom * (event.deltaY > 0 ? 0.92 : 1.08),
      0.65,
      2.2,
    );
    queueRender();
  }, [queueRender]);

  useEffect(()=>{
    const viewport=viewportRef.current;if(!viewport)return;
    viewport.addEventListener("wheel",handleWheel,{passive:false});
    return()=>viewport.removeEventListener("wheel",handleWheel);
  },[handleWheel]);

  return (
    <section className={`ap-scene ${styles.page}`}>
      <div className={styles.vignette} aria-hidden="true" />
      <SceneHeader eyebrow="The collective sky" title="Universe" description="One hundred galaxies. One centre of gravity.">
        <button className="ap-scene-button" aria-expanded={rankListOpen} onClick={()=>{setInfoPanelOpen(false);setRankListOpen(!rankListOpen)}}><AstralIcon name="search"/>Find a galaxy</button>
        <button className="ap-scene-button" aria-expanded={infoPanelOpen} onClick={()=>{setRankListOpen(false);setInfoPanelOpen(!infoPanelOpen)}}><AstralIcon name="info"/>Info</button>
      </SceneHeader>
      {rankListOpen?<aside ref={listRef} className="ap-scene-panel" role="dialog" aria-modal="true" aria-label="Find a ranked galaxy" tabIndex={-1}>
        <div className="ap-panel-heading"><h2>Find a galaxy</h2><button className="ap-scene-button" aria-label="Close rankings" onClick={()=>setRankListOpen(false)}><AstralIcon name="close"/></button></div>
        <label><span className="sr-only">Search by name or rank</span><input autoFocus placeholder="Name, username or rank" value={rankSearch} onChange={e=>setRankSearch(e.target.value)}/></label>
        {currentPlayer?<button className={styles.findMe} onClick={()=>{selectPlayer(currentPlayer);setRankListOpen(false)}}><AstralIcon name="constellation"/>Take me to my galaxy<span>#{currentPlayer.rank}</span></button>:null}
        <ol className={styles.rankList}>{players.filter(p=>!rankSearch.trim()||`${p.displayName} ${p.username} #${p.rank}`.toLowerCase().includes(rankSearch.toLowerCase().trim())).map(player=><li key={player.userId}><button onClick={()=>{selectPlayer(player);setRankListOpen(false)}}><span className={styles.listRank}>{String(player.rank).padStart(2,"0")}</span><span><strong>{player.displayName}</strong><small>{player.rank===1?"The Pharaoh":`@${player.username}`}</small></span><AstralIcon name="arrow"/></button></li>)}</ol>
        {!loading&&!players.some(p=>`${p.displayName} ${p.username} #${p.rank}`.toLowerCase().includes(rankSearch.toLowerCase().trim()))?<p className="ap-empty">No galaxies match your search.</p>:null}
      </aside>:null}
      {infoPanelOpen?<aside className="ap-scene-panel" aria-label="Universe information">
        <div className="ap-panel-heading"><h2>The ranked universe</h2><button className="ap-scene-button" onClick={()=>setInfoPanelOpen(false)} aria-label="Close information"><AstralIcon name="close"/></button></div>
        <p className={styles.infoDescription}>The Pharaoh is the black hole at the centre. Higher-ranked collections form larger galaxies in closer orbits.</p>
        <div className={styles.statsGrid}><RankStat label="Galaxies" value={loading?"—":formatWholeNumber(players.length)}/><RankStat label="Your rank" value={loading?"—":currentPlayer?`#${currentPlayer.rank}`:"Outside top 100"}/><RankStat label="Cards" value={formatWholeNumber(communityCards)}/><RankStat label="Wishes" value={formatWholeNumber(communityWishes)}/></div>
        <p className={styles.infoDescription}>Select a galaxy to explore its collection. Drag in any direction to orbit through 360°. Scroll or pinch to zoom. Reset returns to the original view.</p>
        <button className="ap-scene-button" disabled={refreshing} onClick={()=>void loadLeaderboard(true)}><AstralIcon name="reset"/>{refreshing?"Refreshing…":"Refresh ranks"}</button>
      </aside>:null}
      {errorMessage ? (
        <div className={styles.errorBanner} role="alert">
          <span>{errorMessage}</span>
          <button type="button" onClick={() => void loadLeaderboard(true)}>Try again</button>
        </div>
      ) : null}

      <div
        ref={viewportRef}
        className={styles.viewport}
        tabIndex={0}
        aria-describedby="universe-controls-hint"
        onKeyDown={event=>{
          const camera=cameraTargetRef.current;
          if(event.key==='ArrowLeft')camera.yaw-=.12;
          else if(event.key==='ArrowRight')camera.yaw+=.12;
          else if(event.key==='ArrowUp')camera.pitch-=.12;
          else if(event.key==='ArrowDown')camera.pitch+=.12;
          else if(event.key==='+'||event.key==='=')camera.zoom=clamp(camera.zoom*1.15,.65,2.2);
          else if(event.key==='-')camera.zoom=clamp(camera.zoom*.85,.65,2.2);
          else if(event.key==='0'||event.key==='Escape')selectPlayer(null);
          else return;
          event.preventDefault();queueRender();
        }}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={(event) => {
          pointerRef.current.down = false;
          gesturePointsRef.current.clear();pinchRef.current=null;
          event.currentTarget.style.cursor = "grab";
        }}
        onPointerLeave={() => {
          if (!pointerRef.current.down) {
            hoveredRef.current = null;
            setHoverLabel(null);
            queueRender();
          }
        }}
        aria-label="Interactive map of the top one hundred collections"
      >
        <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />

        {loading ? (
          <div className={styles.loadingState} role="status">
            <span><i /></span>
            <p>Mapping the universe</p>
          </div>
        ) : players.length === 0 ? (
          <div className={styles.emptyState}>
            <span aria-hidden="true">✦</span>
            <h2>The ranked universe is waiting.</h2>
            <p>The first collection will become its centre.</p>
          </div>
        ) : null}

        {hoverLabel && !selectedPlayer ? (
          <div
            ref={hoverLabelRef}
            className={styles.hoverLabel}
            style={{
              transform: "translate3d(" + hoverLabel.x + "px," + hoverLabel.y + "px,0) translate(-50%,calc(-100% - 1rem))",
            }}
            aria-hidden="true"
          >
            <small>{hoverLabel.player.rank === 1 ? "#1 · The Pharaoh" : "Rank #" + hoverLabel.player.rank}</small>
            <strong>{hoverLabel.player.displayName}</strong>
          </div>
        ) : null}

        {!loading && pharaoh && (!selectedPlayer || selectedPlayer.rank === 1) ? (
          <div ref={centreCaptionRef} className={styles.centreCaption} aria-hidden="true">
            <span>#1 · The Pharaoh</span>
            <strong>{pharaoh.displayName}</strong>
          </div>
        ) : null}
      </div>

      {!loading && players.length>0?<div className="ap-scene-dock" aria-label="Universe controls">
        <span aria-live="polite" className={motionActive?styles.liveStatus:styles.pausedStatus}><i/>{motionActive?"Orbiting":"Paused"}</span>
        <button onClick={toggleMotion} aria-pressed={!motionActive}>{motionActive?"Pause":"Play"}</button><span className="divider"/>
        <button aria-label="Zoom out" onClick={()=>{cameraTargetRef.current.zoom=clamp(cameraTargetRef.current.zoom*.85,.65,2.2);queueRender()}}>−</button>
        <button aria-label="Zoom in" onClick={()=>{cameraTargetRef.current.zoom=clamp(cameraTargetRef.current.zoom*1.15,.65,2.2);queueRender()}}>+</button>
        <button onClick={()=>selectPlayer(null)} aria-label="Return to centre"><AstralIcon name="reset"/></button>
      </div>:null}

      {selectedPlayer ? <RankDetails player={selectedPlayer} onClose={() => selectPlayer(null)} /> : null}

      <p id="universe-controls-hint" className="sr-only">Arrow keys rotate the universe. Plus and minus zoom. Zero returns to the centre. Find a galaxy lists every ranked collection.</p>
      <ol className="sr-only">
        {players.map((player) => (
          <li key={"accessible-" + (player.userId || player.rank)}>
            <button type="button" onClick={() => selectPlayer(player)}>
              Rank {player.rank}: {player.displayName}, {player.totalCards} cards
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function RankStat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.rankStat}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RankDetails({ player, onClose }: { player: LeaderboardPlayer; onClose: () => void }) {
  return (
    <aside className={styles.rankDetails} aria-label={player.displayName + " rank details"}>
      <div className={styles.detailHeading}>
        <div className={styles.detailIdentity}>
          <div className={styles.detailAvatar}>
            {player.avatarUrl ? (
              <Image src={player.avatarUrl} alt="" width={54} height={54} unoptimized />
            ) : player.displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p>{player.rank === 1 ? "The Pharaoh" : "Universe rank #" + player.rank}</p>
            <h2>{player.displayName}</h2>
            <span>@{player.username}</span>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close rank details">×</button>
      </div>

      {player.cosmicIssueNumber ? (
        <div className={styles.cosmicBadge}>✦ Cosmic discovery #{String(player.cosmicIssueNumber).padStart(6, "0")}</div>
      ) : null}

      <div className={styles.detailGrid}>
        <RankStat label="Cards" value={formatWholeNumber(player.totalCards)} />
        <RankStat label="Unique" value={formatWholeNumber(player.uniqueCards)} />
        <RankStat label="Wishes" value={formatWholeNumber(player.lifetimeWishes)} />
        <RankStat label="Value" value={formatMoney(player.collectionValue)} />
      </div>
      <Link className={styles.profileLink} href={`/friends/${encodeURIComponent(player.userId)}`}>Explore collection <AstralIcon name="arrow"/></Link>
      <div className={styles.scoreLine}>
        <span>Dynasty score</span>
        <strong>{formatWholeNumber(player.score)}</strong>
      </div>
    </aside>
  );
}
