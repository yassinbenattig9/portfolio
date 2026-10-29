import { describe, expect, it } from 'vitest'
import {
  BACK_DURATION_MS,
  FORWARD_DURATION_MS,
  easeInOutCubic,
  progressAt,
  type Transition,
} from '../state/timing.ts'
import type { PageTurn, TurnDir } from '../state/bookState.ts'
import { frameStep, type FrameStepInput, type FrameStepOutput } from './frameStep.ts'
import { opennessFor } from './bookPose.ts'

const T0 = 1_000

const openWindow = (duration: number = FORWARD_DURATION_MS): Transition => ({
  startedAt: T0,
  duration,
})

const turnWindow = (duration: number = FORWARD_DURATION_MS, dir: TurnDir = 1): PageTurn => ({
  from: dir === 1 ? 0 : 1,
  to: dir === 1 ? 1 : 0,
  dir,
  startedAt: T0,
  duration,
})

const run = (input: FrameStepInput) => frameStep(input)

/** Sample times sweeping the whole window, including past its end. */
const SWEEP = [0, 0.05, 0.2, 0.37, 0.5, 0.63, 0.8, 0.95, 1, 1.4, 40]
const elapsedAt = (fraction: number, duration: number): number => T0 + fraction * duration

describe('the opening window', () => {
  it('emits only openness 0 on the first frame, without committing', () => {
    expect(run({ phase: 'OPENING', open: openWindow(), turn: null, now: T0 })).toEqual({
      open: 0,
    })
  })

  it('is exactly halfway open at the midpoint of the window', () => {
    // easeInOutCubic(0.5) is exactly 0.5, so the pose is exact, not approximated.
    const duration = 400
    expect(
      run({ phase: 'OPENING', open: openWindow(duration), turn: null, now: T0 + duration / 2 }),
    ).toEqual({ open: 0.5 })
  })

  it('never commits before the window ends, then commits open at the boundary', () => {
    const duration = 400
    const before = run({
      phase: 'OPENING',
      open: openWindow(duration),
      turn: null,
      now: T0 + duration - 1,
    })
    expect(before.commit).toBeUndefined()
    expect(before.open).toBeLessThan(1)

    expect(
      run({ phase: 'OPENING', open: openWindow(duration), turn: null, now: T0 + duration }),
    ).toEqual({ open: 1, commit: 'open' })
  })

  it('matches opennessFor(OPENING, eased) exactly across a sweep of progress', () => {
    const duration = 400
    const open = openWindow(duration)
    for (const fraction of SWEEP) {
      const now = elapsedAt(fraction, duration)
      const progress = progressAt(open, now)
      const expected = opennessFor('OPENING', easeInOutCubic(progress))

      const step = run({ phase: 'OPENING', open, turn: null, now })
      expect(step.open, `progress=${progress}`).toBe(expected)
      expect(step.commit, `progress=${progress}`).toBe(progress >= 1 ? 'open' : undefined)
      expect(step.turn, `progress=${progress}`).toBeUndefined()
    }
  })
})

describe('the closing window', () => {
  it('runs the opening window backwards at the same clock, exactly', () => {
    const duration = BACK_DURATION_MS
    const closing = openWindow(duration)
    const opening = openWindow(duration)

    for (const fraction of SWEEP) {
      const now = elapsedAt(fraction, duration)
      const shut = run({ phase: 'CLOSING', open: closing, turn: null, now })
      const spread = run({ phase: 'OPENING', open: opening, turn: null, now })

      // The inverted-window rule: CLOSING is the OPENING pose read from the
      // other end, so they always sum to exactly 1.
      expect(shut.open, `fraction=${fraction}`).toBe(1 - (spread.open as number))
    }
  })

  it('starts fully open', () => {
    expect(run({ phase: 'CLOSING', open: openWindow(), turn: null, now: T0 })).toEqual({ open: 1 })
  })

  it('never commits before the window ends, then commits close at the boundary', () => {
    const duration = BACK_DURATION_MS
    const before = run({
      phase: 'CLOSING',
      open: openWindow(duration),
      turn: null,
      now: T0 + duration - 1,
    })
    expect(before.commit).toBeUndefined()
    expect(before.open).toBeGreaterThan(0)

    expect(
      run({ phase: 'CLOSING', open: openWindow(duration), turn: null, now: T0 + duration }),
    ).toEqual({ open: 0, commit: 'close' })
  })
})

describe('phases at rest without a window', () => {
  it('emits nothing at all for OPEN', () => {
    expect(run({ phase: 'OPEN', open: null, turn: null, now: T0 + 5 })).toEqual({})
  })

  it('emits nothing at all for CLOSED', () => {
    expect(run({ phase: 'CLOSED', open: null, turn: null, now: T0 + 5 })).toEqual({})
  })

  it('emits nothing rather than crashing when TURNING has no turn window', () => {
    expect(run({ phase: 'TURNING', open: null, turn: null, now: T0 + 5 })).toEqual({})
  })
})

