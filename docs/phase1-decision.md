# Phase 1 decision: CSS 3D fallback

**Decision made: fall back to CSS 3D.** The owner rejected the React Three Fiber page curl on visual grounds (the fold did not read as paper, and the tilted scene did not read as a desk view). The project now ships a CSS-3D segmented faux-curl, and three and @react-three/fiber were removed from the codebase entirely. Rollback is no longer a file swap: the git tag `phase1-r3f` marks the last R3F implementation and is the only rollback point.

## What the R3F spike proved

The spike established the shared maths and constraints before being removed: curl pose at `p=0` means root rotation 0 with all bone deltas 0; at `p=1` root is 3.14159 rad with deltas 0. Desk clearance measured `min.y = 0.0835` for the forward turn; a mirrored variant with a negative root measured `min.y = -1.3167` (through the desk) and was rejected. Backward turns are the forward pose read from `p=1` to `p=0`. Bundle split was proven: a single 1,231.69 kB chunk was reduced to entry 321.34 kB (99.17 kB gzip), scene chunk 13.17 kB, three/R3F chunk 915.68 kB (243.10 kB gzip).

## What the CSS version has now

- **Turn model**: one sheet moves during TURNING; 12 nested strips per face; a single style write `--t` per frame; forward `t = eased`, backward `t = 1 - eased`; the sheet rotates only 0 to −180°. Strip shades sample one page-wide gradient so the fold reads as a continuous curve (an earlier per-strip gradient read as pleats).
- **Accessibility**: one semantic page per side; the sheet is `aria-hidden` plus `inert` with links demoted to spans; focus parks during a turn and lands on the new heading; single-mode flips announce "Page N of M"; reduced motion is a crossfade (no curl, no strips) with the constant `CROSSFADE_MS` surfaced as `--crossfade-ms`.
- **Mobile**: swipe turns.
- **Tests**: 237 across 13 files, node environment, no DOM or WebGL.
- **Bundle**: single JS chunk ~337 kB (103.5 kB gzip) plus CSS 19.1 kB (4.9 kB gzip). DOM: 62 elements at rest, ~376 mid-turn. Before R3F removal the JS total was ~1,238 kB across two chunks (321 + 916).

## Not yet proven

- Real-device measurements (the pass bar protocol below). Headless SwiftShader numbers are not valid evidence.
- Safari and Firefox behaviour of the 3D transforms.
- Text sharpness at DPR 2.
- Screen-reader pass.
- The owner's judgement of whether the tilt reads as a desk view and the fold reads as paper (`?freeze=0.5`, both directions).

## New pass bar and measurement protocol

1. `npm run build && npm run preview`
2. Open `http://localhost:4173/?perf`
3. Press Space to open the book, then wait out the 3 s warm-up.
4. Make three forward turns (ArrowRight).
5. Press `R` to restart the window.
6. Make three back turns (ArrowLeft).

**Pass bar: no long task over 50 ms during a turn, CLS below 0.02, and zero frames over 33 ms during a turn.** The owner runs this on real hardware; headless numbers are not evidence.

This is a changed pass bar: the R3F-era "p95 ≤ 16.7 ms" WebGL frame budget is retired and replaced by the CSS pass bar above.

## Boundary for the next phase

`src/book/` owns the stage. A future renderer change replaces only that directory; `src/content/`, `src/state/` and `src/ui/` are renderer-agnostic.

## Next phase

Phase 2 is no longer scene and art for WebGL. It is TypeScript-CSS polish under the same boundary, then the content system against the same `portfolio.json`. Phase 3 still owes `/plain`, which 404s today.

## Deliberately out of scope for now

Clickable Contents entries (`jump()` is tested but nothing calls it), page-edge click and drag turns (turns are keyboard- and text-driven so far; mobile has swipe), real content (3 placeholder projects; no employer names or real figures anywhere in the repo), sound, and art assets.
