# Ancient Pulls Scanner: Research Decision and Peak Implementation Prompt

**Date:** 24 August 2026  
**Project:** Ancient Pulls  
**Decision status:** Ready for implementation  

## Executive decision

The scanner should be rebuilt as a **closed-set visual identification system**, not improved as an OCR system.

The strongest production architecture for Ancient Pulls is:

1. controlled, automatic card capture;
2. perspective-normalised high-resolution card images;
3. learned visual embeddings and an in-memory approximate-nearest-neighbour index for fast whole-catalogue retrieval;
4. learned local-feature matching plus homography/geometric verification against the shortlist;
5. high-resolution set-symbol/footer comparison and candidate-constrained text recognition only to separate same-art reprints and variants;
6. two-frame agreement and calibrated rejection;
7. an idempotent, atomic inventory write;
8. a persistent FIFO pipeline that never drops a captured card.

This deliberately copies the **proven architecture**, not proprietary source code. Collectors/PSA describes using pretrained CNN feature vectors plus approximate-nearest-neighbour search for exact collectible identification in an operation processing 40,000–45,000 cards per day. Ancient Pulls should adopt that industrial pattern, then add modern geometric verification and exact footer analysis for Pokémon variants. [Collectors engineering account](https://blog.collectors.com/image-search/)

For open components, use the Apache-2.0-licensed XFeat and LightGlue implementations as evaluated building blocks. XFeat is designed for real-time learned local features on constrained hardware; LightGlue provides fast, adaptive local-feature matching. Do not copy the GPL Pokémon recognizer into Ancient Pulls. [XFeat](https://github.com/verlab/accelerated_features) · [LightGlue](https://github.com/cvg/LightGlue)

## The non-negotiable truth about “100%”

No camera recognition system can guarantee a correct answer for every arbitrary input. A covered collector number, unseen card, severe glare, motion blur, counterfeit, catalogue error, or visually indistinguishable finish can remove the evidence required to determine identity.

The correct production definition of perfection is therefore:

> **Zero wrong automatic inventory writes. If identity is not proven, reject the capture and do not mutate inventory.**

This is how industrial systems behave. The PhyzBatch-9000 is the strongest public conveyor benchmark found: it advertises 3,600 cards/hour, 98% identification coverage, and 99.97% name fidelity, while explicitly saying the fidelity statistic does not cover set or variant misattribution. [TCG Machines specifications](https://tcgmachines.com/)

TCGplayer also warns that its scanner does not always identify the correct set where artwork was reprinted and instructs users to verify the result. [TCGplayer scanning guidance](https://help.tcgplayer.com/hc/en-us/articles/115009674788-Tips-for-Accurate-Scanning)

Ancient Pulls can require **100% correctness across the locked acceptance benchmark** before release, then preserve record correctness in production through fail-closed thresholds. It cannot honestly promise 100% recognition coverage.

## Existing scanner audit

### Measured evidence

The supplied benchmark contains one operator-confirmed case:

| Metric | Result |
| --- | ---: |
| Samples | 1 |
| Correct | 1 |
| Reported confidence | 94% |
| Capture | 580.1 ms |
| OCR | 1,623.5 ms |
| Candidate lookup | 577.7 ms |
| Visual matching | 1,745.3 ms |
| Total | 3,950.2 ms |

One successful case is not an accuracy benchmark. It cannot establish the failure rate, calibrate confidence, expose hard-negative collisions, or justify automatic inventory writes.

### Root causes in the current code

1. **The visual representation is too lossy.**
   - The reference fingerprint reduces the full card to 12×17 luminance samples, artwork to 12×8 luminance samples, and artwork colour to 6×4 samples.
   - That discards the collector number, set symbol detail, copyright line, small typography, and most exact-layout evidence.
   - Old yellow-border cards and cards with similar composition naturally collide, which explains unrelated Base/Jungle/Fossil candidates receiving almost identical scores.

2. **Search is a full JavaScript catalogue scan.**
   - Every request loads/decode-caches fingerprint rows from Supabase and compares every captured orientation against every catalogue row.
   - The algorithm is O(number of cards × frames × orientations × fingerprint size), followed by another database fetch for the top IDs.
   - This produced a measured 1.745-second visual stage and is vulnerable to serverless cold starts.

3. **OCR remains expensive and noisy.**
   - Tesseract is initialised in the browser and performs several sequential recognitions across name, number, alternate footer, set, and HP regions over as many as three frames.
   - The supplied Trumbeak observations hallucinated set codes such as `BETS`, `AINE`, `FREA`, `11EXD`, and `RAMS` and failed to recover the clear `067/084` consistently.
   - OCR takes 1.624 seconds in the only labelled benchmark and should not be on the critical path.

4. **Capture intentionally waits too long.**
   - The state machine waits for presence, motion settling, and three tracked frames, with a 420–1,050 ms capture window.
   - A one-card-per-second workflow cannot afford to spend up to the whole second before recognition starts.

5. **Processing is serial and the queue can lose cards.**
   - A single `drainQueue` loop awaits identification and inventory insertion for one item before processing the next.
   - The queue is capped at ten items and silently removes the oldest item when full.
   - At the measured 3.95 seconds per item, a one-card-per-second stream grows faster than it drains and eventually loses captures.

6. **Confidence is heuristic, not calibrated.**
   - Confidence is assembled from hand-set score weights, evidence counts, and margins.
   - OCR hallucinations can increase the apparent number of signals.
   - No held-out calibration set maps a score to an observed error probability.

7. **Inventory writes are not exactly-once.**
   - The current auto-add sends no capture idempotency key.
   - Inventory quantity uses a read-modify-write flow rather than one atomic, idempotent database transaction.
   - A retry, double response, concurrent admin action, or race can add twice or lose an increment.
   - Audit-log failure is currently allowed after the inventory mutation, so the physical quantity and its audit history can diverge.

8. **The catalogue is part of the accuracy problem.**
   - Prior QA found duplicate or ambiguous catalogue data.
   - Recognition cannot be more exact than its canonical catalogue, reference images, variant model, and index completeness.

### What should be preserved

- automatic presence/removal state machine as a UX concept;
- camera constraint setup and environmental calibration;
- perspective correction as a first-class stage;
- diagnostic crops and timing visibility;
- human-review queue for rejected scans;
- direct inventory destination/finish controls;
- canonical `pokemon_cards.id` as the identity written to inventory;
- resumable offline index-building as an operational concept, replaced by a versioned build job.

## Research comparison

| System or method | Public evidence | Strength | Limitation for Ancient Pulls | Decision |
| --- | --- | --- | --- | --- |
| TCG Machines PhyzBatch-9000 | 3,600 cards/hour; 98% identification; 99.97% name fidelity | Best public conveyor throughput evidence | Proprietary hardware; published fidelity excludes exact set/variant | Use as throughput and fail-bin reference |
| Collectors/PSA visual search | 40,000–45,000 cards/day; CNN feature vectors + ANN | Proven exact-collectible retrieval architecture at scale | Internal/proprietary implementation | Copy architecture, not source |
| Ximilar TCG Identifier | Usually about one second; returns name, set, code, number, rarity, year; intended for sorting machines | Ready commercial API and useful comparison baseline | Network/vendor dependency; no independent Ancient Pulls benchmark | Optional shadow/bake-off adapter |
| CardSight | Vendor claims 99.5% identification and broad input handling | Purpose-built card API | Marketing claim needs independent testing; proprietary | Optional shadow/bake-off adapter |
| SortSwift | Vendor claims ~2 seconds and 99.9% high-accuracy mode; includes review | Browser/scanner workflow and review model | Slower than target; proprietary; still uses review | UX/operations reference only |
| TCGplayer | Widely deployed mobile scanner | Mature card workflow | Officially warns of same-art set mistakes | Do not use as exactness reference |
| Card Dealer Pro + Ricoh fi-8170 | Capture up to 70 cards/minute; recommended high-volume ingest | Proves capture can exceed one card/second | Capture and AI completion are separate; proprietary batch workflow | Optional future ADF ingest |
| pHash/dHash/wHash | Simple and fast | Useful coarse duplicate signal | Sensitive to crop, brightness and rotation; collisions grow with catalogue | Diagnostic signal only |
| ORB/SIFT-only catalogue search | Classical, explainable geometric evidence | Good verifier for a small shortlist | Quality falls at catalogue scale; busy/text-heavy cards are difficult | Verifier/fallback, not retrieval |
| Generic OCR | Reads visible metadata | Can distinguish same-art versions after shortlist | Slow and hallucinates under glare/blur/layout shifts | Candidate-constrained tie-breaker only |
| Generic VLM/LLM vision call | Easy prototype | Broad reasoning | Variable latency/cost, non-determinism, hallucination, weak exact-ID guarantee | Never use for automatic logging |
| Fine-tuned embedding retrieval + XFeat/LightGlue + exact ROI checks | ANN speed plus independent geometric and micro-detail evidence | Best balance of throughput, catalogue scale, and exactness | Requires a real dataset and dedicated recognition service | **Selected** |

Commercial facts above come from the vendors and are not treated as independently verified accuracy measurements. Sources: [Ximilar](https://www.ximilar.com/blog/build-your-own-trading-card-game-identifier-with-our-api/), [CardSight](https://cardsight.ai/solutions/identification), [SortSwift](https://sortswift.com/features/scanning), [Card Dealer Pro](https://www.carddealerpro.com/best-card-scanners).

## Selected production architecture

### 1. Controlled capture station

The performance guarantee applies only inside a declared operating envelope:

- fixed phone/webcam stand;
- matte, patternless background contrasting with the card border;
- two diffuse lights at opposing angles;
- no direct flash hotspot;
- entire card visible with margin;
- camera at a fixed distance;
- continuous focus/exposure during warm-up, then lock where supported;
- sleeves permitted only when flat and low-glare;
- top loaders accepted as a slower/reject-prone mode;
- only one card in the active gate at once.

These are engineering inputs, not user niceties. TCGplayer itself recommends a plain contrasting background, a fully visible card, and glare reduction. The guaranteed mode must display a live quality gate and refuse capture outside the envelope.

### 2. Browser capture pipeline

- Replace the 105 ms interval with `requestVideoFrameCallback` when available and a safe fallback.
- Move frame analysis to a Worker/OffscreenCanvas path so camera analysis does not block React rendering.
- Detect one quadrilateral matching the 63:88 card ratio.
- Compute blur, clipped highlights, glare by region, border coverage, perspective residual, and motion.
- Capture two high-quality frames approximately 80–120 ms apart once stable.
- Rectify to a canonical 756×1056 or greater image; keep a lossless/high-quality footer ROI.
- Assign a cryptographically strong `capture_id` immediately.
- Persist the capture event to IndexedDB before sending it.
- Show “captured” feedback in under 50 ms without waiting for recognition.
- Require physical removal/change before rearming so one card cannot be counted twice.

### 3. Warm recognition service

Do not run the peak recognition path inside a cold Vercel function. Use an always-warm service with bounded concurrency, model/index health checks, and the complete index resident in memory. The Next.js application remains the authenticated UI and control plane.

The service pipeline is:

1. validate request, model version, index version, image quality, and card geometry;
2. compute embeddings for full-card, artwork, and footer/layout views;
3. query a FAISS HNSW/flat index for the top 50 canonical cards;
4. rerank the top 10 using XFeat local descriptors and LightGlue matching;
5. require a valid RANSAC homography and strong inlier distribution over both artwork and printed detail;
6. align the top candidates and compare high-resolution header, set-symbol, and footer ROIs;
7. perform candidate-constrained footer recognition only for remaining ambiguities;
8. combine both captured frames and reject if their top identity differs;
9. calibrate the final probability using held-out real scans, not hand-authored percentages;
10. return an explicit accepted/rejected result with evidence and reason codes.

FAISS is designed for efficient dense-vector similarity search and is appropriate for an in-memory catalogue index. [FAISS documentation](https://faiss.ai/index.html)

The baseline embedding model should be a small DINOv2-derived or comparably strong instance-retrieval encoder fine-tuned with metric learning on canonical card images plus realistic camera augmentations. DINOv2 supplies strong global and local visual representations, but the final model must be chosen by Ancient Pulls' held-out exact-card benchmark rather than reputation. [DINOv2 paper](https://arxiv.org/abs/2304.07193)

XFeat and LightGlue provide the independent spatial check. LightGlue reports 20 FPS at 512 keypoints on an Intel i7-10700K and substantially higher GPU throughput; XFeat reports real-time VGA inference on an i5 CPU and stronger illumination/viewpoint robustness than ORB/SIFT. These published timings are feasibility evidence, not Ancient Pulls latency results. [LightGlue benchmarks](https://github.com/cvg/LightGlue#benchmark) · [XFeat implementation](https://github.com/verlab/accelerated_features)

OpenCV homography remains useful for validating that matched points describe one physically plausible card plane rather than coincidental local similarities. [OpenCV feature matching and homography](https://docs.opencv.org/5.0/py_tutorials/py_features/py_feature_homography/py_feature_homography.html)

### 4. Catalogue and index contract

Before recognition can be trusted:

- define one canonical card identity and variant schema;
- remove or explicitly alias duplicate records;
- require a valid reference image for every scannable identity;
- store language, set, collector number, printed total, edition, regulation mark, rarity and layout era where available;
- keep finish separate from printed-card identity unless the reference catalogue models finishes distinctly;
- hash every canonical reference image;
- version the catalogue, model, embeddings, local descriptors, and thresholds together;
- build indexes offline in CI/job infrastructure, never from an admin browser button;
- refuse automatic mode unless coverage is exactly 100% for the declared scannable catalogue;
- retain the previous verified index for instant rollback.

### 5. Exact variant resolution

Whole-card artwork is not enough because Pokémon artwork is reused. Exact set resolution must use the highest-resolution differentiating evidence:

- collector fraction;
- set symbol or set code;
- footer/copyright line;
- regulation mark;
- edition stamp;
- card layout/template;
- exact typography and micro-positioning;
- language.

Do not let free OCR create an unlimited candidate list. After visual retrieval, the recognizer already knows the small set of possible strings. Decode only against those candidate strings and reject when the pixels do not distinguish them.

Finish (`normal`, `holo`, `reverse_holo`) should remain an operator/session setting until a controlled multi-angle lighting module is separately trained and validated. A single still RGB frame cannot reliably prove every reflective finish.

### 6. Decision policy

Automatic acceptance requires all of the following:

- model and index versions are healthy and complete;
- both frames independently return the same canonical card ID;
- embedding retrieval score passes its calibrated threshold;
- geometric verification passes its calibrated inlier and coverage thresholds;
- exact header/footer/symbol evidence does not conflict;
- top-1 versus top-2 margin passes the hard-negative threshold;
- the result is not out-of-distribution;
- no known ambiguity group remains unresolved;
- the capture has not previously been committed.

Thresholds must be learned from the validation corpus. Do not hard-code “95” and call it confidence.

Possible outcomes are:

- `accepted`: identity proven; inventory transaction may run;
- `rejected_quality`: capture is unreadable; ask for another pass;
- `rejected_ambiguous`: two or more exact identities remain plausible; queue for review;
- `rejected_unknown`: image is not a supported catalogue card;
- `rejected_system`: index/model/service is not trustworthy; pause auto mode.

### 7. One-card-per-second pipeline

Throughput and latency are separate. The scanner must acknowledge capture immediately and pipeline independent work:

| Stage | Target warm p50 | Target warm p95 |
| --- | ---: | ---: |
| Presence/stability decision after card settles | ≤120 ms | ≤220 ms |
| Rectification + quality gate | ≤35 ms | ≤70 ms |
| Encode + ANN shortlist | ≤70 ms | ≤150 ms |
| Geometric/ROI rerank | ≤140 ms | ≤350 ms |
| Decision + response | ≤30 ms | ≤60 ms |
| Atomic inventory commit | ≤80 ms | ≤150 ms |
| End-to-end stable-card to durable result | ≤475 ms | ≤900 ms |

Requirements:

- at least four bounded recognition workers or equivalent batching;
- persistent FIFO event queue;
- no `shift()`-and-forget overflow policy;
- explicit backpressure before capacity is exceeded;
- maximum queue depth visible to the operator;
- recovery after refresh, disconnect, or service restart;
- results displayed in physical capture order even if inference completes out of order;
- 3,600 sequential card events over one hour with zero dropped, duplicated, or reordered commits.

### 8. Exactly-once inventory logging

Create a database RPC/transaction that accepts:

- `capture_id`;
- `scan_session_id`;
- canonical `card_id`;
- finish;
- location;
- quantity;
- model/index versions;
- calibrated confidence and evidence summary;
- captured timestamp and sequence number.

The transaction must:

1. insert the immutable scan event under a unique `(scan_session_id, capture_id)` constraint;
2. atomically increment the correct inventory row;
3. write the audit event in the same transaction;
4. return the already-committed result on retry;
5. never apply the quantity twice;
6. never update inventory if the scan event is rejected;
7. preserve sequence and traceability.

### 9. Benchmark and proof programme

The current localStorage benchmark must be replaced with a durable, replayable corpus.

Minimum release corpus:

- at least 10,000 real captures;
- at least 2,000 distinct canonical card IDs;
- every supported layout era;
- deliberate same-art reprints and same-name hard negatives;
- Base/Jungle/Fossil and WOTC variants;
- modern full-art, Trainer, Energy, promo and regulation-mark layouts;
- normal lighting, low light, warm/cool light, moderate glare, blur and perspective;
- raw, penny sleeve and supported top-loader conditions;
- iPhone/Safari, Android/Chrome and desktop webcam capture;
- unknown cards, card backs, non-card objects and partially occluded cards;
- repeated physical passes to test duplicate suppression.

Split by **physical capture session and card identity**, not random frame, so near-duplicate frames cannot leak into training and validation.

Release gates:

| Gate | Required result |
| --- | --- |
| Wrong automatic inventory writes on locked benchmark | **0** |
| Top-1 exact card ID among auto-accepted scans | **100% on locked suite** |
| Catalogue/index coverage for declared scope | **100%** |
| One-hour 1 card/second soak | **3,600/3,600 captured and exactly-once committed or explicitly rejected** |
| Dropped captures | **0** |
| Duplicate inventory commits | **0** |
| Out-of-order inventory audit sequence | **0** |
| Warm end-to-end latency | p50 ≤475 ms; p95 ≤900 ms |
| Cold/warm readiness | auto mode unavailable until service and index are ready |
| Regression determinism | identical corpus + versions produce identical decisions |

Also report auto-accept coverage, rejection rate, per-era accuracy, ambiguity-group accuracy, calibration error, confusion pairs, p50/p95/p99 latency, and queue depth. Never hide rejected cases inside an “accuracy” percentage.

### 10. Rollout

1. Build the benchmark and catalogue validator first.
2. Replay the current scanner as a frozen baseline.
3. Implement the new recognizer behind a feature flag.
4. Run it in shadow mode without inventory mutation.
5. Optionally call Ximilar/CardSight/TinEye through a vendor adapter on the same corpus for an empirical bake-off; never choose from marketing claims.
6. Tune thresholds only on training/validation data.
7. Lock the test set and require all release gates.
8. Enable auto mode for a small admin cohort.
9. Keep every rejection and operator correction as future labelled data.
10. Roll back automatically if wrong-ID, service-health, queue, or latency alarms fire.

---

# Copy-paste implementation prompt

Use the following prompt for the implementation phase.

```text
You are working directly inside the existing Ancient Pulls codebase.

Your task is to replace the current V51.1 scanner with a production-grade, image-first, exact-card recognition and inventory pipeline capable of sustaining one physical card per second.

This is an implementation task, not another proposal. Audit first, then build, migrate, test, benchmark, and deliver the working result. Preserve the current Ancient Pulls appearance and all unrelated functionality. Where files change, provide complete production-ready replacements. Do not leave TODOs, placeholders, mocked accuracy, or unverified claims.

READ FIRST

1. Read AGENTS.md and the locally installed Next.js 16 documentation relevant to every framework feature you change.
2. Inspect the complete scanner path: camera, frame gate, rectification, OCR, visual fingerprints, candidate APIs, confidence, queue, review UI, auto-add handler, inventory API, audit event, migrations, diagnostics, and benchmark scripts.
3. Preserve the canonical pokemon_cards table and its card IDs. Do not create a disconnected second card catalogue.
4. Treat the supplied one-case 3,950.2 ms benchmark only as a baseline, never as accuracy proof.

PRODUCT CONTRACT

- “Perfect” means zero wrong automatic inventory writes.
- If exact identity is not proven, reject the scan and do not mutate inventory.
- The scanner must accept a new physical card every second while prior cards continue through a bounded pipeline.
- It must never silently drop, duplicate, reorder, or double-add a capture.
- The UI must acknowledge a valid capture in under 50 ms without waiting for recognition.
- Automatic mode must remain disabled until the catalogue, model, index, service and database transaction report healthy compatible versions.

DO NOT

- do not run whole-frame OCR;
- do not let OCR independently generate or dominate candidates;
- do not use a generic VLM/LLM call for automatic identity;
- do not retain the 12×17/12×8 compact fingerprint as the primary recognizer;
- do not scan every catalogue row in JavaScript per request;
- do not process the queue serially;
- do not drop the oldest queue item on overflow;
- do not label a heuristic score as probability/confidence;
- do not use a cold Vercel function as the peak model/index runtime;
- do not auto-detect foil/reverse-holo from one still frame without a separately validated controlled-lighting model;
- do not copy GPL scanner code into this project;
- do not claim 100% production recognition coverage.

TARGET ARCHITECTURE

A. Controlled browser capture

- Use requestVideoFrameCallback with a safe fallback.
- Move continuous pixel analysis off React’s render path using a Worker and OffscreenCanvas where supported.
- Detect one 63:88 quadrilateral; validate coverage, perspective residual, blur, glare, clipping and motion.
- Rectify the card to at least the current 756×1056 detail level.
- Capture two sharp frames 80–120 ms apart once stable; do not wait 420–1,050 ms for three frames.
- Generate a strong capture_id immediately and persist the event and frames/ROIs in IndexedDB before network submission.
- Require physical removal or a sufficiently different card fingerprint before rearming.
- Preserve a manual-capture and image-upload path through the same recognition pipeline.

B. Versioned recognition service

- Add an always-warm, independently deployable recognition service with bounded concurrent workers, health/readiness endpoints, structured logs, and model/index version reporting.
- Keep auth and permissions compatible with the existing admin application; never expose service secrets in the browser.
- Precompute a versioned index from every valid pokemon_cards reference image.
- Compute learned full-card, artwork and footer/layout embeddings.
- Use FAISS for in-memory ANN retrieval of top 50 candidates.
- Establish a DINOv2-small-derived metric-learning baseline, but run a documented ablation against at least one smaller encoder and select the fastest model that passes the locked exact-ID benchmark.
- Fine-tune only with a training split containing realistic perspective, crop, blur, exposure, white-balance, glare, sleeve and compression augmentations. Never train on locked test captures.
- Precompute XFeat local descriptors for canonical images.
- Rerank the ANN top 10 with XFeat + LightGlue, then RANSAC homography and spatial-inlier coverage.
- Perform high-resolution aligned comparisons of the header, set symbol, regulation mark and footer.
- Use candidate-constrained footer text recognition only when visually similar candidates remain. It may choose only from strings belonging to retrieved candidates.
- Require both captured frames to agree.
- Implement explicit out-of-distribution and ambiguity rejection.
- Return accepted, rejected_quality, rejected_ambiguous, rejected_unknown or rejected_system with evidence and machine-readable reason codes.

C. Catalogue/index integrity

- Add a validator for duplicate IDs, duplicate semantic identities, missing/invalid images, inconsistent set/collector metadata, and unsupported variants.
- Define and document canonical identity versus finish.
- Version catalogue, reference hashes, encoder, embeddings, local descriptors, calibrator and thresholds together.
- Build indexes in a job/CLI, not an admin browser loop.
- Require exactly 100% index coverage for the declared auto-scan scope.
- Retain an atomic previous-index rollback.

D. Calibrated decision engine

- Train/calibrate the final decision on held-out real captures.
- Auto-accept only when two-frame identity, ANN score, geometric inliers/coverage, exact ROI evidence, top-1 margin, OOD check and ambiguity-group rules all pass.
- Never use a fixed display value such as 95 as a substitute for calibration.
- Expose separate retrieval, geometry, footer, temporal and final calibrated scores in diagnostics.
- Preserve a clear human review queue, but rejected items must never affect inventory until explicitly chosen.

E. Persistent concurrent pipeline

- Replace the in-memory ten-item lossy queue with a persistent FIFO scan-event queue.
- Support at least four bounded concurrent recognition jobs or equivalent micro-batching.
- Preserve display and commit order by sequence number even if inference completes out of order.
- Apply backpressure and visibly pause capture before storage capacity is exhausted; never discard a capture.
- Resume pending events after refresh, reconnect or service restart.
- Surface queue depth, oldest age, throughput, rejection reason and service readiness.

F. Exactly-once inventory transaction

- Add migrations for immutable scan sessions/events and required unique constraints.
- Implement one database RPC/transaction keyed by scan_session_id + capture_id.
- In the same transaction: create/reuse the scan event, atomically increment the correct inventory row, and create the audit record.
- A retry must return the original committed result and must never increment twice.
- Remove the scanner’s current read-modify-write race and the possibility of inventory succeeding while its scan audit fails.
- Record card ID, finish, location, quantity, sequence, captured time, model/index versions, final calibrated score and compact evidence summary.

G. Benchmark system

- Replace the 500-item localStorage benchmark with a durable, replayable corpus and CLI.
- Store expected canonical ID, raw/canonical frames, environment tags, acceptance outcome, candidate list, evidence, versions and per-stage timings.
- Split by physical session and card identity to prevent frame leakage.
- Include at least 10,000 real captures covering at least 2,000 card IDs, all supported layout eras, same-art reprints, hard negatives, Base/Jungle/Fossil, modern cards, Trainers, Energy, promos, sleeves, top loaders, glare, blur, perspective, multiple camera/browser classes, unknown objects and duplicate-pass tests.
- Freeze the existing scanner as a baseline and publish side-by-side metrics.
- Optionally implement vendor adapters for Ximilar, CardSight and TinEye so the same corpus can establish whether any vendor actually outperforms the owned engine. Keep vendor calls out of the required critical path unless measured results justify them.

RELEASE GATES

Do not enable automatic inventory mode unless all gates pass:

1. 0 wrong automatic inventory writes on the locked benchmark.
2. 100% exact canonical card ID among auto-accepted locked test cases; rejected cases are reported separately.
3. 100% index coverage for the declared scanner scope.
4. One-hour soak at 1 card/second: all 3,600 events are captured and either exactly-once committed or explicitly rejected.
5. 0 dropped captures, duplicate commits, and out-of-order audit sequences.
6. Warm stable-card-to-durable-result latency: p50 <= 475 ms and p95 <= 900 ms on the declared production hardware/service.
7. Deterministic replay for identical corpus and version bundle.
8. TypeScript check and production build pass.
9. Focused lint on all changed production files has zero errors.
10. Database migrations are forward-safe and rollback is documented.

Also report auto-accept coverage, rejection rate, exact top-1/top-3, per-era results, hard-negative confusion pairs, calibration error, p50/p95/p99 stage timings, sustained throughput, maximum queue depth, service resource usage and cost per 1,000 scans.

HARDWARE/OPERATING ENVELOPE

Document and enforce the guaranteed station setup: fixed stand, matte contrasting background, two diffuse opposing lights, full-card visibility, one card at a time, and supported sleeve/top-loader rules. Auto mode must show actionable quality feedback and refuse out-of-envelope captures.

DELIVERABLES

- complete changed source files;
- new recognition service and deployment configuration;
- Supabase migrations and atomic RPC;
- catalogue/index build CLI and rollback path;
- model/index manifest with hashes and licences;
- durable benchmark corpus schema and runner;
- before/after benchmark report with raw JSON;
- operator station/setup guide;
- architecture and incident/rollback documentation;
- production build/type/lint verification results;
- a final zip of the complete working project.

IMPLEMENTATION ORDER

1. Catalogue validator and durable benchmark harness.
2. Frozen V51.1 baseline replay.
3. Recognition-service prototype and encoder ablation.
4. ANN index, XFeat/LightGlue verification and exact ROI resolver.
5. Calibration and fail-closed decision policy.
6. Browser worker capture and persistent concurrent queue.
7. Atomic idempotent inventory transaction.
8. Diagnostics/review UI integration.
9. Shadow-mode real scanning and corpus expansion.
10. Locked release-gate run, security/performance validation, documentation and packaged delivery.

Stop and report evidence if a gate cannot be met. Never weaken a gate, hide rejects, or invent an accuracy number to declare success.
```

## Final recommendation

Build the owned hybrid recognizer above. It is materially better suited to Ancient Pulls than copying an OCR scanner or trusting one commercial API. It copies the architecture demonstrated at real industrial scale, uses modern permissively licensed matching components, removes the present O(N) JavaScript catalogue scan and browser OCR bottleneck, and makes record correctness a database-level invariant.

The project should not begin by tweaking score weights. It should begin with the catalogue validator and real benchmark corpus. Without those, any new “confidence” number is cosmetic.