describe('the turning window', () => {
  const ROWS = [0, 0.05, 0.25, 0.5, 0.75, 0.95, 1, 1.4, 40]
  const easedAt = (fraction: number, duration: number): number =>
    easeInOutCubic(progressAt(turnWindow(duration), elapsedAt(fraction, duration)))

  it('moves forward along the eased curve, exactly', () => {
    const duration = FORWARD_DURATION_MS
    for (const fraction of ROWS) {
      const now = elapsedAt(fraction, duration)
      expect(
        run({ phase: 'TURNING', open: null, turn: turnWindow(duration, 1), now }).turn,
        `fraction=${fraction}`,
      ).toBe(easedAt(fraction, duration))
    }
  })

  it('moves backward along the same curve read from the other end, exactly', () => {
    const duration = BACK_DURATION_MS
    for (const fraction of ROWS) {
      const now = elapsedAt(fraction, duration)
      const backward = run({ phase: 'TURNING', open: null, turn: turnWindow(duration, -1), now })
      expect(backward.turn, `fraction=${fraction}`).toBe(1 - easedAt(fraction, duration))
    }
  })

  it('commits turn for both directions on the first sample at progress 1, not before', () => {
    for (const dir of [1, -1] as const) {
      const duration = dir === 1 ? FORWARD_DURATION_MS : BACK_DURATION_MS
      const turn = turnWindow(duration, dir)

      const justBefore = run({ phase: 'TURNING', open: null, turn, now: T0 + duration - 1 })
      expect(justBefore.commit, `dir=${dir}`).toBeUndefined()

      const atEnd = run({ phase: 'TURNING', open: null, turn, now: T0 + duration })
      expect(atEnd.commit, `dir=${dir}`).toBe('turn')
    }
  })

  it('lands the sheet flat in both directions: forward at 1, backward at 0', () => {
    const forward = run({
      phase: 'TURNING',
      open: null,
      turn: turnWindow(FORWARD_DURATION_MS, 1),
      now: T0 + FORWARD_DURATION_MS,
    })
    const backward = run({
      phase: 'TURNING',
      open: null,
      turn: turnWindow(BACK_DURATION_MS, -1),
      now: T0 + BACK_DURATION_MS,
    })

    expect(forward).toEqual({ turn: 1, commit: 'turn' })
    expect(backward).toEqual({ turn: 0, commit: 'turn' })
  })
})

describe('the motion scale', () => {
  it('runs double speed at scale 2 and half speed at scale 0.5', () => {
    const duration = 400
    const turn = turnWindow(duration)

    // scale 2 divides the duration: the commit arrives at half the wall clock.
    expect(
      run({ phase: 'TURNING', open: null, turn, now: T0 + duration / 2, motionScale: 2 }).commit,
    ).toBe('turn')
    expect(
      run({ phase: 'TURNING', open: null, turn, now: T0 + duration / 2 - 1, motionScale: 2 }).commit,
    ).toBeUndefined()

    // scale 0.5 stretches the duration: the commit arrives at double the wall clock.
    expect(
      run({ phase: 'TURNING', open: null, turn, now: T0 + duration, motionScale: 0.5 }).commit,
    ).toBeUndefined()
    expect(
      run({ phase: 'TURNING', open: null, turn, now: T0 + duration * 2, motionScale: 0.5 }).commit,
    ).toBe('turn')
    expect(
      run({ phase: 'TURNING', open: null, turn, now: T0 + duration * 2, motionScale: 0.5 }).turn,
    ).toBe(1)
  })

  it('an invalid motion scale cannot stop the turn from committing', () => {
    const duration = 400
    for (const motionScale of [0, -1, -1_000, Number.NaN, Number.POSITIVE_INFINITY]) {
      const turn = turnWindow(duration)
      // The invalid scale falls back to 1, so the window ends at its own duration.
      const atEnd = run({ phase: 'TURNING', open: null, turn, now: T0 + duration, motionScale })
      expect(atEnd.commit, `scale=${motionScale}`).toBe('turn')
      expect(atEnd.turn, `scale=${motionScale}`).toBe(1)

      const mid = run({
        phase: 'TURNING',
        open: null,
        turn,
        now: T0 + duration / 2,
        motionScale,
      })
      expect(mid.turn, `scale=${motionScale}`).toBe(0.5)
    }
  })

  it('an invalid motion scale never yields a NaN openness either', () => {
    const duration = 400
    for (const motionScale of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const opening = run({
        phase: 'OPENING',
        open: openWindow(duration),
        turn: null,
        now: T0 + duration,
        motionScale,
      })
      expect(opening, `scale=${motionScale}`).toEqual({ open: 1, commit: 'open' })
    }
  })
})

