import { describe, expect, it } from 'vitest'
import {
  BACK_DURATION_MS,
  CLOSE_DURATION_MS,
  FORWARD_DURATION_MS,
  OPEN_DURATION_MS,
  easeInOutCubic,
  progressAt,
  type Transition,
} from './timing.ts'

const transition = (startedAt = 1_000, duration = FORWARD_DURATION_MS): Transition => ({
  startedAt,
  duration,
})

describe('durations', () => {
  it('uses 900 ms forward and 800 ms backward', () => {
    expect(FORWARD_DURATION_MS).toBe(900)
    expect(BACK_DURATION_MS).toBe(800)
  })

  it('aliases the open/close window to the same forward/back durations', () => {
    expect(OPEN_DURATION_MS).toBe(FORWARD_DURATION_MS)
    expect(CLOSE_DURATION_MS).toBe(BACK_DURATION_MS)
    expect(OPEN_DURATION_MS).toBe(900)
    expect(CLOSE_DURATION_MS).toBe(800)
  })
})

describe('progressAt', () => {
  it('is 0 at the start of the transition', () => {
    expect(progressAt(transition(1_000, 900), 1_000)).toBe(0)
  })

  it('is exactly 1 at the end of the transition', () => {
    expect(progressAt(transition(1_000, 900), 1_900)).toBe(1)
  })

  it('stays exactly 1 beyond the end of the transition', () => {
    expect(progressAt(transition(1_000, 900), 1_901)).toBe(1)
    expect(progressAt(transition(1_000, 900), 10_000_000)).toBe(1)
  })

  it('clamps to 0 for a clock before the start', () => {
    expect(progressAt(transition(1_000, 900), 0)).toBe(0)
    expect(progressAt(transition(1_000, 900), -50_000)).toBe(0)
  })

  it('is linear in between (half the duration yields one half)', () => {
    expect(progressAt(transition(0, 900), 450)).toBe(0.5)
    expect(progressAt(transition(0, 900), 225)).toBe(0.25)
  })

  it('never decreases as the clock advances', () => {
    const window = transition(1_000, 900)
    let previous = progressAt(window, 0)

    for (let now = 0; now <= 3_000; now += 25) {
      const current = progressAt(window, now)
      expect(current).toBeGreaterThanOrEqual(previous)
      expect(current).toBeGreaterThanOrEqual(0)
      expect(current).toBeLessThanOrEqual(1)
      previous = current
    }
  })

  it('resolves immediately for a zero or negative duration', () => {
    expect(progressAt(transition(1_000, 0), 999)).toBe(0)
    expect(progressAt(transition(1_000, 0), 1_000)).toBe(1)
    expect(progressAt(transition(1_000, -10), 1_000)).toBe(1)
  })
})

describe('easeInOutCubic', () => {
  it('fixes the endpoints', () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(1)).toBe(1)
  })

  it('passes through the midpoint', () => {
    expect(easeInOutCubic(0.5)).toBe(0.5)
  })

  it('is symmetric around the midpoint', () => {
    expect(easeInOutCubic(0.25)).toBeCloseTo(1 - easeInOutCubic(0.75), 12)
  })

  it('stays inside [0, 1] and is monotonic across the unit interval', () => {
    let previous = easeInOutCubic(0)

    for (let step = 0; step <= 100; step += 1) {
      const current = easeInOutCubic(step / 100)
      expect(current).toBeGreaterThanOrEqual(0)
      expect(current).toBeLessThanOrEqual(1)
      expect(current).toBeGreaterThanOrEqual(previous)
      previous = current
    }
  })

  it('clamps input outside the unit interval', () => {
    expect(easeInOutCubic(-2)).toBe(0)
    expect(easeInOutCubic(2)).toBe(1)
  })
})
