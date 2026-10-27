import { beforeEach, describe, expect, it } from 'vitest'
import {
  assertInvariants,
  getBookState,
  turnDuration,
  useBookStore,
  type TurnDir,
} from './bookState.ts'

/**
 * The store is a module singleton, so every test starts from a known state.
 * `setState` merges by default, which keeps the action functions in place.
 */
function reset(): void {
  useBookStore.setState({ phase: 'CLOSED', spread: 0, lastSpread: 0, turn: null, open: null })
}

/** Drives a fresh book into OPEN at `spread`, with `lastSpread` spreads behind it. */
function openAt(spread = 0, last = 4): void {
  reset()
  const store = getBookState()
  store.setSpreadCount(last + 1)
  store.openBook(0)
  store.commitOpen()

  if (spread !== 0) {
    store.jump(spread, 0)
    store.commitTurn()
  }
}

beforeEach(reset)

describe('next', () => {
  it('starts a forward turn from the current spread without moving it yet', () => {
    openAt(0, 4)

    getBookState().next(1_000)

    const state = getBookState()
    expect(state.phase).toBe('TURNING')
    expect(state.spread).toBe(0)
    expect(state.turn).toEqual({ from: 0, to: 1, dir: 1, startedAt: 1_000, duration: 900 })
  })

  it('is a no-op at the last spread', () => {
    openAt(4, 4)

    getBookState().next(1_000)

    const state = getBookState()
    expect(state.phase).toBe('OPEN')
    expect(state.spread).toBe(4)
    expect(state.turn).toBeNull()
  })

  it('advances only one spread when clicked twice with the same timestamp', () => {
    openAt(0, 4)

    getBookState().next(500)
    const firstTurn = getBookState().turn
    getBookState().next(500)

    const during = getBookState()
    expect(during.turn).toBe(firstTurn) // the second click was dropped, not queued
    expect(during.turn?.to).toBe(1)

    getBookState().commitTurn()

    const after = getBookState()
    expect(after.spread).toBe(1)
    expect(after.phase).toBe('OPEN')
    expect(after.turn).toBeNull() // nothing left over to replay
  })

  it('is ignored while the book is opening', () => {
    reset()
    getBookState().setSpreadCount(5)
    getBookState().openBook(0)

    getBookState().next(10)

    const state = getBookState()
    expect(state.phase).toBe('OPENING')
    expect(state.spread).toBe(0)
    expect(state.turn).toBeNull()
  })

  it('is ignored while the book is closing', () => {
    openAt(0, 4)
    getBookState().close(0)

    getBookState().next(10)

    const state = getBookState()
    expect(state.phase).toBe('CLOSING')
    expect(state.turn).toBeNull()
  })

  it('is ignored while the book is closed', () => {
    reset()
    getBookState().setSpreadCount(5)

    getBookState().next(10)

    const state = getBookState()
    expect(state.phase).toBe('CLOSED')
    expect(state.turn).toBeNull()
  })
})

describe('prev', () => {
  it('is a no-op at spread 0', () => {
    openAt(0, 4)

    getBookState().prev(1_000)

    const state = getBookState()
    expect(state.phase).toBe('OPEN')
    expect(state.spread).toBe(0)
    expect(state.turn).toBeNull()
  })

  it('starts a backward turn with the backward duration', () => {
    openAt(3, 4)

    getBookState().prev(1_000)

    const state = getBookState()
    expect(state.phase).toBe('TURNING')
    expect(state.turn).toEqual({ from: 3, to: 2, dir: -1, startedAt: 1_000, duration: 800 })
  })

  it('is ignored during a forward turn and leaves the turn untouched', () => {
    openAt(0, 4)
    getBookState().next(1_000)
    const forwardTurn = getBookState().turn

    getBookState().prev(2_000)

    const state = getBookState()
    expect(state.phase).toBe('TURNING')
    expect(state.turn).toBe(forwardTurn)
    expect(state.turn?.startedAt).toBe(1_000)
    expect(state.turn?.to).toBe(1)
  })
})

