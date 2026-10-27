import { useEffect, useMemo, useRef, useState } from 'react'
import type { Spread } from '../content/deriveSpreads'
import type { Portfolio } from '../content/schema'
import { getBookState, useBookStore, type BookPhase } from '../state/bookState'
import { Book } from './Book'
import { frameStep } from './frameStep'
import { projectMap, spreadLabel } from './pageLookup'
import './book.css'

/**
 * The CSS-3D stage: perspective, the `.book` element and the one rAF loop.
 *
 * No Suspense, no lazy chunk and no WebGL probe: the book is DOM and paints
 * with the rest of the shell. The loop exists only while OPENING or CLOSING
 * and writes a single custom property (`--open`) on `.book` per frame, so
 * React never re-renders per frame and costs nothing at rest. Page turns and
 * their `--turn` property arrive in a later task; `frameStep` already returns
 * them, this loop just has nowhere to write them yet.
 *
 * The live region announces the current spread. At CLOSED the pages are inert
 * (`StaticPage`) and the cover is the only button.
 */

export interface BookStageProps {
  readonly spreads: readonly Spread[]
  readonly content: Portfolio
}

/** Reduced motion: finish the swing on its first frame instead of animating. */
const REDUCED_MOTION_SCALE = 1000

function motionScale(): number {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 1
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? REDUCED_MOTION_SCALE : 1
}

const REST_PHASES: ReadonlySet<BookPhase> = new Set<BookPhase>(['CLOSED', 'OPEN', 'TURNING'])

export function BookStage({ spreads, content }: BookStageProps) {
  const phase = useBookStore((state) => state.phase)
  const spreadIndex = useBookStore((state) => state.spread)
  const bookRef = useRef<HTMLDivElement>(null)
  const [scale] = useState(motionScale)

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
    // stale `--open` from a previous animation.
    if (REST_PHASES.has(phase)) {
      book.style.setProperty('--open', phase === 'CLOSED' ? '0' : '1')
      return
    }

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

      if (result.open !== undefined) book.style.setProperty('--open', String(result.open))

      // Commit after writing, so the last frame is the exact end pose. The
      // store only accepts the commit for the phase it is actually in.
      if (result.commit === 'open') state.commitOpen()
      else if (result.commit === 'close') state.commitClose()

      if (!running) return
      const next = getBookState().phase
      if (next === 'OPENING' || next === 'CLOSING') frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)

    return () => {
      running = false
      cancelAnimationFrame(frame)
    }
  }, [phase, scale])

  // Opening removes the cover button from the DOM; closing brings it back.
  // Move focus to the book surface in both directions so a keyboard or screen
  // reader user is not dropped on <body> when the element disappears.
  const previousPhase = useRef(phase)
  useEffect(() => {
    const from = previousPhase.current
    previousPhase.current = phase
    if (from === phase) return

    const book = bookRef.current
    if (book === null) return

    if (from === 'CLOSED') {
      book.focus()
    } else if (phase === 'CLOSED') {
      book.querySelector<HTMLElement>('[data-cover="closed"]')?.focus()
    }
  }, [phase])

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
        <Book spreads={spreads} content={content} />
      </div>

      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>
    </div>
  )
}
