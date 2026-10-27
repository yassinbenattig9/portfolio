/**
 * Animation timing primitives.
 *
 * Pure functions only: no store, no React, no three. The clock is always
 * injected so the same code runs in `useFrame` (scene) and in node tests.
 */

/** A transition is just a start timestamp plus a duration, in milliseconds. */
export interface Transition {
  readonly startedAt: number
  readonly duration: number
}

/** Forward motion (opening the book, turning to the next spread). */
export const FORWARD_DURATION_MS = 900

/** Backward motion (closing the book, turning back to the previous spread). */
export const BACK_DURATION_MS = 800

/** Aliases for call sites that think in terms of the open/close window. */
export const OPEN_DURATION_MS = FORWARD_DURATION_MS
export const CLOSE_DURATION_MS = BACK_DURATION_MS

const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value)

/**
 * Cubic ease-in-out on the unit interval.
 *
 * Zero derivative at both ends, so neither the start of a transition nor its
 * arrival pops. Values outside [0, 1] are clamped.
 */
export function easeInOutCubic(p: number): number {
  const t = clamp01(p)
  return t < 0.5 ? 4 * t * t * t : 1 - ((2 - 2 * t) ** 3) / 2
}

/**
 * Linear progress of a transition at `now`, clamped to [0, 1].
 *
 * `now` before the start yields 0; `now` at or after start + duration yields
 * exactly 1. A non-positive duration resolves immediately.
 */
export function progressAt(transition: Transition, now: number): number {
  if (transition.duration <= 0) {
    return now >= transition.startedAt ? 1 : 0
  }
  return clamp01((now - transition.startedAt) / transition.duration)
}
