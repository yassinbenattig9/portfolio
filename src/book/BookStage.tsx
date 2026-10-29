import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { Spread } from '../content/deriveSpreads'
import type { Portfolio } from '../content/schema'
import { getBookState, useBookStore } from '../state/bookState'
import { Book } from './Book'
import { frameStep } from './frameStep'
import { CROSSFADE_MS, motionScaleFor, useReducedMotion } from './motion'
import { pageFor, projectMap, spreadLabel } from './pageLookup'
import { clampPosition, pageCount, ordinalOf, stepFor, type PagePosition } from './pager'
import './book.css'
import './desk.css'

/** Custom properties are legal on a style object but missing from `CSSProperties`. */
interface CSSVars extends CSSProperties {
  readonly [key: `--${string}`]: string | number
}

/**
 * The CSS-3D stage: the desk, perspective, the `.book` element and the one
 * rAF loop.
 *
 * No Suspense, no lazy chunk and no WebGL probe: the book is DOM and paints
 * with the rest of the shell. The loop exists only while a transition runs:
 *
 * - OPENING / CLOSING write `--open` on `.book`;
 * - TURNING writes `--t` on the sheet element (and nothing else).
 *
 * Both are one property write per frame, so React never re-renders per frame
 * and the book costs nothing at rest: phases without a window return before
 * `requestAnimationFrame`.
 *
 * Page turns are announced in the live region ("Turning to spread N of M") and
 * focus is parked on the book when it would otherwise sit on a page the sheet
 * is about to cover and replace. On commit it moves to the new left page's
 * heading, but only if the user has not moved focus themselves in the meantime.
 *
 * The live region also announces the resting spread. At CLOSED the pages are
 * inert (`StaticPage`) and the cover is the only button.
 *
 * Narrow screens (`max-width: 46rem`) switch the stage to `data-layout=
 * "single"`: one page at a time, no sheet and no 3D turn. The side within a
 * spread is local state here (`pager.ts` decides when a flip is a side change
 * and when it crosses a spread boundary); a boundary crossing still calls the
 * store, whose turn window is shortened so the crossfade lands in ~160 ms.
 */

export interface BookStageProps {
  readonly spreads: readonly Spread[]
  readonly content: Portfolio
}

/** The single-page crossfade takes `CROSSFADE_MS`; this is also the scale that
    compresses the store's turn window so it commits when the fade lands. */
const SINGLE_TURN_MS = CROSSFADE_MS

/** A swipe must clear this many pixels horizontally, and be this much more
    horizontal than vertical, before it pages. */
const SWIPE_MIN_PX = 44
const SWIPE_SLOPE = 1.35

const SINGLE_QUERY = '(max-width: 46rem)'

function singleList(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  return window.matchMedia(SINGLE_QUERY)
}

function subscribeSingle(onChange: () => void): () => void {
  const list = singleList()
  if (list === null) return () => {}
  list.addEventListener('change', onChange)
  return () => list.removeEventListener('change', onChange)
}

function serverSingle(): boolean {
  return false
}

function useSingleLayout(): boolean {
  return useSyncExternalStore(subscribeSingle, () => singleList()?.matches ?? false, serverSingle)
}

/**
 * The desk (plan §3.2 direction A). Static markup, one module-level element:
 * it never re-renders, it is `aria-hidden` and `pointer-events: none`, and it
 * is a sibling of `.book`, so its masks and blend modes can never reach the
 * book's 3D context. See `desk.css`.
 */
const DESK = (
  <div className="desk" aria-hidden="true">
    <div className="desk__wall" />
    <div className="desk__surface" />
    <div className="desk__light" />
    <div className="desk__lattice desk__lattice--near" />
    <div className="desk__lattice desk__lattice--far" />
    <div className="desk__falloff" />
    <div className="desk__glass" />
    <div className="desk__pen" />
  </div>
)

