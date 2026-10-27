import type { BookPhase } from '../state/bookState'

/**
 * The one-line control hint. Presentational only: `App` owns the phase and the
 * key handling, this file owns the copy and the live region.
 *
 * Placement is CSS's job (`.hint`): the pill is anchored under the top bar, not
 * at the bottom of the viewport, where it used to sit on top of the page footer
 * on short screens.
 */

export interface HintProps {
  readonly phase: BookPhase
}

const HINTS: Readonly<Record<BookPhase, string>> = {
  CLOSED: 'Click the book or press Space to open',
  OPENING: 'Opening…',
  OPEN: 'Left / Right turn pages · Esc closes',
  TURNING: 'Turning…',
  CLOSING: 'Closing…',
}

export function Hint({ phase }: HintProps) {
  return (
    <p className="hint" data-phase={phase} aria-live="polite">
      {HINTS[phase]}
    </p>
  )
}
