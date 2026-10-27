import type { BookPhase } from '../state/bookState'

/**
 * How far the book is open: 0 is shut, 1 is lying flat with the cover on the
 * desk.
 *
 * `OPENING` and `CLOSING` share one eased window, but they run it in opposite
 * directions. A closing window is the opening window read backwards, so its
 * openness is inverted; driving both the hinge and the left sheet from this one
 * value is what keeps them in step (the cover must not snap shut and then swing
 * open again for the length of the window).
 *
 * Phases without a window are already at their end state, so `eased` is
 * ignored for them. Pure and renderer-free: unit-tested directly.
 */
export function opennessFor(phase: BookPhase, eased: number): number {
  if (phase === 'OPENING') return clamp01(eased)
  if (phase === 'CLOSING') return 1 - clamp01(eased)
  return phase === 'CLOSED' ? 0 : 1
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0
  return value < 0 ? 0 : value > 1 ? 1 : value
}