export function BookStage({ spreads, content }: BookStageProps) {
  const phase = useBookStore((state) => state.phase)
  const spreadIndex = useBookStore((state) => state.spread)
  const bookRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const singleMode = useSingleLayout()
  const layout = singleMode ? 'single' : 'spread'
  /** True when this turn parked focus, i.e. the commit may move it back. */
  const parked = useRef(false)
  const [turnNote, setTurnNote] = useState<string | null>(null)

  const projects = useMemo(() => projectMap(content), [content])

  /**
   * The page shown in single layout, and the one it crossfades away from.
   * The side has no home in the store, so it lives here; the spread half of
   * the position is kept in step with the store by the effect below.
   */
  const [singlePage, setSinglePage] = useState<PagePosition>({
    spread: spreadIndex,
    side: 'left',
  })
  const [previousPage, setPreviousPage] = useState<PagePosition | null>(null)

  useEffect(() => {
    setSinglePage((current) =>
      current.spread === spreadIndex
        ? current
        : clampPosition({ spread: spreadIndex, side: current.side }, spreads.length),
    )
  }, [spreadIndex, spreads.length])

  const current = useMemo(() => pageFor(spreads, singlePage, projects), [projects, singlePage, spreads])
  const previous = useMemo(
    () => (previousPage === null ? null : pageFor(spreads, previousPage, projects)),
    [previousPage, projects, spreads],
  )

  const settle = useCallback(() => {
    setPreviousPage(null)
  }, [])

  const announcement = useMemo(() => {
    const spread = spreads[Math.min(Math.max(spreadIndex, 0), spreads.length - 1)]
    if (spread === undefined) return 'No pages'
    return `Spread ${spread.index + 1} of ${spreads.length}: ${spreadLabel(spread, projects)}`
  }, [projects, spreadIndex, spreads])

  useEffect(() => {
    const book = bookRef.current
    if (book === null) return

    // Rest poses have no window: pin the property to the store's end state and
    // stop. This is also the initial mount, so a remount can never inherit a
    // stale `--open` from a previous animation. The sheet's `--t` belongs to
    // the sheet (a frozen still) or to the turn loop below.
    if (phase === 'CLOSED' || phase === 'OPEN') {
      book.style.setProperty('--open', phase === 'CLOSED' ? '0' : '1')
      return
    }

    const scale = motionScaleFor(reduced, phase, getBookState().turn)
    // Single layout has no swing to watch: the same turn window is compressed
    // so the store commits when the 160 ms crossfade lands. The turn maths and
    // the commit point are untouched; only the clock is shortened.
    const turn = getBookState().turn
    const clock =
      singleMode && turn !== null ? Math.max(scale, turn.duration / SINGLE_TURN_MS) : scale
    let running = true
    let frame = 0

    const step = () => {
      const state = getBookState()
      const result = frameStep({
        phase: state.phase,
        open: state.open,
        turn: state.turn,
        now: performance.now(),
        motionScale: clock,
      })

      // A turn writes exactly one property, on the sheet: the root angle, the
      // strip hinges, the shades and the lift all read `--t`.
      if (result.open !== undefined) book.style.setProperty('--open', String(result.open))
      if (result.turn !== undefined) sheetRef.current?.style.setProperty('--t', String(result.turn))

      // Commit after writing, so the last frame is the exact end pose. The
      // store only accepts the commit for the phase it is actually in.
      if (result.commit === 'open') state.commitOpen()
      else if (result.commit === 'close') state.commitClose()
      else if (result.commit === 'turn') state.commitTurn()

      if (!running) return
      const next = getBookState().phase
      if (next === 'OPENING' || next === 'CLOSING' || next === 'TURNING') {
        frame = requestAnimationFrame(step)
      }
    }

    // One synchronous step before the loop's first rAF: a mode change
    // (layout query, reduced motion) re-runs this effect while a transition is
    // in flight, and this writes the current pose immediately, so the sheet's
    // inline seed and the first scheduled frame are the same pose — no gap
    // frame at the old value. `step` already scheduled the next frame itself
    // if the transition continues; if it reached its end, nothing is pending
    // and `frame` stays 0 (a harmless `cancelAnimationFrame` argument).
    step()

    return () => {
      running = false
      cancelAnimationFrame(frame)
    }
  }, [phase, reduced, singleMode])

  /** The heading of the page a single-layout reader is actually looking at. */
  const focusSinglePage = useCallback(() => {
    bookRef.current
      ?.querySelector<HTMLElement>('.book__page--single .page__layer--current .page__title')
      ?.focus()
  }, [])

  /**
   * One page in `dir`. `pager.ts` owns the decision: a side flip is local
   * state, crossing a spread boundary is a real `next()` / `prev()`.
   */
  const go = useCallback(
    (dir: 1 | -1) => {
      const state = getBookState()
      if (!singleMode || state.phase !== 'OPEN') return

      const step = stepFor(dir, singlePage, spreads.length)
      if (step === null) return

      // The page holding focus is about to be hidden (and then replaced), so
      // park focus on the book first; the effect below lands it on the new
      // heading once the layer has settled.
      const book = bookRef.current
      const active = document.activeElement
      if (book !== null && active instanceof Node && book.contains(active)) {
        parked.current = true
        book.focus()
      }

      setPreviousPage(reduced ? null : singlePage)
      setSinglePage(step.to)

      if (step.kind === 'spread') {
        if (step.dir === 1) state.next()
        else state.prev()
      } else {
        // A side flip never touches the store, so no TURNING phase runs to
        // announce itself: the live region gets the page the reader just
        // landed on (1-based, from `pager`'s ordinal). The functional update
        // dedupes, so an identical note queued twice in a row never re-fires
        // the region for the same position.
        const note = `Page ${ordinalOf(step.to) + 1} of ${pageCount(spreads.length)}`
        setTurnNote((current) => (current === note ? current : note))
      }
    },
    [reduced, singleMode, singlePage, spreads.length],
  )

  // Single layout: arrows page one page at a time, which is finer than the
  // shell's spread-level arrow handler, so this listener runs in the capture
  // phase and stops that handler from also turning the spread.
  useEffect(() => {
    if (!singleMode) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return

      const target = event.target
      if (target instanceof HTMLElement) {
        if (target.isContentEditable) return
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
        if (target.closest('a, button') !== null) return
      }

      if (getBookState().phase !== 'OPEN') return

      event.preventDefault()
      event.stopPropagation()
      go(event.key === 'ArrowRight' ? 1 : -1)
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [go, singleMode])

  // Touch paging. Touch/pen only: a mouse drag is text selection, not a swipe.
  // A gesture that starts on a link or a button belongs to that control.
  const swipe = useRef<{ readonly x: number; readonly y: number } | null>(null)

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    swipe.current = null
    if (!singleMode || event.pointerType === 'mouse') return
    if (getBookState().phase !== 'OPEN') return

    const target = event.target
    if (target instanceof Element && target.closest('a, button') !== null) return

    swipe.current = { x: event.clientX, y: event.clientY }
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = swipe.current
    swipe.current = null
    if (start === null || !singleMode) return

    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.abs(dx) < SWIPE_MIN_PX) return
    if (Math.abs(dx) < Math.abs(dy) * SWIPE_SLOPE) return

    go(dx < 0 ? 1 : -1)
  }

  // Focus follows the paper. Opening removes the cover button from the DOM and
  // closing brings it back, so focus is moved by hand; a turn parks focus on
  // the book when it would sit on a page the sheet is about to replace, and on
  // commit it lands on the new left page's heading.
  const previousPhase = useRef(phase)
  useEffect(() => {
    const from = previousPhase.current
    previousPhase.current = phase
    if (from === phase) return

    const book = bookRef.current
    if (book === null) return

    if (from === 'CLOSED') {
      book.focus()
      return
    }

    if (phase === 'CLOSED') {
      book.querySelector<HTMLElement>('[data-cover="closed"]')?.focus()
      return
    }

    if (phase === 'TURNING') {
      const turn = getBookState().turn
      if (turn === null) return

      const active = document.activeElement
      const slot =
        active instanceof Element ? active.closest('[data-slot]')?.getAttribute('data-slot') : null

      // The two pages of the spread being left are the ones the sheet covers
      // and the commit replaces. Anywhere else (the book itself, the chrome)
      // is left exactly where the user put it. In single layout the page that
      // is leaving is whichever one held focus, so any page focus counts.
      const leaving =
        slot === null
          ? false
          : singleMode
            ? true
            : slot === `${turn.from}.left` || slot === `${turn.from}.right`

      if (leaving) {
        parked.current = true
        book.focus()
      }

      setTurnNote(`Turning to spread ${turn.to + 1} of ${spreads.length}`)
      return
    }

    if (from === 'TURNING' && phase === 'OPEN') {
      const returnFocus = parked.current
      parked.current = false
      setTurnNote(null)
      if (!returnFocus) return
      // The user took focus back during the turn: never steal it.
      if (document.activeElement !== book) return
      if (singleMode) focusSinglePage()
      else book.querySelector<HTMLElement>('.book__page--left .page__title')?.focus()
    }
  }, [focusSinglePage, phase, singleMode, spreads.length])

  // A side flip never changes the store's phase, so the commit above cannot
  // fire for it: land the parked focus once the new page is the current one.
  useEffect(() => {
    if (!singleMode || !parked.current) return
    if (getBookState().phase !== 'OPEN') return
    if (document.activeElement !== bookRef.current) return
    parked.current = false
    focusSinglePage()
  }, [focusSinglePage, singleMode, singlePage])

  return (
    <div
      className="app__scene"
      data-layout={layout}
      style={{ '--crossfade-ms': `${CROSSFADE_MS}ms` } as CSSVars}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        swipe.current = null
      }}
    >
      {DESK}

      <div
        className="book"
        ref={bookRef}
        data-phase={phase}
        data-layout={layout}
        role="region"
        aria-label="The Logbook"
        tabIndex={-1}
      >
        <Book
          spreads={spreads}
          content={content}
          sheetRef={sheetRef}
          layout={layout}
          single={current}
          previous={previous}
          onSettled={settle}
        />
      </div>

      <p className="visually-hidden" aria-live="polite">
        {turnNote ?? announcement}
      </p>
    </div>
  )
}