describe('a turn that finishes while the tab is hidden', () => {
  it('commits once on resume and every repeated call stays at that same committed pose', () => {
    for (const dir of [1, -1] as const) {
      const duration = dir === 1 ? FORWARD_DURATION_MS : BACK_DURATION_MS
      const turn = turnWindow(duration, dir)
      const resumeNow = T0 + duration * 10

      const resumed = run({ phase: 'TURNING', open: null, turn, now: resumeNow })
      expect(resumed, `dir=${dir}`).toEqual({
        turn: dir === 1 ? 1 : 0,
        commit: 'turn',
      })

      // Pure and idempotent: replaying the same frame, or any later frame of
      // the same finished window, reproduces the identical single commit.
      expect(run({ phase: 'TURNING', open: null, turn, now: resumeNow }), `dir=${dir}`).toEqual(
        resumed,
      )
      expect(
        run({ phase: 'TURNING', open: null, turn, now: resumeNow + 1_000 }),
        `dir=${dir}`,
      ).toEqual(resumed)

      const later = run({ phase: 'TURNING', open: null, turn, now: resumeNow + 1_000 })
      expect(Object.keys(later).sort(), `dir=${dir}`).toEqual(['commit', 'turn'])
      expect(later.commit, `dir=${dir}`).toBe('turn')
    }
  })

  it('produces no further commit after the caller lands the first one', () => {
    const duration = FORWARD_DURATION_MS
    const turn = turnWindow(duration, 1)
    const resumeNow = T0 + duration * 10

    expect(run({ phase: 'TURNING', open: null, turn, now: resumeNow }).commit).toBe('turn')

    // The caller acts on the commit: commitTurn flips the phase and drops the
    // window, so the next frame cannot emit a second (or foreign) commit.
    expect(run({ phase: 'OPEN', open: null, turn: null, now: resumeNow + 16 })).toEqual({})
    expect(run({ phase: 'CLOSED', open: null, turn: null, now: resumeNow + 16 })).toEqual({})
  })
})

describe('purity', () => {
  it('does not mutate a frozen input', () => {
    const turn = Object.freeze({ ...turnWindow(400), }) as PageTurn
    const input = Object.freeze({
      phase: 'TURNING',
      open: null,
      turn,
      now: T0 + 200,
      motionScale: 1,
    }) as FrameStepInput

    let step: FrameStepOutput | undefined
    expect(() => {
      step = frameStep(input)
    }).not.toThrow()
    expect(step).toEqual({ turn: 0.5 })

    const openingInput = Object.freeze({
      phase: 'OPENING',
      open: Object.freeze({ ...openWindow(400) }) as Transition,
      turn: null,
      now: T0 + 200,
      motionScale: 1,
    }) as FrameStepInput
    expect(() => frameStep(openingInput)).not.toThrow()
    expect(frameStep(openingInput)).toEqual({ open: 0.5 })
  })

  it('is deterministic for the same now — the clock is injected, never read', () => {
    const turn = turnWindow(BACK_DURATION_MS, -1)
    const now = T0 + 300
    const first = run({ phase: 'TURNING', open: null, turn, now })
    expect(run({ phase: 'TURNING', open: null, turn, now })).toEqual(first)
    expect(run({ phase: 'TURNING', open: null, turn, now })).toEqual(first)
  })
})

describe('turn seeding continuity (the mode-switch seam)', () => {
  /**
   * The documented seed for a turn in flight at progress q is the pure
   * predicate `dir === 1 ? eased(q) : 1 - eased(q)`. The concrete seeding
   * helper lives inside the `TurningSheet` component and is not exported, so
   * the predicate is built here from `progressAt`/`easeInOutCubic` — the same
   * primitives the store and `frameStep` share. Seeding from the store must
   * not produce a discontinuity against the first emitted frame.
   */
  const seedAt = (turn: PageTurn, now: number): number => {
    const eased = easeInOutCubic(progressAt(turn, now))
    return turn.dir === 1 ? eased : 1 - eased
  }

  it('the seeded pose equals the emitted pose at the same now, in both directions', () => {
    for (const dir of [1, -1] as const) {
      const duration = dir === 1 ? FORWARD_DURATION_MS : BACK_DURATION_MS
      const turn = turnWindow(duration, dir)

      for (const fraction of SWEEP) {
        const now = elapsedAt(fraction, duration)
        expect(
          run({ phase: 'TURNING', open: null, turn, now }).turn,
          `dir=${dir} fraction=${fraction}`,
        ).toBe(seedAt(turn, now))
      }
    }
  })
})
