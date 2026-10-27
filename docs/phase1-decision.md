# Phase 1 decision: R3F book or CSS 3D fallback

**Status: awaiting the owner's visual verdict.** No decision has been taken. This record lists what has been proven, what has not, and the protocol for the two judgements that remain with the owner.

## Proven mechanically

- 124 tests pass across 5 files, including the curl pose maths and the state machine commands.
- Spread derivation: Contents first, one spread per visible project, closing spread last, page count forced even. Current output is 5 spreads and 10 pages.
- Curl pose at `p=0`: root rotation 0, all bone deltas 0.
- Curl pose at `p=0.5`: root 1.5708 rad, sum of absolute bone deltas 1.05, max absolute delta 0.0435.
- Curl pose at `p=1`: root 3.14159 rad, deltas 0.
- Desk clearance: measured `min.y = 0.0835` for the forward turn.
- A mirrored variant with a negative root measured `min.y = -1.3167` (through the desk) and was rejected. Backward turns are the forward pose read from `p=1` to `p=0`.
- Bundle: entry 321.34 kB (99.17 kB gzip), scene chunk 13.17 kB (5.17 kB gzip), three/R3F chunk 915.68 kB (243.10 kB gzip). This is down from a single 1,231.69 kB chunk before lazy-loading.
- Rig shape: 96×4 sheet, 485 vertices, 48 bones, detached-bind front and back meshes, frustum culling disabled.

These are arithmetic and test results, not evidence that the effect reads as paper.

## Not proven

- **Real-GPU frame times.** Headless SwiftShader numbers are not valid GPU evidence and must not be used in the decision.
- **The "does it read as paper" judgement.** This is the owner's call.
- **Safari and Firefox.** Only the browser named in the owner record below has been exercised, if any.
- **Real devices.** No phone, tablet or low-end laptop has been measured.
- **Screen readers.** No assistive-technology pass has been done, and the 3D scene has no equivalent yet because `/plain` is not implemented.

## Measurement protocol

1. `npm run build && npm run preview`
2. Open `http://localhost:4173/?perf`
3. Press Space to open the book, then wait out the 3 s warm-up.
4. Make three forward turns (ArrowRight).
5. Press `R` to restart the window.
6. Make three back turns (ArrowLeft).
7. Read p50, p95, p99, worst frame and the count of frames over 33 ms from the panel.

**Pass bar: p95 ≤ 16.7 ms and zero frames > 33 ms on a mid-range machine.** Record all five numbers, not just a pass/fail.

## Visual protocol

1. Load `?freeze=0.25` with `dir=forward`, then `0.5`, `0.75`, `0.95`. Press Space first; a `back` still needs one ArrowRight before the freeze takes effect.
2. Repeat the four values with `dir=back`.
3. Capture one still per value per direction, eight in total.
4. Judge each: is the silhouette a paper C-curve with a visible fore edge and a shading gradient across the fold, or does it look like a bowed card? The curl maths can be correct while the reading is wrong, so the stills decide it.

## Decision table

| Branch | Trigger | Consequence |
| --- | --- | --- |
| Keep R3F | Pass bar met and stills read as paper | Phase 2 works on scene and art inside `src/scene/` |
| Fall back to CSS 3D | Pass bar missed or stills read as a bowed card | Replace `src/scene/` only; `src/content/`, `src/state/` and `src/ui/` stay untouched |

Chosen branch: <!-- TODO(owner): keep R3F / fall back to CSS 3D -->

## Owner record

- Machine: TODO(owner): CPU, GPU, RAM, form factor.
- Browser and version: TODO(owner): browser name and version used for the run.
- Date of run: TODO(owner): date.
- p50 / p95 / p99 / worst frame: TODO(owner): four values in ms.
- Frames over 33 ms: TODO(owner): count.
- Still verdict: TODO(owner): paper C-curve or bowed card, per direction.
- Final verdict: TODO(owner): branch chosen and one sentence of reasoning.
