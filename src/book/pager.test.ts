import { describe, expect, it } from 'vitest'
import type { TurnDir } from '../state/bookState.ts'
import {
  advance,
  clampPosition,
  ordinalOf,
  pageCount,
  positionAt,
  retreat,
  stepFor,
  type PagePosition,
  type PagerStep,
} from './pager.ts'

const at = (spread: number, side: PagePosition['side']): PagePosition => ({ spread, side })

/** Every ordinal of a book, in reading order. */
const ordinalsOf = (spreadCount: number): number[] =>
  Array.from({ length: pageCount(spreadCount) }, (_, index) => index)

/** Walk a book one page at a time, with a runaway guard instead of a `while`. */
function walk(spreadCount: number, dir: TurnDir): PagerStep[] {
  const total = pageCount(spreadCount)
  let position = positionAt(dir === 1 ? 0 : total - 1, spreadCount)
  const steps: PagerStep[] = []

  for (let guard = 0; guard <= total; guard += 1) {
    const step = dir === 1 ? advance(position, spreadCount) : retreat(position, spreadCount)
    if (step === null) return steps
    steps.push(step)
    position = step.to
  }

  throw new Error(`walk(${spreadCount}, ${dir}) did not terminate after ${total} steps`)
}

describe('page order across a spread sequence', () => {
  it('allots two pages to every spread', () => {
    for (const spreadCount of [1, 2, 5, 13]) {
      expect(pageCount(spreadCount), `spreadCount=${spreadCount}`).toBe(spreadCount * 2)
    }
  })

  it('maps ordinal 0 to the first spread left and ordinal 1 to its right', () => {
    expect(positionAt(0, 3)).toEqual(at(0, 'left'))
    expect(positionAt(1, 3)).toEqual(at(0, 'right'))
    expect(positionAt(2, 3)).toEqual(at(1, 'left'))
    expect(positionAt(3, 3)).toEqual(at(1, 'right'))
  })

  it('advancing from the first page visits every page in reading order', () => {
    for (const spreadCount of [1, 2, 5]) {
      const steps = walk(spreadCount, 1)
      const total = pageCount(spreadCount)

      expect(steps, `spreadCount=${spreadCount}`).toHaveLength(total - 1)
      steps.forEach((step, index) => {
        expect(step.to, `spreadCount=${spreadCount} step=${index}`).toEqual(
          positionAt(index + 1, spreadCount),
        )
      })
    }
  })

  it('retreating from the last page visits every page in reverse order', () => {
    for (const spreadCount of [1, 2, 5]) {
      const steps = walk(spreadCount, -1)
      const total = pageCount(spreadCount)

      expect(steps, `spreadCount=${spreadCount}`).toHaveLength(total - 1)
      steps.forEach((step, index) => {
        expect(step.to, `spreadCount=${spreadCount} step=${index}`).toEqual(
          positionAt(total - 2 - index, spreadCount),
        )
      })
    }
  })

  it('positionAt and ordinalOf round-trip for every page', () => {
    for (const spreadCount of [1, 2, 3, 7]) {
      for (const ordinal of ordinalsOf(spreadCount)) {
        const position = positionAt(ordinal, spreadCount)
        expect(ordinalOf(position), `spreadCount=${spreadCount} ordinal=${ordinal}`).toBe(ordinal)
        expect(positionAt(ordinalOf(position), spreadCount)).toEqual(position)
      }
    }
  })

  it('ordinalOf counts left before right inside each spread', () => {
    expect(ordinalOf(at(0, 'left'))).toBe(0)
    expect(ordinalOf(at(0, 'right'))).toBe(1)
    expect(ordinalOf(at(1, 'left'))).toBe(2)
    expect(ordinalOf(at(1, 'right'))).toBe(3)
  })
})

