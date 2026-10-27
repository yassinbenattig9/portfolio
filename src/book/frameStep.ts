import type { BookPhase, PageTurn } from '../state/bookState'
import type { Transition } from '../state/timing'
import { easeInOutCubic, progressAt } from '../state/timing'
import { opennessFor } from './bookPose'

/**
 * One animation frame of the CSS-3D book, as plain numbers.
 *
 * The store holds only discrete facts and a start timestamp; `BookStage` asks
 * this function what to write on the current frame, so no React state changes
 * per frame and the whole rule is testable in node.
 *
 * All transitions share one clock (`now`, the caller's `performance.now()`).
 * `motionScale` divides the duration: 1 is the normal speed, values above 1
 * finish earlier (reduced motion uses a very large value so the transition
 * completes on its first frame), values at or below 0 and non-finite values
 * fall back to 1 instead of dividing by zero.
 *
 * A phase whose window is `null` emits nothing at all: the caller then keeps
 * whatever it already wrote and stays at that rest pose.
 */

export type FrameCommit = 'open' | 'close' | 'turn'

export interface FrameStepInput {
  readonly phase: BookPhase
  /** The store's open window; `null` outside OPENING/CLOSING. */
  readonly open: Transition | null
  /** The store's turn window; `null` outside TURNING. */
  readonly turn: PageTurn | null
  /** The frame clock, in the same millisecond epoch as the transition. */
  readonly now: number
  /** Speed multiplier for the whole transition (default 1). */
  readonly motionScale?: number
}

/** Sparse by design: an absent field means "keep the current value". */
export interface FrameStepOutput {
  /** Cover openness, 0 (shut) to 1 (flat on the desk). */
  readonly open?: number
  /** Sheet position, 0 (flat on the right) to 1 (flat on the left). */
  readonly turn?: number
  /** Emitted on the frame the transition reached its end state. */
  readonly commit?: FrameCommit
}

const DEFAULT_MOTION_SCALE = 1

function effectiveScale(motionScale: number | undefined): number {
  if (motionScale === undefined) return DEFAULT_MOTION_SCALE
  if (!Number.isFinite(motionScale) || motionScale <= 0) return DEFAULT_MOTION_SCALE
  return motionScale
}

/** A transition as if it ran at `scale` times the speed. */
function scaled(transition: Transition, scale: number): Transition {
  if (scale === DEFAULT_MOTION_SCALE) return transition
  return { startedAt: transition.startedAt, duration: transition.duration / scale }
}

/** Linear progress of a window, with the caller's motion scale applied. */
function progressOf(transition: Transition, now: number, scale: number): number {
  return progressAt(scaled(transition, scale), now)
}

export function frameStep({
  phase,
  open,
  turn,
  now,
  motionScale,
}: FrameStepInput): FrameStepOutput {
  const scale = effectiveScale(motionScale)

  if (phase === 'OPENING' || phase === 'CLOSING') {
    if (open === null) return {}

    const progress = progressOf(open, now, scale)
    const value = opennessFor(phase, easeInOutCubic(progress))
    if (progress < 1) return { open: value }

    return { open: value, commit: phase === 'OPENING' ? 'open' : 'close' }
  }

  if (phase === 'TURNING') {
    if (turn === null) return {}

    const progress = progressOf(turn, now, scale)
    const eased = easeInOutCubic(progress)
    // A backward turn is the forward pose read from the other end; the sheet
    // itself is never mirrored (see `turnFaces`).
    const value = turn.dir === 1 ? eased : 1 - eased
    if (progress < 1) return { turn: value }

    return { turn: value, commit: 'turn' }
  }

  return {}
}
