/**
 * Freeze harness: `?freeze=<0..1>&dir=forward|back` pins the turning sheet at
 * one pose so a still can be captured and judged (`?freeze=0.5&dir=back`).
 *
 * Deliberately outside the state machine: it reads `location.search` once and
 * hands the scene a plain value. The scene answers a freeze by posing the
 * synthetic turn at that progress and never dispatching a command or
 * committing it, so a frozen page cannot move the book.
 *
 * `progress` is turn progress, not the curl parameter: 0 is the sheet flat on
 * the page it starts from, 1 is it flat on the page it lands on. A backward
 * turn runs the curl the other way (see `TurnLayer`).
 */

export type FreezeDirection = 'forward' | 'back'

export interface FreezeState {
  /** Turn progress, 0 (starts flat) to 1 (lands flat). */
  readonly progress: number
  /** Sign for the book's own turn records: +1 forward, -1 back. */
  readonly dir: 1 | -1
  /** The flag as written in the URL. */
  readonly direction: FreezeDirection
}

const DEFAULT_DIRECTION: FreezeDirection = 'forward'

/** Pure parser: `''`, `'?freeze=0.5&dir=back'`, … `null` when there is no valid freeze. */
export function parseFreeze(search: string): FreezeState | null {
  const params = new URLSearchParams(search)
  const raw = params.get('freeze')
  if (raw === null || raw.trim() === '') return null

  const progress = Number(raw)
  if (!Number.isFinite(progress) || progress < 0 || progress > 1) return null

  const direction: FreezeDirection =
    params.get('dir') === 'back' ? 'back' : DEFAULT_DIRECTION

  return { progress, dir: direction === 'back' ? -1 : 1, direction }
}

let cached: FreezeState | null | undefined

/**
 * The freeze request for this page load, or `null`. Parsed once: the URL does
 * not change under a running scene, so a per-frame caller pays nothing.
 */
export function getFreeze(): FreezeState | null {
  if (cached === undefined) {
    cached = typeof location === 'undefined' ? null : parseFreeze(location.search)
  }
  return cached
}