describe('side flips versus spread boundaries', () => {
  it('advance flips the side inside the current spread', () => {
    for (const spread of [0, 1, 2, 3]) {
      expect(advance(at(spread, 'left'), 5)).toEqual({
        to: at(spread, 'right'),
        kind: 'side',
        dir: 1,
      })
    }
  })

  it('advance enters the next spread on its left page', () => {
    for (const spread of [0, 1, 2, 3]) {
      expect(advance(at(spread, 'right'), 5)).toEqual({
        to: at(spread + 1, 'left'),
        kind: 'spread',
        dir: 1,
      })
    }
  })

  it('retreat flips the side inside the current spread', () => {
    for (const spread of [0, 1, 2, 4]) {
      expect(retreat(at(spread, 'right'), 5)).toEqual({
        to: at(spread, 'left'),
        kind: 'side',
        dir: -1,
      })
    }
  })

  it('retreat enters the previous spread on its right page', () => {
    for (const spread of [1, 2, 4]) {
      expect(retreat(at(spread, 'left'), 5)).toEqual({
        to: at(spread - 1, 'right'),
        kind: 'spread',
        dir: -1,
      })
    }
  })

  it('crosses a boundary exactly when the ordinal changes parity', () => {
    const spreadCount = 4
    for (const ordinal of ordinalsOf(spreadCount).slice(0, -1)) {
      const position = positionAt(ordinal, spreadCount)
      const forward = advance(position, spreadCount)

      expect(forward?.kind, `advance from ordinal ${ordinal}`).toBe(
        ordinal % 2 === 1 ? 'spread' : 'side',
      )

      if (ordinal === 0) {
        expect(retreat(position, spreadCount), 'retreat from the first page').toBeNull()
      } else {
        expect(retreat(position, spreadCount)?.kind, `retreat from ordinal ${ordinal}`).toBe(
          ordinal % 2 === 0 ? 'spread' : 'side',
        )
      }
    }

    // The last page can only go back, and that is a side flip.
    const last = pageCount(spreadCount) - 1
    expect(retreat(positionAt(last, spreadCount), spreadCount)?.kind).toBe('side')
  })

  it('stepFor is advance for +1 and retreat for -1', () => {
    for (const position of [at(0, 'left'), at(0, 'right'), at(2, 'left'), at(4, 'right')]) {
      expect(stepFor(1, position, 5)).toEqual(advance(position, 5))
      expect(stepFor(-1, position, 5)).toEqual(retreat(position, 5))
    }
  })

  it('a forward sweep asks the store once per boundary and never on a side flip', () => {
    const spreadCount = 5
    let position = positionAt(0, spreadCount)
    let storeCalls = 0
    let storeSpread = 0
    let sideFlips = 0

    for (;;) {
      const step = advance(position, spreadCount)
      if (step === null) break

      if (step.kind === 'spread') {
        // Exactly one next() per boundary, and it lands on the new spread.
        storeCalls += 1
        storeSpread += step.dir
        expect(storeSpread, `after spread step from ${position.spread}`).toBe(step.to.spread)
      } else {
        // A side flip is local UI state: the store is not called at all.
        sideFlips += 1
        expect(step.to.spread).toBe(position.spread)
        expect(storeSpread).toBe(position.spread)
      }

      position = step.to
    }

    expect(storeCalls).toBe(spreadCount - 1)
    expect(sideFlips).toBe(spreadCount)
    expect(storeSpread).toBe(spreadCount - 1)
  })

  it('a backward sweep asks the store once per boundary and never on a side flip', () => {
    const spreadCount = 5
    let position = positionAt(pageCount(spreadCount) - 1, spreadCount)
    let storeCalls = 0
    let storeSpread = spreadCount - 1
    let sideFlips = 0

    for (;;) {
      const step = retreat(position, spreadCount)
      if (step === null) break

      if (step.kind === 'spread') {
        storeCalls += 1
        storeSpread += step.dir
        expect(storeSpread, `after spread step from ${position.spread}`).toBe(step.to.spread)
      } else {
        sideFlips += 1
        expect(step.to.spread).toBe(position.spread)
        expect(storeSpread).toBe(position.spread)
      }

      position = step.to
    }

    expect(storeCalls).toBe(spreadCount - 1)
    expect(sideFlips).toBe(spreadCount)
    expect(storeSpread).toBe(0)
  })

  it('carries the travel direction the store uses, not the spread delta', () => {
    for (const step of walk(4, 1)) expect(step.dir).toBe(1)
    for (const step of walk(4, -1)) expect(step.dir).toBe(-1)
  })
})

