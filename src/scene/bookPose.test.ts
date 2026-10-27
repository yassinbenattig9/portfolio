import { describe, expect, it } from 'vitest'
import type { BookPhase } from '../state/bookState.ts'
import { opennessFor } from './bookPose.ts'

/** The eased samples of the 5-phase x 3-value table. */
const EASED = [0, 0.5, 1] as const

const expectTable = (phase: BookPhase, expected: readonly number[]): void => {
  EASED.forEach((eased, index) => {
    expect(opennessFor(phase, eased), `${phase} eased=${eased}`).toBe(expected[index])
  })
}

describe('openness phase table', () => {
  it('CLOSED is shut whatever the eased value says', () => {
    expectTable('CLOSED', [0, 0, 0])
  })

  it('OPENING follows the eased window from shut to open', () => {
    expectTable('OPENING', [0, 0.5, 1])
  })

  it('OPEN is fully open and ignores the eased value', () => {
    expectTable('OPEN', [1, 1, 1])
  })

  it('TURNING stays fully open and ignores the eased value', () => {
    expectTable('TURNING', [1, 1, 1])
  })

  it('CLOSING runs the same window backwards, from open to shut', () => {
    expectTable('CLOSING', [1, 0.5, 0])
  })
})

describe('closing is the opening window inverted', () => {
  it('obeys CLOSING(p) === 1 - OPENING(p) across and beyond the window', () => {
    // The bug this pins: the cover used to snap shut and swing open again
    // because closing reused the opening value instead of its complement.
    for (const p of [-1, 0, 0.001, 0.25, 0.5, 0.75, 0.999, 1, 2, Number.NaN]) {
      expect(opennessFor('CLOSING', p), `p=${p}`).toBe(1 - opennessFor('OPENING', p))
    }
  })

  it('meets the flat open book at the middle of a close', () => {
    expect(opennessFor('CLOSING', 0.5)).toBe(0.5)
    expect(opennessFor('CLOSING', 0)).toBe(1)
    expect(opennessFor('CLOSING', 1)).toBe(0)
  })
})

describe('clamping and non-finite input', () => {
  it('clamps opening values below 0 to shut and above 1 to fully open', () => {
    for (const p of [-0.001, -0.5, -1e9, Number.NEGATIVE_INFINITY]) {
      expect(opennessFor('OPENING', p), `p=${p}`).toBe(0)
    }
    for (const p of [1.001, 1.5, 1e9, Number.POSITIVE_INFINITY]) {
      expect(opennessFor('OPENING', p), `p=${p}`).toBe(1)
    }
  })

  it('clamps a closing window the same way, just read from the other end', () => {
    for (const p of [-0.001, -0.5, -1e9, Number.NEGATIVE_INFINITY]) {
      expect(opennessFor('CLOSING', p), `p=${p}`).toBe(1)
    }
    for (const p of [1.001, 1.5, 1e9, Number.POSITIVE_INFINITY]) {
      expect(opennessFor('CLOSING', p), `p=${p}`).toBe(0)
    }
  })

  it('treats NaN as 0 before inversion, so a closing book is shut and never NaN', () => {
    expect(opennessFor('OPENING', Number.NaN)).toBe(0)
    expect(opennessFor('CLOSING', Number.NaN)).toBe(1)
    expect(Number.isNaN(opennessFor('CLOSING', Number.NaN))).toBe(false)
  })

  it('never returns NaN or leaves 0..1 for any phase and hostile eased value', () => {
    const phases: readonly BookPhase[] = ['CLOSED', 'OPENING', 'OPEN', 'TURNING', 'CLOSING']
    const values = [
      Number.NEGATIVE_INFINITY,
      -1e9,
      -1,
      -0.001,
      0,
      0.5,
      1,
      1.001,
      1e9,
      Number.POSITIVE_INFINITY,
      Number.NaN,
    ]

    for (const phase of phases) {
      for (const value of values) {
        const openness = opennessFor(phase, value)
        expect(Number.isFinite(openness), `${phase} eased=${value}`).toBe(true)
        expect(openness, `${phase} eased=${value}`).toBeGreaterThanOrEqual(0)
        expect(openness, `${phase} eased=${value}`).toBeLessThanOrEqual(1)
      }
    }
  })

  it('ignores eased entirely for phases that have no window', () => {
    const phases = ['CLOSED', 'OPEN', 'TURNING'] as const
    for (const phase of phases) {
      for (const value of [-5, -0.5, 0.5, 5, Number.NaN]) {
        expect(opennessFor(phase, value), `${phase} eased=${value}`).toBe(phase === 'CLOSED' ? 0 : 1)
      }
    }
  })
})
