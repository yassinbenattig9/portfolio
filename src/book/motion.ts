import { useSyncExternalStore } from 'react'
import type { BookPhase, PageTurn } from '../state/bookState'

/**
 * The one reduced-motion switch for the CSS-3D book.
 *
 * `BookStage` reads it for the animation clock (how long a transition lasts)
 * and `TurningSheet` reads it for the shape (strips or a flat crossfade). Both
 * use the same media query, so they cannot disagree about the mode.
 *
 * Reduced motion keeps the state machine exactly as it is: the same windows,
 * the same end state and the same commit point (progress 1). Only the duration
 * and the shape change.
 */

/** Speed multiplier that lands the open/close window on its first frame. */
export const REDUCED_MOTION_SCALE = 1000

/** How long a page turn takes under reduced motion: a crossfade, not a swing. */
export const TURN_CROSSFADE_MS = 180

const QUERY = '(prefers-reduced-motion: reduce)'

function media(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  return window.matchMedia(QUERY)
}

/** Current preference, without subscribing. Safe in SSR and in node tests. */
export function prefersReducedMotion(): boolean {
  return media()?.matches ?? false
}

function subscribe(onChange: () => void): () => void {
  const list = media()
  if (list === null) return () => {}
  list.addEventListener('change', onChange)
  return () => list.removeEventListener('change', onChange)
}

function serverSnapshot(): boolean {
  return false
}

/**
 * Live preference. Turning the OS setting on mid-session swaps the sheet and
 * lengthens/shortens the next transition; nothing is left half-animated.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, serverSnapshot)
}

/**
 * `frameStep`'s `motionScale` for one transition.
 *
 * Reduced motion ends an open/close on its first frame (as before) but lets a
 * turn run `TURN_CROSSFADE_MS`, because the crossfade *is* the reduced-motion
 * turn: committing on the first frame would leave nothing to see.
 */
export function motionScaleFor(reduced: boolean, phase: BookPhase, turn: PageTurn | null): number {
  if (!reduced) return 1
  if (phase === 'TURNING' && turn !== null && turn.duration > 0) {
    return turn.duration / TURN_CROSSFADE_MS
  }
  return REDUCED_MOTION_SCALE
}