describe('clamping at the first and last page', () => {
  it('advance at the last page returns null instead of overshooting', () => {
    for (const spreadCount of [1, 2, 5]) {
      const last = positionAt(pageCount(spreadCount) - 1, spreadCount)
      expect(advance(last, spreadCount), `spreadCount=${spreadCount}`).toBeNull()
    }
  })

  it('retreat at the first page returns null instead of going negative', () => {
    for (const spreadCount of [1, 2, 5]) {
      expect(retreat(positionAt(0, spreadCount), spreadCount), `spreadCount=${spreadCount}`).toBeNull()
    }
  })

  it('clampPosition pulls a negative spread up to the first page', () => {
    expect(clampPosition(at(-9, 'left'), 3)).toEqual(at(0, 'left'))
    expect(clampPosition(at(-1, 'right'), 3)).toEqual(at(0, 'right'))
  })

  it('clamps an overshooting spread to the last page of the book', () => {
    // The end of the book is the right page of the last spread, so even an
    // overshooting left page clamps to that right page.
    expect(clampPosition(at(99, 'left'), 3)).toEqual(at(2, 'right'))
    expect(clampPosition(at(99, 'right'), 3)).toEqual(at(2, 'right'))
  })

  it('clampPosition leaves every in-range position untouched', () => {
    for (const spreadCount of [1, 2, 5]) {
      for (const ordinal of ordinalsOf(spreadCount)) {
        const position = positionAt(ordinal, spreadCount)
        expect(clampPosition(position, spreadCount), `spreadCount=${spreadCount}`).toEqual(position)
      }
    }
  })

  it('clampPosition never returns a page outside the book', () => {
    for (const spreadCount of [0, 1, 3]) {
      for (const spread of [-5, -1, 0, 2, 99, Number.NaN, Number.POSITIVE_INFINITY]) {
        for (const side of ['left', 'right'] as const) {
          const clamped = clampPosition({ spread, side }, spreadCount)
          const total = pageCount(spreadCount)
          const label = `spreadCount=${spreadCount} spread=${spread} side=${side}`

          if (total === 0) {
            // No page exists; the position is still well-formed so a caller can
            // pass it to a lookup, which resolves it to null. With no pages
            // there is no side to honour either.
            expect(clamped, label).toEqual(at(0, 'left'))
          } else {
            expect(clamped.spread, label).toBeGreaterThanOrEqual(0)
            expect(clamped.spread, label).toBeLessThanOrEqual(total - 1)
          }
        }
      }
    }
  })

  it('clamps an out-of-range ordinal to the ends', () => {
    expect(positionAt(-1, 3)).toEqual(at(0, 'left'))
    expect(positionAt(Number.NEGATIVE_INFINITY, 3)).toEqual(at(0, 'left'))
    expect(positionAt(Number.NaN, 3)).toEqual(at(0, 'left'))
    expect(positionAt(pageCount(3), 3)).toEqual(at(2, 'right'))
    expect(positionAt(1e9, 3)).toEqual(at(2, 'right'))
    // NOTE: only finite ordinals clamp to the far end; +Infinity is treated
    // like NaN and lands on the first page. No caller can produce it (the
    // store clamps and `advance`/`retreat` never build an ordinal).
    expect(positionAt(Number.POSITIVE_INFINITY, 3)).toEqual(at(0, 'left'))
  })

  it('retreat from a position past the last page returns null rather than clamping in', () => {
    // NOTE: `retreat` reads `ordinalOf(position)` directly, unlike
    // `clampPosition`. A stale upstream spread therefore yields "no step"
    // instead of walking back into the book; BookStage clamps before paging.
    expect(retreat(at(9, 'left'), 3)).toBeNull()
    expect(retreat(at(9, 'right'), 3)).toBeNull()
    expect(advance(at(9, 'left'), 3)).toBeNull()
  })

  it('advance from a negative spread behaves as if on the first page', () => {
    // `ordinalOf` clamps the spread, so the move is a legal side flip.
    expect(advance(at(-2, 'left'), 3)).toEqual({
      to: at(0, 'right'),
      kind: 'side',
      dir: 1,
    })
  })
})