describe('jump', () => {
  it('clamps a target above the last spread', () => {
    openAt(0, 4)

    getBookState().jump(99, 0)

    expect(getBookState().turn?.to).toBe(4)
    expect(getBookState().turn?.dir).toBe(1)

    getBookState().commitTurn()
    expect(getBookState().spread).toBe(4)
  })

  it('clamps a negative target to spread 0', () => {
    openAt(4, 4)

    getBookState().jump(-3, 0)

    expect(getBookState().turn).toMatchObject({ from: 4, to: 0, dir: -1, duration: 800 })
  })

  it('is a no-op when the target is the current spread', () => {
    openAt(2, 4)

    getBookState().jump(2, 0)

    const state = getBookState()
    expect(state.phase).toBe('OPEN')
    expect(state.turn).toBeNull()
  })

  it('uses a forward direction when jumping later in the book', () => {
    openAt(1, 4)

    getBookState().jump(3, 0)

    expect(getBookState().turn).toMatchObject({ from: 1, to: 3, dir: 1, duration: 900 })
  })

  it('uses a backward direction when jumping earlier in the book', () => {
    openAt(1, 4)

    getBookState().jump(0, 0)

    expect(getBookState().turn).toMatchObject({ from: 1, to: 0, dir: -1, duration: 800 })
  })

  it('is ignored while a turn is in flight', () => {
    openAt(0, 4)
    getBookState().next(0)
    const turn = getBookState().turn

    getBookState().jump(3, 10)

    expect(getBookState().turn).toBe(turn)
  })

  it('is ignored while the book is closed', () => {
    reset()
    getBookState().setSpreadCount(5)

    getBookState().jump(2, 0)

    expect(getBookState().phase).toBe('CLOSED')
    expect(getBookState().turn).toBeNull()
  })
})

describe('commitTurn', () => {
  it('is a no-op from OPEN', () => {
    openAt(1, 4)

    getBookState().commitTurn()

    const state = getBookState()
    expect(state.phase).toBe('OPEN')
    expect(state.spread).toBe(1)
    expect(state.turn).toBeNull()
  })

  it('commits the turn target and clears the turn', () => {
    openAt(1, 4)
    getBookState().jump(3, 0)

    getBookState().commitTurn()

    const state = getBookState()
    expect(state.phase).toBe('OPEN')
    expect(state.spread).toBe(3)
    expect(state.turn).toBeNull()
  })
})

describe('openBook / commitOpen', () => {
  it('starts opening only from CLOSED', () => {
    openAt(0, 4)

    getBookState().openBook(5_000)

    const state = getBookState()
    expect(state.phase).toBe('OPEN')
    expect(state.open).toBeNull()
  })

  it('does not restart an opening already in flight', () => {
    reset()
    getBookState().setSpreadCount(5)
    getBookState().openBook(1_000)

    getBookState().openBook(2_000)

    expect(getBookState().open).toEqual({ startedAt: 1_000, duration: 900 })
  })

  it('opens with the forward duration', () => {
    reset()
    getBookState().setSpreadCount(5)

    getBookState().openBook(1_000)

    expect(getBookState().phase).toBe('OPENING')
    expect(getBookState().open).toEqual({ startedAt: 1_000, duration: 900 })
  })

  it('commitOpen only commits from OPENING', () => {
    reset()
    getBookState().setSpreadCount(5)

    getBookState().commitOpen()
    expect(getBookState().phase).toBe('CLOSED')

    openAt(0, 4)
    getBookState().commitOpen()
    expect(getBookState().phase).toBe('OPEN')
  })
})

