# Scanner V51.1 audit and design record

## V51.1 real-export correction

The supplied Trumbeak export proved that recognition had read both the name and the exact `067/084` identity, but the fraction landed in the broader set crop and was discarded because only the narrow collector crop was parsed. V51.1 extracts strict fractions from both footer lanes, rejects impossible noise such as `07/004`, and cross-validates a low-confidence fraction only when numerator, printed total and an exact name all agree with the same catalogue card. HP remains an additional independent signal.

The same export showed repeated scans of one physical card and generic 50–55% fallback candidates. V51.1 removes motion-based rapid replacement rearming; the guide must be empty for three samples before another automatic capture. It also distinguishes image-index matches from OCR fallbacks and surfaces the visual endpoint error plus indexed/total counts in Diagnostics.

## V51 image-first inversion

Real use showed that even corrected OCR remained too inconsistent to generate the candidate pool. V51 removes that architectural dependency. Every canonical database image receives a compact full-card, artwork-structure, artwork-edge and colour fingerprint. Each scan searches the entire indexed catalogue across up to three quality-ranked frames and both orientations. OCR runs in parallel and can only add a small tie-break bonus; OCR disagreement cannot reduce a visual candidate or elevate an unrelated text hallucination over a clearly stronger picture.

The visual index is stored separately only as derived search data keyed to the existing canonical `pokemon_cards.id`; it is not a second card catalogue. Index building is protected by the existing admin gateway, resumable, and uses small canonical images. Scanning is blocked until at least 98% of reference images are indexed so a partial index cannot produce false certainty.

## V50.1 diagnostic correction

The first real diagnostic export exposed two over-broad footer crops covering the weakness/retreat bar, permissive standalone-digit parsing, and a numeric database ID rejected by the visual reference proxy. V50.1 moves collector/set OCR to tight footer lanes, separates set OCR from number parsing, rejects unanchored single digits, makes exact evidence reliability-aware across frames, accepts numeric canonical IDs for visual matching, tightens the Pokémon-name lane, and adds a dedicated current-scan JSON export.

## Why the previous scanner failed

The previous 3,062-line component performed as many as twelve sequential OCR passes and then required a strong name hypothesis before candidate matching could continue. An exact collector number, set-size match or useful visual signature could therefore be discarded when stylised name text produced poor OCR. Visual comparison was placed after that name gate, so it could not recover the failure it was meant to solve. Camera tracking, OCR, catalogue access, scoring, UI and inventory flow were also coupled inside one component, making tuning risky and retaining too much transient scan state.

## V50 recognition path

1. The camera samples a low-resolution fingerprint at about 9.5 Hz while native video rendering stays independent.
2. Empty-surface calibration and scene-change thresholds drive a bounded conveyor state machine: calibrating, searching, entering, tracking, queued and waiting for removal.
3. Existing edge/corner detection rectifies a detected card; a guide crop is the safe fallback.
4. Up to four frames are quality-ranked. OCR consumes at most three, with an additional 180-degree recovery only when the first orientation produces no useful signal.
5. Name, collector number, set and HP are cropped and preprocessed independently with field-specific character constraints.
6. Weighted temporal voting combines repeated reads, giving sharper frames more influence.
7. An authenticated server route generates a small catalogue candidate pool from collector number, denominator, set code and fuzzy database names. No second card database is introduced.
8. Tunable scoring starts at collector 42%, set 22%, name 21%, visual 11% and secondary metadata 4%, normalised over the evidence actually available.
9. The ten strongest text/metadata candidates are compared against canonical reference images using artwork, full-card and set-symbol region signatures.
10. Confidence is calibrated against independent signal count and the margin over the runner-up. Automatic insertion requires at least 95%, three agreeing signals, a five-point margin, and exact-number evidence plus either exact set or strong artwork.

## Failure recovery and performance controls

- A failed name read does not block exact number/set lookup.
- A third good frame is tried when repeated evidence has not converged.
- Frame history is capped at four and the recognition queue at ten.
- Only one OCR worker is created and it is terminated on unmount.
- Reference images are compared only after candidate narrowing, with three concurrent fetch/comparison jobs.
- Rearming requires a measured empty-surface transition, preventing autofocus or hand movement from duplicating one card.
- Debug snapshots retain previews rather than full camera frames and review history is bounded.

## Verification performed

- `tsc --noEmit`: passed.
- Focused ESLint over every changed V51.1 component/module/route/script: passed with zero errors or warnings.
- Next.js 16.2.12 production build: passed; all 50 routes completed, including both visual scanner endpoints.
- Supplied-export regressions: `07/004` rejected, `067/084` recovered, and Trumbeak `67/84` calibrated to 95% with four agreeing signals.
- Benchmark reporter: exercised with synthetic correct, incorrect and unresolved records; aggregation and tag slices passed.
- Repository-wide ESLint was also run. It reports pre-existing errors in unrelated player, admin and legacy script files; V50 adds none.

Real recognition accuracy is intentionally not fabricated. Use the included labelled benchmark workflow across the requested card/lighting/sleeve conditions, then tune `SCANNER_WEIGHTS` and acceptance thresholds from observed data.
