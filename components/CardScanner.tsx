"use client";
/* eslint-disable @next/next/no-img-element -- camera/data URLs and database image hosts are dynamic */

import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { adminFetch } from "@/lib/admin/client-auth";
import {
  averageFingerprints,
  captureTrackedFrame,
  changedFraction,
  frameDifference,
  frameFingerprint,
  guideSourceCrop,
} from "@/lib/scanner/camera";
import {
  clearBenchmarkRecords,
  downloadBenchmarkRecords,
  downloadDiagnosticSnapshot,
  recordBenchmarkDecision,
} from "@/lib/scanner/benchmark";
import { CardIdentifier, shouldAutomaticallyAccept } from "@/lib/scanner/identify";
import type {
  ScannerAutoAddResult,
  ScannerCandidate,
  ScannerDebugSnapshot,
  ScannerIdentification,
  ScannerMachinePhase,
  ScannerMode,
  ScannerPokemonCard,
  TrackedFrame,
} from "@/lib/scanner/types";
import type { FrameFingerprint } from "@/lib/scanner/card-vision";

export type { ScannerAutoAddResult, ScannerPokemonCard } from "@/lib/scanner/types";

type CardScannerProps = {
  disabled?: boolean;
  resetKey?: number;
  onSelect: (card: ScannerPokemonCard) => void;
  onAutoAdd?: (card: ScannerPokemonCard) => Promise<ScannerAutoAddResult>;
  autoIntakeLabel?: string;
};

type QueuedCapture = {
  id: string;
  session: number;
  frames: TrackedFrame[];
  captureMs: number;
};

type ReviewItem = {
  id: string;
  preview: string;
  identification: ScannerIdentification;
};

type RecentAdd = {
  id: string;
  card: ScannerPokemonCard;
  message: string;
};

type VisualIndexStatus = {
  ok: true;
  total: number;
  indexed: number;
  nextOffset?: number;
  done?: boolean;
  generated?: number;
  failed?: number;
};

const VERSION = "51.1-image-first-diagnostics";
const SAMPLE_MS = 105;
const CALIBRATION_FRAMES = 8;
const MAX_TRACKED_FRAMES = 4;
const MAX_QUEUE = 10;
const CARD_ASPECT = 63 / 88;

function phaseCopy(phase: ScannerMachinePhase): string {
  const labels: Record<ScannerMachinePhase, string> = {
    off: "Camera off",
    calibrating: "Calibrating empty surface",
    searching: "Ready — place a card inside the guide",
    "card-entering": "Card detected — hold steady",
    tracking: "Capturing the clearest frames",
    queued: "Card queued for identification",
    "waiting-removal": "Captured — remove the card",
  };
  return labels[phase];
}

function confidenceTone(confidence: number): string {
  if (confidence >= 95) return "text-emerald-300 border-emerald-400/40 bg-emerald-400/10";
  if (confidence >= 80) return "text-amber-200 border-amber-400/40 bg-amber-400/10";
  return "text-rose-200 border-rose-400/40 bg-rose-400/10";
}

function collectorLabel(card: ScannerPokemonCard): string {
  const number = card.card_no || "?";
  const total = card.set_printed_total ? `/${card.set_printed_total}` : "";
  return `${number}${total}`;
}

function dataUrlFromCanvas(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/jpeg", 0.8);
}

function imageFileToFrame(file: File): Promise<TrackedFrame> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 756;
        canvas.height = Math.round(canvas.width / CARD_ASPECT);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Image canvas is unavailable.");
        const sourceAspect = image.naturalWidth / image.naturalHeight;
        let sx = 0;
        let sy = 0;
        let sw = image.naturalWidth;
        let sh = image.naturalHeight;
        if (sourceAspect > CARD_ASPECT) {
          sw = image.naturalHeight * CARD_ASPECT;
          sx = (image.naturalWidth - sw) / 2;
        } else {
          sh = image.naturalWidth / CARD_ASPECT;
          sy = (image.naturalHeight - sh) / 2;
        }
        context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        resolve({
          id: `upload-${Date.now()}`,
          canvas,
          preview: dataUrlFromCanvas(canvas),
          qualityWeight: 0.92,
          geometryConfidence: null,
          capturedAt: performance.now(),
        });
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That image could not be opened."));
    };
    image.src = url;
  });
}