describe('close / commitClose', () => {
  it('is dropped during a turn', () => {
    openAt(0, 4)
    getBookState().next(0)

    getBookState().close(10)

    const state = getBookState()
    expect(state.phase).toBe('TURNING')
    expect(state.open).toBeNull()
    expect(state.turn?.to).toBe(1)
  })

  it('starts closing from OPEN with the backward duration', () => {
    openAt(2, 4)

    getBookState().close(1_000)

    const state = getBookState()
    expect(state.phase).toBe('CLOSING')
    expect(state.open).toEqual({ startedAt: 1_000, duration: 800 })
  })

  it('commitClose only commits from CLOSING', () => {
    reset()

    getBookState().commitClose()
    expect(getBookState().phase).toBe('CLOSED')

    openAt(0, 4)
    getBookState().commitClose()
    expect(getBookState().phase).toBe('OPEN')

    getBookState().close(0)
    getBookState().commitClose()
    expect(getBookState().phase).toBe('CLOSED')
    expect(getBookState().open).toBeNull()
  })
})

describe('setSpreadCount', () => {
  it('sets lastSpread to n - 1', () => {
    getBookState().setSpreadCount(3)
    expect(getBookState().lastSpread).toBe(2)

    getBookState().setSpreadCount(1)
    expect(getBookState().lastSpread).toBe(0)
  })

  it('sets lastSpread to -1 for an empty book', () => {
    getBookState().setSpreadCount(5)

    getBookState().setSpreadCount(0)

    expect(getBookState().lastSpread).toBe(-1)
  })

  it('truncates a fractional count', () => {
    getBookState().setSpreadCount(2.9)

    expect(getBookState().lastSpread).toBe(1)
  })

  it('ignores negative, NaN and infinite counts', () => {
    getBookState().setSpreadCount(5)
    expect(getBookState().lastSpread).toBe(4)

    for (const bad of [-1, -3.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      getBookState().setSpreadCount(bad)
      expect(getBookState().lastSpread).toBe(4)
    }
  })

  it('never moves the book', () => {
    openAt(2, 4)

    getBookState().setSpreadCount(10)

    const state = getBookState()
    expect(state.spread).toBe(2)
    expect(state.phase).toBe('OPEN')
  })
})

describe('turnDuration', () => {
  it('is 900 ms forward and 800 ms back', () => {
    expect(turnDuration(1)).toBe(900)
    expect(turnDuration(-1)).toBe(800)
  })

  it('matches the durations used by next() and prev()', () => {
    const directions: TurnDir[] = [1, -1]
    expect(directions.map(turnDuration)).toEqual([900, 800])
  })
})

describe('assertInvariants', () => {
  it('accepts every step of a full happy-path cycle', () => {
    const store = getBookState()

    expect(() => assertInvariants()).not.toThrow() // CLOSED

    store.setSpreadCount(5)
    expect(() => assertInvariants()).not.toThrow()

    store.openBook(0)
    expect(() => assertInvariants()).not.toThrow() // OPENING

    store.commitOpen()
    expect(() => assertInvariants()).not.toThrow() // OPEN

    store.next(0)
    expect(() => assertInvariants()).not.toThrow() // TURNING

    store.commitTurn()
    expect(() => assertInvariants()).not.toThrow() // OPEN at spread 1
    expect(getBookState().spread).toBe(1)

    store.close(1_000)
    expect(() => assertInvariants()).not.toThrow() // CLOSING

    store.commitClose()
    expect(() => assertInvariants()).not.toThrow() // CLOSED again
    expect(getBookState().phase).toBe('CLOSED')
  })

  it('rejects a TURNING phase that holds no turn', () => {
    useBookStore.setState({ phase: 'TURNING', turn: null })

    expect(() => assertInvariants()).toThrow(/TURNING requires a turn/)
  })

  it('rejects a spread beyond lastSpread', () => {
    useBookStore.setState({ spread: 9, lastSpread: 4 })

    expect(() => assertInvariants()).toThrow(/exceeds lastSpread/)
  })
})

describe('state shape', () => {
  it('never stores per-frame progress', () => {
    openAt(0, 4)
    getBookState().next(0)

    const state = getBookState()

    expect(Object.prototype.hasOwnProperty.call(state, 'progress')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(state, 'progressAt')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(state.turn, 'progress')).toBe(false)
    expect(Object.keys(state)).not.toContain('progress')
    expect(Object.keys(state)).not.toContain('progressAt')
  })
})
