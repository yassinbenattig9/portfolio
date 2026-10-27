/**
 * The book state machine.
 *
 * Commands are guards-only: they mutate discrete facts (phase, spread id and a
 * start timestamp) or do nothing at all. Nothing here is queued and nothing
 * here animates, so rapid or duplicate input can never corrupt the book.
 *
 * Progress is never stored. The scene derives it per frame from `progressAt`
 * in `timing.ts`, so React re-renders only when a command flips the phase
 * (at most twice per transition) instead of once per frame.
 *
 * No `three` and no `react` imports: this module must stay testable in node and
 * reusable by the future CSS-3D fallback.
 */
import { create } from 'zustand'
import { BACK_DURATION_MS, FORWARD_DURATION_MS, type Transition } from './timing.ts'

export type BookPhase = 'CLOSED' | 'OPENING' | 'OPEN' | 'TURNING' | 'CLOSING'

/** Direction of a page turn, matching the sign of `to - from`. */
export type TurnDir = 1 | -1

export interface PageTurn extends Transition {
  readonly from: number
  readonly to: number
  readonly dir: TurnDir
}

/** Discrete facts shared by the 3D scene and the 2D chrome. */
export interface BookData {
  readonly phase: BookPhase
  /** Index of the spread currently being shown (or turned away from). */
  readonly spread: number
  /** Index of the highest meaningful spread; `-1` means the book is empty. */
  readonly lastSpread: number
  /** Set only while `phase === 'TURNING'`. */
  readonly turn: PageTurn | null
  /** Set only while `phase === 'OPENING'` or `phase === 'CLOSING'`. */
  readonly open: Transition | null
}

export interface BookActions {
  /** Declare how many spreads exist. Derives `lastSpread`; never moves the book. */
  setSpreadCount: (n: number) => void
  /**
   * The spec calls this command `open()`, but the stored open window is also
   * named `open`, and a flat store cannot hold both. The data field wins the
   * name (the scene reads `state.open` every frame); the command is `openBook`.
   */
  openBook: (now?: number) => void
  commitOpen: () => void
  next: (now?: number) => void
  prev: (now?: number) => void
  jump: (n: number, now?: number) => void
  close: (now?: number) => void
  commitClose: () => void
  commitTurn: () => void
}

export type BookState = BookData & BookActions

/** Duration for a turn in the given direction: 900 ms forward, 800 ms back. */
export function turnDuration(dir: TurnDir): number {
  return dir === 1 ? FORWARD_DURATION_MS : BACK_DURATION_MS
}

const direction = (delta: number): TurnDir => (delta < 0 ? -1 : 1)

export const useBookStore = create<BookState>()((set, get) => ({
  phase: 'CLOSED',
  spread: 0,
  lastSpread: 0,
  turn: null,
  open: null,

  setSpreadCount(n) {
    if (!(n >= 0) || !Number.isFinite(n)) return
    set({ lastSpread: Math.trunc(n) - 1 })
  },

  openBook(now = Date.now()) {
    if (get().phase !== 'CLOSED') return
    set({
      phase: 'OPENING',
      open: { startedAt: now, duration: FORWARD_DURATION_MS },
    })
  },

  commitOpen() {
    if (get().phase !== 'OPENING') return
    set({ phase: 'OPEN', open: null })
  },

  next(now = Date.now()) {
    const { phase, spread, lastSpread } = get()
    if (phase !== 'OPEN' || spread >= lastSpread) return
    set({
      phase: 'TURNING',
      turn: {
        from: spread,
        to: spread + 1,
        dir: 1,
        startedAt: now,
        duration: turnDuration(1),
      },
    })
  },

  prev(now = Date.now()) {
    const { phase, spread } = get()
    if (phase !== 'OPEN' || spread <= 0) return
    set({
      phase: 'TURNING',
      turn: {
        from: spread,
        to: spread - 1,
        dir: -1,
        startedAt: now,
        duration: turnDuration(-1),
      },
    })
  },

  jump(n, now = Date.now()) {
    const { phase, spread, lastSpread } = get()
    if (phase !== 'OPEN' || !Number.isFinite(n)) return
    const upper = Math.max(lastSpread, 0)
    const to = Math.min(Math.max(Math.trunc(n), 0), upper)
    if (to === spread) return
    const dir = direction(to - spread)
    set({
      phase: 'TURNING',
      turn: {
        from: spread,
        to,
        dir,
        startedAt: now,
        duration: turnDuration(dir),
      },
    })
  },

  close(now = Date.now()) {
    // Deliberately dropped during TURNING: a commitTurn must not land on a
    // book that is already closing.
    if (get().phase !== 'OPEN') return
    set({
      phase: 'CLOSING',
      open: { startedAt: now, duration: BACK_DURATION_MS },
    })
  },

  commitClose() {
    if (get().phase !== 'CLOSING') return
    set({ phase: 'CLOSED', open: null })
  },

  commitTurn() {
    const { phase, turn } = get()
    if (phase !== 'TURNING' || turn === null) return
    set({ phase: 'OPEN', spread: turn.to, turn: null })
  },
}))

/** Non-React access path for the scene and other imperative call sites. */
export const getBookState = (): BookState => useBookStore.getState()

/** Non-React subscription, e.g. for a CSS-3D fallback outside React. */
export const subscribeBook = (
  listener: (state: BookState, previousState: BookState) => void,
): (() => void) => useBookStore.subscribe(listener)

/**
 * Dev-only consistency check. Throws with the list of violations in dev and
 * does nothing in a production build.
 */
export function assertInvariants(state: BookState = useBookStore.getState()): void {
  if (!import.meta.env.DEV) return

  const problems: string[] = []
  const { phase, spread, lastSpread, turn, open } = state

  if (!Number.isInteger(spread) || spread < 0) {
    problems.push(`spread must be a non-negative integer (got ${spread})`)
  }
  if (lastSpread >= 0 && spread > lastSpread) {
    problems.push(`spread ${spread} exceeds lastSpread ${lastSpread}`)
  }
  if (phase === 'TURNING' && turn === null) {
    problems.push('TURNING requires a turn')
  }
  if (phase !== 'TURNING' && turn !== null) {
    problems.push(`${phase} must not hold a turn`)
  }
  if ((phase === 'OPENING' || phase === 'CLOSING') && open === null) {
    problems.push(`${phase} requires an open window`)
  }
  if ((phase === 'CLOSED' || phase === 'OPEN' || phase === 'TURNING') && open !== null) {
    problems.push(`${phase} must not hold an open window`)
  }
  if (phase === 'OPEN' && turn !== null) {
    problems.push('OPEN must not hold a turn')
  }
  if (turn !== null && turn.from + turn.dir !== turn.to) {
    problems.push(`turn from ${turn.from} dir ${turn.dir} does not reach ${turn.to}`)
  }

  if (problems.length > 0) {
    throw new Error(`bookState invariant violation: ${problems.join('; ')}`)
  }
}