function CandidateCard({
  candidate,
  onChoose,
  disabled,
}: {
  candidate: ScannerCandidate;
  onChoose: () => void;
  disabled: boolean;
}) {
  const image = candidate.card.image_url_large || candidate.card.image_url;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onChoose}
      className="group grid w-full grid-cols-[64px_1fr_auto] gap-3 rounded-2xl border border-white/10 bg-black/30 p-3 text-left transition hover:border-cyan-300/50 hover:bg-cyan-300/5 disabled:opacity-50"
    >
      <div className="aspect-[63/88] overflow-hidden rounded-lg bg-white/5">
        {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : null}
      </div>
      <div className="min-w-0 self-center">
        <div className="truncate font-black text-white">{candidate.card.name}</div>
        <div className="mt-1 text-xs text-slate-400">
          {candidate.card.set_name || candidate.card.set_id || "Unknown set"} · {collectorLabel(candidate.card)}
        </div>
        <div className="mt-2 line-clamp-2 text-[11px] text-slate-300">
          {candidate.reasons.join(" · ") || (candidate.visualConfidence !== null
            ? "Image-index candidate"
            : "OCR fallback candidate")}
        </div>
      </div>
      <div className={`self-start rounded-full border px-2.5 py-1 text-xs font-black ${confidenceTone(candidate.confidence)}`}>
        {candidate.confidence}%
      </div>
    </button>
  );
}

