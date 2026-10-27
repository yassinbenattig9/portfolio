import { useEffect, useMemo, useRef, useState } from 'react'
import type { Spread } from '../content/deriveSpreads'
import type { Portfolio } from '../content/schema'
import { getBookState, useBookStore } from '../state/bookState'
import { Book } from './Book'
import { frameStep } from './frameStep'
import { motionScaleFor, useReducedMotion } from './motion'
import { projectMap, spreadLabel } from './pageLookup'
import './book.css'

/**
 * The CSS-3D stage: perspective, the `.book` element and the one rAF loop.
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
 */

export interface BookStageProps {
  readonly spreads: readonly Spread[]
  readonly content: Portfolio
}

export function BookStage({ spreads, content }: BookStageProps) {
  const phase = useBookStore((state) => state.phase)
  const spreadIndex = useBookStore((state) => state.spread)
  const bookRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  /** True when this turn parked focus, i.e. the commit may move it back. */
  const parked = useRef(false)
  const [turnNote, setTurnNote] = useState<string | null>(null)

  const projects = useMemo(() => projectMap(content), [content])

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
    let running = true
    let frame = 0

    const step = () => {
      const state = getBookState()
      const result = frameStep({
        phase: state.phase,
        open: state.open,
        turn: state.turn,
        now: performance.now(),
        motionScale: scale,
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

    frame = requestAnimationFrame(step)

    return () => {
      running = false
      cancelAnimationFrame(frame)
    }
  }, [phase, reduced])

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
      // is left exactly where the user put it.
      if (slot === `${turn.from}.left` || slot === `${turn.from}.right`) {
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
      book.querySelector<HTMLElement>('.book__page--left .page__title')?.focus()
    }
  }, [phase, spreads.length])

  return (
    <div className="app__scene">
      <div
        className="book"
        ref={bookRef}
        data-phase={phase}
        role="region"
        aria-label="The Logbook"
        tabIndex={-1}
      >
        <Book spreads={spreads} content={content} sheetRef={sheetRef} />
      </div>

      <p className="visually-hidden" aria-live="polite">
        {turnNote ?? announcement}
      </p>
    </div>
  )
}
