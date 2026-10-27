import type { FreezeState } from '../dev/freeze'
import type { TurnDir } from '../state/bookState'
import { turnFaces, type TurnFaces } from './turnFaces'

/**
 * A sheet frozen at a fixed pose by the dev harness (see `src/dev/freeze.ts`).
 *
 * The harness is deliberately outside the state machine: this module only
 * answers "which turn would be posed at this progress, and where does the
 * sheet sit", and the caller writes `--t` once. Nothing is dispatched and
 * nothing commits, so a frozen still can never move the book.
 *
 * `progress` is turn progress (0 starts flat, 1 lands flat). `turn` is the
 * sheet position the CSS wants, which is the same value `frameStep` emits:
 * forward runs 0 -> 1, backward reads the same pose from the other end.
 */

export interface FrozenSheet {
  readonly faces: TurnFaces
  readonly dir: TurnDir
  /** Sheet position, 0 (flat on the right) to 1 (flat on the left). */
  readonly turn: number
}

/**
 * The frozen sheet for the current spread, or `null` when the freeze cannot be
 * posed: no freeze requested, or no page to turn to (forward at the last
 * spread, backward at spread 0 — a `back` still needs one ArrowRight first).
 */
export function frozenSheet(
  freeze: FreezeState | null,
  spread: number,
  spreadCount: number,
): FrozenSheet | null {
  if (freeze === null) return null

  const to = spread + freeze.dir
  if (to < 0 || to >= spreadCount) return null

  return {
    faces: turnFaces(spread, to, freeze.dir),
    dir: freeze.dir,
    turn: freeze.dir === 1 ? freeze.progress : 1 - freeze.progress,
  }
}