describe('book edge cases', () => {
  it('a single-spread book only ever flips its two sides', () => {
    expect(pageCount(1)).toBe(2)
    expect(advance(at(0, 'left'), 1)).toEqual({ to: at(0, 'right'), kind: 'side', dir: 1 })
    expect(retreat(at(0, 'right'), 1)).toEqual({ to: at(0, 'left'), kind: 'side', dir: -1 })
    expect(advance(at(0, 'right'), 1)).toBeNull()
    expect(retreat(at(0, 'left'), 1)).toBeNull()

    for (const step of walk(1, 1)) expect(step.kind).toBe('side')
    for (const step of walk(1, -1)) expect(step.kind).toBe('side')
  })

  it('an empty book has no pages and no steps', () => {
    expect(pageCount(0)).toBe(0)
    expect(advance(at(0, 'left'), 0)).toBeNull()
    expect(retreat(at(0, 'left'), 0)).toBeNull()
    // Pinned: the "no book" position is shape-valid but names no real page;
    // pageFor() resolves it to null. The contract is "never throws", not
    // "returns undefined".
    expect(positionAt(0, 0)).toEqual(at(0, 'left'))
    expect(clampPosition(at(3, 'right'), 0)).toEqual(at(0, 'left'))
  })

  it('treats a non-positive or non-finite spread count as an empty book', () => {
    for (const spreadCount of [0, -1, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const label = `spreadCount=${spreadCount}`
      expect(pageCount(spreadCount), label).toBe(0)
      expect(advance(at(0, 'left'), spreadCount), label).toBeNull()
      expect(retreat(at(0, 'right'), spreadCount), label).toBeNull()
    }
  })

  it('truncates a fractional spread count before doubling it', () => {
    expect(pageCount(2.9)).toBe(4)
    expect(pageCount(0.9)).toBe(0)
    expect(pageCount(1.5)).toBe(2)
    expect(positionAt(3, 2.9)).toEqual(at(1, 'right'))
    expect(advance(at(1, 'right'), 2.9)).toBeNull()
  })

  it('clamps a non-finite spread inside a position to the first page', () => {
    expect(ordinalOf({ spread: Number.NaN, side: 'left' })).toBe(0)
    expect(ordinalOf({ spread: Number.NaN, side: 'right' })).toBe(1)
    expect(ordinalOf({ spread: Number.POSITIVE_INFINITY, side: 'left' })).toBe(0)
  })

  it('never returns a destination outside the book for hostile starts', () => {
    const starts: PagePosition[] = [
      at(-3, 'left'),
      at(-1, 'right'),
      at(0, 'left'),
      at(2.9, 'right'),
      at(99, 'left'),
      at(99, 'right'),
      at(Number.NaN, 'left'),
    ]

    for (const spreadCount of [0, 1, 2, 5, Number.NaN, Number.POSITIVE_INFINITY]) {
      for (const position of starts) {
        for (const dir of [1, -1] as const) {
          const step = stepFor(dir, position, spreadCount)
          if (step === null) continue

          const total = pageCount(spreadCount)
          const label = `spreadCount=${spreadCount} spread=${position.spread} dir=${dir}`
          expect(total, label).toBeGreaterThan(0)
          expect(step.to.spread, label).toBeGreaterThanOrEqual(0)
          expect(step.to.spread, label).toBeLessThanOrEqual(total - 1)
          expect(['left', 'right']).toContain(step.to.side)
        }
      }
    }
  })
})
