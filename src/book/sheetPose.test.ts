import { describe, expect, it } from 'vitest'
import type { FreezeState } from '../dev/freeze.ts'
import type { TurnDir } from '../state/bookState.ts'
import { frozenSheet } from './sheetPose.ts'
import { restFaces, turnFaces } from './turnFaces.ts'

const freeze = (progress: number, dir: TurnDir): FreezeState => ({
  progress,
  dir,
  direction: dir === 1 ? 'forward' : 'back',
})

describe('no freeze, no sheet', () => {
  it('returns null when no freeze was requested', () => {
    for (const spread of [0, 2, 4]) {
      expect(frozenSheet(null, spread, 5), `spread=${spread}`).toBeNull()
    }
  })
})

describe('forward freeze', () => {
  it('poses the turn from the current spread to the next one', () => {
    const frozen = frozenSheet(freeze(0.4, 1), 2, 5)

    expect(frozen).not.toBeNull()
    expect(frozen?.dir).toBe(1)
    expect(frozen?.faces).toEqual(turnFaces(2, 3, 1))
  })

  it('writes the raw progress as the sheet position', () => {
    // The harness pins the pose parameter, not the eased curve: `--t` is
    // written once and the sheet never animates.
    for (const progress of [0, 0.1, 0.25, 0.5, 0.75, 1]) {
      expect(frozenSheet(freeze(progress, 1), 1, 3)?.turn, `progress=${progress}`).toBe(progress)
    }
  })

  it('starts flat on the right with the recto up', () => {
    const frozen = frozenSheet(freeze(0, 1), 2, 5)

    expect(frozen?.turn).toBe(0)
    // p = 0: the sheet rests on the right page of the spread it came from.
    expect(frozen?.faces.recto).toEqual(restFaces(2).staticRight)
    expect(frozen?.faces.staticLeft).toEqual(restFaces(2).staticLeft)
  })

  it('lands flat on the left with the verso up', () => {
    const frozen = frozenSheet(freeze(1, 1), 2, 5)

    expect(frozen?.turn).toBe(1)
    // p = 1: the sheet has landed on the left page of the next spread.
    expect(frozen?.faces.verso).toEqual(restFaces(3).staticLeft)
    expect(frozen?.faces.staticRight).toEqual(restFaces(3).staticRight)
  })

  it('has no pose at the last spread, because there is no page to turn to', () => {
    expect(frozenSheet(freeze(0.5, 1), 4, 5)).toBeNull()
    expect(frozenSheet(freeze(0, 1), 0, 1)).toBeNull()
  })

  it('advances the sheet position monotonically through the turn', () => {
    const turns = [0, 0.25, 0.5, 0.75, 1].map(
      (progress) => frozenSheet(freeze(progress, 1), 2, 5)?.turn,
    )

    turns.forEach((turn, index) => {
      if (index === 0) return
      expect(turn, `step ${index}`).toBeGreaterThan(turns[index - 1] as number)
    })
  })
})

describe('backward freeze', () => {
  it('poses the turn from the current spread to the previous one', () => {
    const frozen = frozenSheet(freeze(0.4, -1), 3, 5)

    expect(frozen).not.toBeNull()
    expect(frozen?.dir).toBe(-1)
    expect(frozen?.faces).toEqual(turnFaces(3, 2, -1))
  })

  it('reads the forward pose backwards: turn is 1 - progress', () => {
    for (const progress of [0, 0.1, 0.25, 0.5, 0.75, 1]) {
      const forward = frozenSheet(freeze(progress, 1), 2, 5)
      const backward = frozenSheet(freeze(1 - progress, -1), 3, 5)

      // Same physical sheet at the same curl, travelled the other way.
      expect(backward?.turn, `progress=${progress}`).toBeCloseTo(forward?.turn as number, 12)
      expect(backward?.faces, `progress=${progress}`).toEqual(forward?.faces)
      expect(backward?.dir, `progress=${progress}`).toBe(-1)
    }
  })

  it('starts on the left page it is leaving and ends on the right page it lands on', () => {
    const start = frozenSheet(freeze(0, -1), 3, 5)
    const end = frozenSheet(freeze(1, -1), 3, 5)

    expect(start?.turn).toBe(1)
    expect(start?.faces.verso).toEqual(restFaces(3).staticLeft)
    expect(end?.turn).toBe(0)
    expect(end?.faces.recto).toEqual(restFaces(2).staticRight)
  })

  it('decreases the sheet position monotonically through the turn', () => {
    const turns = [0, 0.25, 0.5, 0.75, 1].map(
      (progress) => frozenSheet(freeze(progress, -1), 3, 5)?.turn,
    )

    turns.forEach((turn, index) => {
      if (index === 0) return
      expect(turn, `step ${index}`).toBeLessThan(turns[index - 1] as number)
    })
  })

  it('has no pose at spread 0, because there is no page to turn back to', () => {
    expect(frozenSheet(freeze(0.5, -1), 0, 5)).toBeNull()
    expect(frozenSheet(freeze(0.5, -1), 0, 1)).toBeNull()
  })
})

describe('both directions', () => {
  it('always emits a finite sheet position in 0..1', () => {
    for (const dir of [1, -1] as const) {
      for (const progress of [0, 0.001, 0.5, 0.999, 1]) {
        const turn = frozenSheet(freeze(progress, dir), 2, 5)?.turn
        expect(Number.isFinite(turn), `dir=${dir} progress=${progress}`).toBe(true)
        expect(turn, `dir=${dir} progress=${progress}`).toBeGreaterThanOrEqual(0)
        expect(turn, `dir=${dir} progress=${progress}`).toBeLessThanOrEqual(1)
      }
    }
  })

  it('uses four distinct page slots from origin and destination', () => {
    const faces = frozenSheet(freeze(0.5, 1), 2, 5)?.faces
    expect(faces).toBeDefined()

    const slots = [faces?.staticLeft, faces?.staticRight, faces?.recto, faces?.verso].map(
      (ref) => `${ref?.spread}:${ref?.side}`,
    )
    expect(new Set(slots).size).toBe(4)
  })
})

describe('book edge cases and unchecked origins', () => {
  it('has no pose in an empty book', () => {
    for (const dir of [1, -1] as const) {
      expect(frozenSheet(freeze(0.5, dir), 0, 0), `dir=${dir}`).toBeNull()
    }
  })

  it('has no pose in a single-spread book, in either direction', () => {
    // One spread is both the first and the last: there is nothing to turn to.
    expect(frozenSheet(freeze(0.5, 1), 0, 1)).toBeNull()
    expect(frozenSheet(freeze(0.5, -1), 0, 1)).toBeNull()
  })

  it('only bounds-checks the destination spread, not the origin', () => {
    // NOTE: a negative origin still produces a pose (turnFaces passes the
    // index through); Book.tsx clamps the store's spread before calling. A
    // backward freeze from spread == spreadCount is likewise not rejected.
    const negative = frozenSheet(freeze(0.5, 1), -1, 5)
    expect(negative).not.toBeNull()
    expect(negative?.faces.recto.spread).toBe(-1)
    expect(negative?.faces.verso.spread).toBe(0)

    const pastEnd = frozenSheet(freeze(0.5, -1), 5, 5)
    expect(pastEnd).not.toBeNull()
    expect(pastEnd?.faces.verso.spread).toBe(5)
    expect(pastEnd?.faces.recto.spread).toBe(4)
  })
})
