# The Logbook

A portfolio whose navigation is a 3D hardcover book on a desk: the closed book opens, spreads turn, and each spread presents one project. One JSON file drives the book, its Contents page and, later, a plain HTML version of the same content.

The site is not deployed.

## Prerequisites

- Node 22.22.3 (pinned in `.nvmrc`)
- npm
- A browser with WebGL for the 3D scene

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | `tsc --noEmit`, then `vite build` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` only |
| `npm test` | `vitest run`; 124 tests across 5 files |

`npm install` has not been documented beyond the standard npm behaviour; dependencies are exact-pinned in `package.json`.

## Stack

Vite 8.3.5, React 19.3.1, TypeScript (strict), three 0.186.1, @react-three/fiber 9.8.2, zustand 5.0.16, zod 4.6.7, vitest 5.0.5. Deliberately absent: drei, GSAP/Framer Motion, Tailwind, Playwright.

## Project structure

| Path | Purpose |
| --- | --- |
| `src/content/` | `portfolio.json`, zod `schema.ts`, `loadContent.ts` (validate plus `migrate` seam keyed on `schemaVersion`), `deriveSpreads.ts` |
| `src/state/` | `bookState.ts` zustand phase machine, `timing.ts` pure progress and easing |
| `src/scene/` | The 3D book: scene, page turn, curl rig and pose maths |
| `src/ui/` | `TopBar`, `Hint`, `PlainLink`, `NoWebGL` |
| `src/dev/` | `freeze.ts`, `PerfOverlay.tsx` |

`deriveSpreads.ts` is pure: Contents first, one spread per visible project in array order, closing spread last, page count forced even. Today that gives 5 spreads and 10 pages.

### The rollback rule

Only `src/scene/` and `src/dev/` may import three or @react-three/fiber. `src/scene/` is the boundary: a CSS 3D fallback would replace it and reuse `src/content/`, `src/state/` and `src/ui/` untouched. Keep three imports out of the other folders.

## Editing content

Edit `src/content/portfolio.json`.

- **Add a project**: append an object to the array. It becomes the next spread.
- **Hide a project**: set `visible: false`. The spread is dropped from the book and from the Contents count.
- **Reorder**: change array order. Array order is book order.
- **Automatic results**: the Contents page and the spread count are derived from the JSON, so you do not edit them. Validation also rejects unknown keys, so a typo such as `hightlights` fails at runtime with the field path.

## What validation actually does today

- Validation runs at runtime in `App`. Bad JSON renders an error panel naming the field path.
- `npm test` parses the shipped JSON, so a broken file fails the test run.
- `npm run build` does **not** fail on bad content. The plan's "build fails" requirement is not implemented yet.
- Media paths are only checked for a `/media/` prefix; the files themselves are not verified.

## Placeholder content

Every project in `portfolio.json` is fictional placeholder text. No employer is named and no real figures appear anywhere in the repo. This is deliberate: content and confidentiality are deferred by the owner. Before any deployment, the owner must replace all three projects, all copy, and any media, and confirm that nothing confidential is present.

TODO(owner): confirm the final content, media assets and any confidentiality review before deployment.

## Dev flags

- `?perf` — frame-time panel. 3 s warm-up, 10 s window, `R` restarts. Reports p50/p95/p99, counts frames over 20 ms and over 33 ms, worst frame, and `renderer.info`.
- `?freeze=<0..1>&dir=forward|back` — frozen still of the curl at a given progress. Requires the book to be open (press Space). A `back` still needs one ArrowRight first, because there is no backward turn from spread 0.

## Known limitations of this phase

- Contents entries are derived and `jump()` is tested, but no UI element calls them.
- Page turns are keyboard-only (arrow keys). Clicking the closed book opens it; an open book ignores page clicks.
- No mobile layout. One 46rem breakpoint hides the role line, and the camera poses are landscape.
- Reduced motion is honoured for CSS chrome only, not for the 3D curl.
- `/plain` returns 404.
- No sound.

## Status

Phase 1 is awaiting the owner's visual verdict; see `docs/phase1-decision.md`.