function DebugPanel({ snapshot }: { snapshot: ScannerDebugSnapshot }) {
  return (
    <div className="mt-5 space-y-4 rounded-2xl border border-fuchsia-400/25 bg-fuchsia-950/15 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="font-black text-fuchsia-100">Detection diagnostics</h4>
          <div className="mt-1 font-mono text-[10px] text-fuchsia-200/60">
            visual index {snapshot.visualIndex.ready
              ? `${snapshot.visualIndex.indexedCount.toLocaleString()} cards`
              : `${snapshot.visualIndex.indexedCount.toLocaleString()} / ${snapshot.visualIndex.totalCount.toLocaleString()} — not ready`}
          </div>
          {snapshot.visualIndex.error ? (
            <div className="mt-1 max-w-3xl text-xs font-bold text-rose-300">
              Visual search error: {snapshot.visualIndex.error}
            </div>
          ) : null}
        </div>
        <div className="font-mono text-[11px] text-fuchsia-200/70">
          capture {snapshot.timings.captureMs.toFixed(0)}ms · OCR {snapshot.timings.ocrMs.toFixed(0)}ms · candidates {snapshot.timings.candidateMs.toFixed(0)}ms · visual {snapshot.timings.visualMs.toFixed(0)}ms
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {["original", "canonical"].map((key) => (
          <figure key={key} className="overflow-hidden rounded-xl border border-white/10 bg-black/30 p-2">
            <img src={snapshot[key as "original" | "canonical"]} alt="" className="aspect-[63/88] w-full object-contain" />
            <figcaption className="mt-1 text-center font-mono text-[10px] uppercase text-slate-400">{key}</figcaption>
          </figure>
        ))}
        {Object.entries(snapshot.regions).map(([name, source]) => (
          <figure key={name} className="overflow-hidden rounded-xl border border-white/10 bg-black/30 p-2">
            <img src={source} alt="" className="h-24 w-full object-contain" />
            <figcaption className="mt-1 text-center font-mono text-[10px] uppercase text-slate-400">{name}</figcaption>
          </figure>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[680px] text-left text-[11px]">
          <thead className="bg-white/5 text-slate-400">
            <tr><th className="p-2">Candidate</th><th className="p-2">Total</th><th className="p-2">Number</th><th className="p-2">Set</th><th className="p-2">Name</th><th className="p-2">Visual</th><th className="p-2">Signals</th></tr>
          </thead>
          <tbody>
            {snapshot.candidates.map((candidate) => (
              <tr key={candidate.card.id} className="border-t border-white/10 text-slate-200">
                <td className="p-2 font-bold">{candidate.card.name} {collectorLabel(candidate.card)}</td>
                <td className="p-2">{candidate.confidence}%</td>
                <td className="p-2">{Math.round(candidate.evidence.collector * 100)}</td>
                <td className="p-2">{Math.round(candidate.evidence.set * 100)}</td>
                <td className="p-2">{Math.round(candidate.evidence.name * 100)}</td>
                <td className="p-2">{candidate.visualConfidence ?? "—"}</td>
                <td className="p-2">{candidate.evidenceCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="rounded-xl border border-white/10 bg-black/20 p-3">
        <summary className="cursor-pointer text-xs font-bold text-fuchsia-100">Raw OCR observations</summary>
        <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-[10px] text-slate-300">{JSON.stringify(snapshot.observations, null, 2)}</pre>
      </details>
    </div>
  );
}

export default function CardScanner({
  disabled = false,
  resetKey = 0,
  onSelect,
  onAutoAdd,
  autoIntakeLabel,
}: CardScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const identifierRef = useRef<CardIdentifier | null>(null);
  const queueRef = useRef<QueuedCapture[]>([]);
  const processingRef = useRef(false);
  const sessionRef = useRef(0);
  const baselineFramesRef = useRef<FrameFingerprint[]>([]);
  const baselineRef = useRef<FrameFingerprint | null>(null);
  const lastFingerprintRef = useRef<FrameFingerprint | null>(null);
  const trackedRef = useRef<TrackedFrame[]>([]);
  const captureStartedRef = useRef(0);
  const presenceRef = useRef(0);
  const absenceRef = useRef(0);
  const phaseRef = useRef<ScannerMachinePhase>("off");
  const stopVisualBuildRef = useRef(false);
  const visualBuildOffsetRef = useRef(0);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [phase, setPhaseState] = useState<ScannerMachinePhase>("off");
  const [mode, setMode] = useState<ScannerMode>(onAutoAdd ? "automatic" : "confirm");
  const [diagnostics, setDiagnostics] = useState(false);
  const [status, setStatus] = useState("Ready to scan");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [review, setReview] = useState<ReviewItem[]>([]);
  const [recentAdds, setRecentAdds] = useState<RecentAdd[]>([]);
  const [activeDebug, setActiveDebug] = useState<ScannerDebugSnapshot | null>(null);
  const [choosing, setChoosing] = useState<string | null>(null);
  const [visualIndexStatus, setVisualIndexStatus] = useState<VisualIndexStatus | null>(null);
  const [buildingVisualIndex, setBuildingVisualIndex] = useState(false);

  const setPhase = useCallback((next: ScannerMachinePhase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const progressHandler = useCallback((nextStatus: string, nextProgress: number) => {
    setStatus(nextStatus);
    setProgress(nextProgress);
  }, []);

  const refreshVisualIndex = useCallback(async () => {
    try {
      const result = await adminFetch<VisualIndexStatus>("/api/admin/scanner/visual-index");
      setVisualIndexStatus(result);
    } catch (caught) {
      setError(caught instanceof Error
        ? caught.message
        : "The visual index status could not be loaded. Run the V51 migration first.");
    }
  }, []);

  const toggleDiagnostics = useCallback(() => {
    const next = !diagnostics;
    setDiagnostics(next);
    if (next) void refreshVisualIndex();
  }, [diagnostics, refreshVisualIndex]);

  const buildVisualIndex = useCallback(async () => {
    if (buildingVisualIndex) {
      stopVisualBuildRef.current = true;
      return;
    }
    if (
      visualIndexStatus && visualIndexStatus.total > 0 &&
      visualIndexStatus.indexed >= visualIndexStatus.total
    ) {
      await refreshVisualIndex();
      return;
    }
    stopVisualBuildRef.current = false;
    setBuildingVisualIndex(true);
    setError(null);
    let offset = visualBuildOffsetRef.current;
    try {
      while (!stopVisualBuildRef.current) {
        const result = await adminFetch<VisualIndexStatus>("/api/admin/scanner/visual-index", {
          method: "POST",
          body: JSON.stringify({ offset, limit: 80 }),
        });
        setVisualIndexStatus(result);
        offset = result.nextOffset ?? offset + 80;
        visualBuildOffsetRef.current = offset;
        setStatus(`Building visual index: ${result.indexed.toLocaleString()} / ${result.total.toLocaleString()}`);
        if (result.done) {
          visualBuildOffsetRef.current = 0;
          break;
        }
      }
      setStatus(stopVisualBuildRef.current
        ? "Visual index build paused — resume whenever ready"
        : "Visual card index is ready");
    } catch (caught) {
      setError(caught instanceof Error
        ? caught.message
        : "The visual index build failed. Run the V51 migration and try again.");
    } finally {
      setBuildingVisualIndex(false);
      stopVisualBuildRef.current = false;
      void refreshVisualIndex();
    }
  }, [buildingVisualIndex, refreshVisualIndex, visualIndexStatus]);

  const ensureIdentifier = useCallback(() => {
    if (!identifierRef.current) identifierRef.current = new CardIdentifier(progressHandler);
    return identifierRef.current;
  }, [progressHandler]);

  const handleIdentification = useCallback(async (capture: QueuedCapture, result: ScannerIdentification) => {
    const best = result.candidates[0];
    setActiveDebug(result.debug);
    if (!result.debug.visualIndex.ready) {
      setReview((items) => [{
        id: capture.id,
        preview: capture.frames[0]?.preview || "",
        identification: result,
      }, ...items].slice(0, 10));
      setStatus("Visual index is not ready");
      setError(result.debug.visualIndex.error
        ? `Image-first recognition failed: ${result.debug.visualIndex.error}`
        : `Image-first recognition needs its visual index (${result.debug.visualIndex.indexedCount.toLocaleString()} / ${result.debug.visualIndex.totalCount.toLocaleString()}). Enable Diagnostics, run Build / resume visual index, and let it finish before scanning.`);
      return;
    }
    if (best && mode === "automatic" && onAutoAdd && shouldAutomaticallyAccept(result.candidates)) {
      try {
        const added = await onAutoAdd(best.card);
        setRecentAdds((items) => [{ id: capture.id, card: best.card, message: added.message }, ...items].slice(0, 8));
        setStatus(`${best.card.name} added automatically`);
        setError(null);
        return;
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "The card was identified but could not be added.");
      }
    }
    setReview((items) => [{
      id: capture.id,
      preview: capture.frames[0]?.preview || "",
      identification: result,
    }, ...items].slice(0, 10));
    setStatus(best ? `${best.card.name} needs confirmation` : "No safe match — try another angle");
  }, [mode, onAutoAdd]);

  const drainQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      while (queueRef.current.length) {
        const capture = queueRef.current.shift();
        setPendingCount(queueRef.current.length + 1);
        if (!capture) continue;
        try {
          const result = await ensureIdentifier().identify(capture.frames, capture.captureMs);
          await handleIdentification(capture, result);
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Card identification failed.");
          setStatus("Scanner needs attention");
        }
        setPendingCount(queueRef.current.length);
      }
    } finally {
      processingRef.current = false;
      setPendingCount(queueRef.current.length);
    }
  }, [ensureIdentifier, handleIdentification]);

  const queueCapture = useCallback((frames: TrackedFrame[], captureMs: number) => {
    if (!frames.length) return;
    const ranked = [...frames]
      .sort((left, right) => right.qualityWeight - left.qualityWeight)
      .slice(0, MAX_TRACKED_FRAMES);
    const item: QueuedCapture = {
      id: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      session: sessionRef.current,
      frames: ranked,
      captureMs,
    };
    if (queueRef.current.length >= MAX_QUEUE) queueRef.current.shift();
    queueRef.current.push(item);
    setPendingCount(queueRef.current.length + (processingRef.current ? 1 : 0));
    setPhase("queued");
    void drainQueue();
  }, [drainQueue, setPhase]);

  const stopCamera = useCallback(() => {
    sessionRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    baselineFramesRef.current = [];
    baselineRef.current = null;
    trackedRef.current = [];
    setCameraOpen(false);
    setPhase("off");
  }, [setPhase]);

  const startCamera = useCallback(async () => {
    if (disabled) return;
    setError(null);
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Camera preview is unavailable.");
      video.srcObject = stream;
      await video.play();
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & {
        focusMode?: string[];
        exposureMode?: string[];
        whiteBalanceMode?: string[];
      };
      const advanced: Record<string, string> = {};
      if (capabilities?.focusMode?.includes("continuous")) advanced.focusMode = "continuous";
      if (capabilities?.exposureMode?.includes("continuous")) advanced.exposureMode = "continuous";
      if (capabilities?.whiteBalanceMode?.includes("continuous")) advanced.whiteBalanceMode = "continuous";
      if (Object.keys(advanced).length) {
        await track.applyConstraints({ advanced: [advanced as MediaTrackConstraintSet] }).catch(() => undefined);
      }
      sessionRef.current += 1;
      baselineFramesRef.current = [];
      baselineRef.current = null;
      presenceRef.current = 0;
      absenceRef.current = 0;
      setCameraOpen(true);
      setPhase("calibrating");
      setStatus("Calibrating the empty card area");
    } catch (caught) {
      stopCamera();
      setError(caught instanceof Error ? caught.message : "Camera access was denied.");
    }
  }, [disabled, setPhase, stopCamera]);

  useEffect(() => {
    if (!cameraOpen) return;
    const interval = window.setInterval(() => {
      const video = videoRef.current;
      const viewport = viewportRef.current;
      const guide = guideRef.current;
      if (!video || !viewport || !guide || video.readyState < 2) return;
      const crop = guideSourceCrop(video, viewport, guide);
      const fingerprint = frameFingerprint(video, crop);
      if (!fingerprint) return;
      const currentPhase = phaseRef.current;
      if (currentPhase === "calibrating") {
        baselineFramesRef.current.push(fingerprint);
        if (baselineFramesRef.current.length >= CALIBRATION_FRAMES) {
          baselineRef.current = averageFingerprints(baselineFramesRef.current);
          lastFingerprintRef.current = fingerprint;
          setPhase("searching");
          setStatus("Ready for the next card");
        }
        return;
      }
      const baselineDelta = frameDifference(baselineRef.current, fingerprint);
      const changed = changedFraction(baselineRef.current, fingerprint, 0.055);
      const present = changed >= 0.13 || baselineDelta >= 5.5;
      if (currentPhase === "searching") {
        presenceRef.current = present ? presenceRef.current + 1 : 0;
        if (presenceRef.current >= 2) {
          trackedRef.current = [];
          captureStartedRef.current = performance.now();
          lastFingerprintRef.current = fingerprint;
          setPhase("card-entering");
        }
        return;
      }
      if (currentPhase === "card-entering" || currentPhase === "tracking") {
        if (!present) {
          presenceRef.current = 0;
          trackedRef.current = [];
          setPhase("searching");
          return;
        }
        const motion = frameDifference(lastFingerprintRef.current, fingerprint);
        lastFingerprintRef.current = fingerprint;
        if (motion <= 4.6 || performance.now() - captureStartedRef.current > 550) {
          setPhase("tracking");
          const frame = captureTrackedFrame(video, crop);
          const sufficientlyDifferent = trackedRef.current.every((item) =>
            Math.abs(item.qualityWeight - frame.qualityWeight) > 0.025 ||
            performance.now() - item.capturedAt > 180,
          );
          if (sufficientlyDifferent) trackedRef.current.push(frame);
        }
        const elapsed = performance.now() - captureStartedRef.current;
        if ((trackedRef.current.length >= 3 && elapsed >= 420) || elapsed >= 1050) {
          if (!trackedRef.current.length) trackedRef.current.push(captureTrackedFrame(video, crop));
          queueCapture(trackedRef.current, elapsed);
          trackedRef.current = [];
          absenceRef.current = 0;
          setPhase("waiting-removal");
        }
        return;
      }
      if (currentPhase === "waiting-removal" || currentPhase === "queued") {
        absenceRef.current = present ? 0 : absenceRef.current + 1;
        if (absenceRef.current >= 3) {
          presenceRef.current = 0;
          setPhase("searching");
        }
      }
    }, SAMPLE_MS);
    return () => window.clearInterval(interval);
  }, [cameraOpen, queueCapture, setPhase]);

  const captureNow = useCallback(() => {
    const video = videoRef.current;
    const viewport = viewportRef.current;
    const guide = guideRef.current;
    if (!video || !viewport || !guide || video.readyState < 2) return;
    const started = performance.now();
    const crop = guideSourceCrop(video, viewport, guide);
    queueCapture([captureTrackedFrame(video, crop)], performance.now() - started);
    setPhase("waiting-removal");
  }, [queueCapture, setPhase]);

  const uploadImage = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    try {
      const started = performance.now();
      const frame = await imageFileToFrame(file);
      queueCapture([frame], performance.now() - started);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The image could not be scanned.");
    }
  }, [queueCapture]);

  const chooseCandidate = useCallback(async (item: ReviewItem, candidate: ScannerCandidate) => {
    setChoosing(item.id);
    try {
      recordBenchmarkDecision(item.identification, candidate.card.id);
      if (onAutoAdd) {
        const added = await onAutoAdd(candidate.card);
        setRecentAdds((items) => [{ id: item.id, card: candidate.card, message: added.message }, ...items].slice(0, 8));
      } else {
        onSelect(candidate.card);
      }
      setReview((items) => items.filter((reviewItem) => reviewItem.id !== item.id));
      setStatus(`${candidate.card.name} selected`);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The selected card could not be added.");
    } finally {
      setChoosing(null);
    }
  }, [onAutoAdd, onSelect]);

  useEffect(() => {
    const reset = window.setTimeout(() => {
      stopCamera();
      queueRef.current = [];
      setPendingCount(0);
      setReview([]);
      setRecentAdds([]);
      setActiveDebug(null);
      setError(null);
    }, 0);
    return () => window.clearTimeout(reset);
  }, [resetKey, stopCamera]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    void identifierRef.current?.dispose();
  }, []);

  const headline = useMemo(() => {
    if (pendingCount) return `${pendingCount} card${pendingCount === 1 ? "" : "s"} in the recognition lane`;
    return phaseCopy(phase);
  }, [pendingCount, phase]);

  return (
    <section className="overflow-hidden rounded-[28px] border border-cyan-300/20 bg-[#06101c] text-white shadow-2xl shadow-cyan-950/30">
      <div className="border-b border-white/10 bg-gradient-to-r from-cyan-400/10 via-blue-500/5 to-fuchsia-500/10 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Ancient Pulls Intake</div>
            <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Image-first card scanner</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">Artwork and full-card appearance search the entire indexed catalogue first. OCR can confirm a result, but it can no longer hide the correct card from visual matching.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-right">
            <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Engine</div>
            <div className="font-mono text-xs font-bold text-cyan-200">v{VERSION}</div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {onAutoAdd ? (
            <div className="flex rounded-xl border border-white/10 bg-black/25 p-1">
              {(["automatic", "confirm"] as ScannerMode[]).map((value) => (
                <button key={value} type="button" onClick={() => setMode(value)} className={`rounded-lg px-3 py-2 text-xs font-black capitalize transition ${mode === value ? "bg-cyan-300 text-slate-950" : "text-slate-300 hover:bg-white/5"}`}>{value}</button>
              ))}
            </div>
          ) : null}
          <button type="button" onClick={toggleDiagnostics} className={`rounded-xl border px-3 py-2 text-xs font-black transition ${diagnostics ? "border-fuchsia-300 bg-fuchsia-300 text-slate-950" : "border-white/10 bg-black/25 text-slate-300 hover:border-fuchsia-300/50"}`}>Diagnostics {diagnostics ? "on" : "off"}</button>
          {diagnostics ? <button type="button" onClick={downloadBenchmarkRecords} className="rounded-xl border border-fuchsia-300/30 bg-fuchsia-300/5 px-3 py-2 text-xs font-black text-fuchsia-100 hover:bg-fuchsia-300/10">Export benchmark data</button> : null}
          {diagnostics && activeDebug ? <button type="button" onClick={() => downloadDiagnosticSnapshot(activeDebug)} className="rounded-xl border border-cyan-300/30 bg-cyan-300/5 px-3 py-2 text-xs font-black text-cyan-100 hover:bg-cyan-300/10">Export current diagnostic JSON</button> : null}
          {diagnostics ? <button type="button" onClick={clearBenchmarkRecords} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs font-bold text-slate-400 hover:text-white">Clear benchmark</button> : null}
          {autoIntakeLabel ? <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-slate-300">Destination: <span className="font-bold text-white">{autoIntakeLabel}</span></div> : null}
        </div>
        {diagnostics ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-3">
            <div className="min-w-[220px] flex-1">
              <div className="text-xs font-black text-cyan-100">Whole-catalogue visual index</div>
              <div className="mt-1 text-[11px] text-slate-400">
                {visualIndexStatus
                  ? `${visualIndexStatus.indexed.toLocaleString()} of ${visualIndexStatus.total.toLocaleString()} reference images indexed`
                  : "Load the index status, then build it once after installing the V51 migration."}
              </div>
              {visualIndexStatus?.total ? <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-cyan-300 transition-all" style={{ width: `${Math.min(100, visualIndexStatus.indexed / visualIndexStatus.total * 100)}%` }} /></div> : null}
            </div>
            <button type="button" onClick={() => void buildVisualIndex()} className={`rounded-xl px-4 py-2 text-xs font-black ${buildingVisualIndex ? "border border-amber-300/40 bg-amber-300/10 text-amber-100" : "bg-cyan-300 text-slate-950 hover:bg-cyan-200"}`}>
              {buildingVisualIndex ? "Pause visual build" : visualIndexStatus && visualIndexStatus.indexed >= visualIndexStatus.total && visualIndexStatus.total > 0 ? "Recheck index" : "Build / resume visual index"}
            </button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,.7fr)]">
        <div>
          <div ref={viewportRef} className="relative aspect-video overflow-hidden rounded-3xl border border-white/10 bg-black shadow-inner">
            <video ref={videoRef} muted playsInline className={`h-full w-full object-cover ${cameraOpen ? "opacity-100" : "opacity-0"}`} />
            {!cameraOpen ? (
              <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_45%,rgba(34,211,238,.12),transparent_42%)] p-8 text-center">
                <div>
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-cyan-300/30 bg-cyan-300/10 text-3xl">▣</div>
                  <div className="mt-4 text-lg font-black">Camera conveyor is paused</div>
                  <div className="mt-1 text-sm text-slate-400">Start the camera or test a saved card image.</div>
                </div>
              </div>
            ) : null}
            <div ref={guideRef} className={`pointer-events-none absolute left-1/2 top-1/2 aspect-[63/88] h-[88%] max-w-[82%] -translate-x-1/2 -translate-y-1/2 rounded-[5%] border-2 transition ${phase === "tracking" || phase === "card-entering" ? "border-amber-300 shadow-[0_0_35px_rgba(253,224,71,.35)]" : phase === "waiting-removal" || phase === "queued" ? "border-emerald-300 shadow-[0_0_35px_rgba(110,231,183,.3)]" : "border-cyan-300/75 shadow-[0_0_30px_rgba(34,211,238,.2)]"}`}>
              <span className="absolute -left-0.5 -top-0.5 h-8 w-8 rounded-tl-xl border-l-4 border-t-4 border-white" />
              <span className="absolute -right-0.5 -top-0.5 h-8 w-8 rounded-tr-xl border-r-4 border-t-4 border-white" />
              <span className="absolute -bottom-0.5 -left-0.5 h-8 w-8 rounded-bl-xl border-b-4 border-l-4 border-white" />
              <span className="absolute -bottom-0.5 -right-0.5 h-8 w-8 rounded-br-xl border-b-4 border-r-4 border-white" />
            </div>
            {cameraOpen ? <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/75 px-4 py-2 text-center text-xs font-black backdrop-blur">{headline}</div> : null}
          </div>

          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-r from-cyan-400 to-fuchsia-400 transition-all" style={{ width: `${progress}%` }} /></div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-black text-white">{status}</div>
              <div className="mt-0.5 text-xs text-slate-500">{cameraOpen ? "Keep the empty guide visible between cards for best separation." : "Portrait photos with the full card visible work best."}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {cameraOpen ? (
                <>
                  <button type="button" onClick={captureNow} disabled={disabled} className="rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 hover:bg-cyan-200 disabled:opacity-50">Capture now</button>
                  <button type="button" onClick={stopCamera} className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-black hover:bg-white/10">Stop</button>
                </>
              ) : (
                <button type="button" onClick={startCamera} disabled={disabled} className="rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-black text-slate-950 hover:bg-cyan-200 disabled:opacity-50">Start camera</button>
              )}
              <label className="cursor-pointer rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-black hover:bg-white/10">
                Test image<input type="file" accept="image/*" className="sr-only" onChange={uploadImage} disabled={disabled} />
              </label>
            </div>
          </div>
          {error ? <div className="mt-4 rounded-2xl border border-rose-400/35 bg-rose-400/10 p-4 text-sm font-bold text-rose-100">{error}</div> : null}
          {diagnostics && activeDebug ? <DebugPanel snapshot={activeDebug} /> : null}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-center justify-between gap-3"><h3 className="font-black">Recognition lane</h3><span className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-xs font-black text-cyan-200">{pendingCount} pending</span></div>
            <ol className="mt-4 space-y-3 text-xs text-slate-300">
              <li><span className="mr-2 font-black text-cyan-300">1</span> Detect and rectify the card boundary</li>
              <li><span className="mr-2 font-black text-cyan-300">2</span> Search every indexed card by artwork and layout</li>
              <li><span className="mr-2 font-black text-cyan-300">3</span> Use name, number, set and HP only to verify</li>
              <li><span className="mr-2 font-black text-cyan-300">4</span> Auto-add only after independent evidence agrees</li>
            </ol>
          </div>
          {recentAdds.length ? (
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
              <h3 className="font-black text-emerald-100">Recently added</h3>
              <div className="mt-3 space-y-2">{recentAdds.map((item) => <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="text-sm font-black">{item.card.name} · {collectorLabel(item.card)}</div><div className="mt-1 text-[11px] text-emerald-200/70">{item.message}</div></div>)}</div>
            </div>
          ) : null}
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-xs text-amber-100/80">
            <div className="font-black text-amber-100">Safe intake policy</div>
            <p className="mt-2 leading-relaxed">A plausible name alone never adds inventory. Automatic intake requires at least three agreeing signals and either exact number + set, or exact number + strong artwork.</p>
          </div>
        </aside>
      </div>

      {review.length ? (
        <div className="border-t border-white/10 bg-black/20 p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-2"><div><div className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">Human checkpoint</div><h3 className="mt-1 text-xl font-black">Confirm uncertain scans</h3></div><button type="button" onClick={() => setReview([])} className="text-xs font-bold text-slate-400 hover:text-white">Clear queue</button></div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {review.map((item) => (
              <article key={item.id} className="rounded-2xl border border-white/10 bg-[#081522] p-4">
                <div className="grid grid-cols-[74px_1fr] gap-3">
                  <img src={item.preview} alt="Captured card" className="aspect-[63/88] w-full rounded-lg object-cover" />
                  <div><div className="text-xs font-bold text-slate-400">Top catalogue matches</div><div className="mt-1 text-sm text-slate-300">Confidence {item.identification.confidence}% · margin {item.identification.margin.toFixed(0)} points</div></div>
                </div>
                <div className="mt-3 space-y-2">
                  {item.identification.candidates.length ? item.identification.candidates.slice(0, 3).map((candidate) => <CandidateCard key={candidate.card.id} candidate={candidate} disabled={disabled || choosing === item.id} onChoose={() => void chooseCandidate(item, candidate)} />) : <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400">No indexed visual candidate was available. Finish building the visual index, then retake with the complete artwork visible.</div>}
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
