# The Logbook

A portfolio whose navigation is a hardcover book on a desk: the closed book opens, spreads turn, and each spread presents one project. The turn is rendered with CSS 3D — no WebGL — and one JSON file drives the book, its Contents page and, later, a plain HTML version of the same content.

The site is not deployed.

## Prerequisites

- Node 22.22.3 (pinned in `.nvmrc`)
- npm

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | `tsc --noEmit`, then `vite build` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` only |
| `npm test` | `vitest run`; 237 tests across 13 files |

`npm install` has not been documented beyond the standard npm behaviour; dependencies are exact-pinned in `package.json`.

## Stack

Vite 8.3.5, React 19.3.1, TypeScript (strict), zustand 5.0.16, zod 4.6.7, vitest 5.0.5. Runtime dependencies are exactly four: `react`, `react-dom`, `zod`, `zustand`. Deliberately absent: three/React Three Fiber (removed), GSAP/Framer Motion, Tailwind, Playwright.

## Project structure

| Path | Purpose |
| --- | --- |
| `src/content/` | `portfolio.json`, zod `schema.ts`, `loadContent.ts` (validate plus `migrate` seam keyed on `schemaVersion`), `deriveSpreads.ts` |
| `src/state/` | `bookState.ts` zustand phase machine (CLOSED/OPENING/OPEN/TURNING/CLOSING, guards only, no stored progress), `timing.ts` pure progress and easing |
| `src/book/` | The only module that owns the stage: `BookStage`, `Book`, `StaticPage`, `PageContent`, `TurningSheet`, pose and turn maths (`bookPose`, `turnFaces`, `curlShape`, `frameStep`, `sheetPose`, `motion`, `pager`, `pageLookup`), `book.css`, `desk.css` |
| `src/ui/` | `TopBar`, `Hint`, `PlainLink` |
| `src/dev/` | `freeze.ts`, `PerfOverlay.tsx` |

`deriveSpreads.ts` is pure: Contents first, one spread per visible project in array order, closing spread last, page count forced even. Today that gives 5 spreads and 10 pages from 3 placeholder projects.

### The rollback rule

`src/book/` owns the stage. A future renderer change replaces only that directory; `src/content/`, `src/state/` and `src/ui/` are renderer-agnostic and must not import from `src/book/`. There is no file-swap fallback: React Three Fiber was removed entirely from the codebase, and the last R3F implementation survives only as the git tag `phase1-r3f`. If the owner ever wants it back, that tag is the rollback point.

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

- `?perf` — frame-time panel: rAF-interval frame times, long tasks, CLS and element count. 3 s warm-up, 10 s window, `R` restarts. This replaces the retired WebGL frame-budget panel as the honest measurement tool for the CSS pass bar (see `docs/phase1-decision.md`).
- `?freeze=<0..1>&dir=forward|back` — frozen still of the turn at a given progress. Requires the book to be open (press Space). A `back` still needs one ArrowRight first, because there is no backward turn from spread 0.

## CSS-3D invariants

Maintainers must not break these; the flattening model depends on them.

- No `overflow`, `clip-path`, `filter`, `opacity` below 1, `mask` or `mix-blend-mode` on `.book`, `.book__page*`, `.strip` or any of their ancestors. Flattening props live only on the leaves `.strip__clip` and `.strip__shade`.
- Clipping stays on `.strip__clip`; do not move it up the tree.
- The 0.75 px strip overlap in `book.css` is pinned by a comment there. It is only correct while all strips render identical page clones; change one, change both.

## Known limitations of this phase

- Contents entries are derived and `jump()` is tested, but no UI element calls them.
- Turns are keyboard- and text-driven; page-edge click and drag are not implemented. Mobile has swipe.
- `/plain` returns 404 until Phase 3.
- Real content is pending: 3 placeholder projects; no employer names or real figures anywhere in the repo.
- No sound and no art assets.
- Two cosmetic questions are open and the owner must judge them: whether the tilted CSS book reads as a real desk view, and whether the fold reads as paper (`?freeze=0.5`, both directions).

## Status

Phase 1 is decided: the R3F page curl was rejected on visual grounds and the project fell back to a CSS-3D segmented faux-curl; three and R3F were removed. See `docs/phase1-decision.md`.
