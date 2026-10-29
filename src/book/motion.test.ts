import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { BACK_DURATION_MS, FORWARD_DURATION_MS } from '../state/timing.ts'
import type { BookPhase, PageTurn } from '../state/bookState.ts'
import { frameStep } from './frameStep.ts'
import {
  REDUCED_MOTION_SCALE,
  TURN_CROSSFADE_MS,
  motionScaleFor,
  prefersReducedMotion,
  useReducedMotion,
} from './motion.ts'

const PHASES: readonly BookPhase[] = ['CLOSED', 'OPENING', 'OPEN', 'TURNING', 'CLOSING']
const QUERY = '(prefers-reduced-motion: reduce)'

const pageTurn = (duration = FORWARD_DURATION_MS, dir: 1 | -1 = 1): PageTurn => ({
  from: dir === 1 ? 0 : 1,
  to: dir === 1 ? 1 : 0,
  dir,
  startedAt: 1_000,
  duration,
})

interface FakeQueryList {
  readonly matches: boolean
  addEventListener: () => void
  removeEventListener: () => void
}

const scope = globalThis as unknown as { window?: unknown }
const originalWindow = scope.window

/** Minimal `window` stand-in: these tests only need `matchMedia`. */
function stubWindow(matchMedia: unknown): void {
  scope.window = { matchMedia }
}

function stubPreference(matches: boolean, queries: string[] = []): void {
  stubWindow((query: string): FakeQueryList => {
    queries.push(query)
    return { matches, addEventListener: () => {}, removeEventListener: () => {} }
  })
}

afterEach(() => {
  if (originalWindow === undefined) delete scope.window
  else scope.window = originalWindow
})

function Probe(): string {
  return String(useReducedMotion())
}

describe('reduced-motion constants', () => {
  it('speeds an open/close up by a large finite multiplier', () => {
    expect(Number.isFinite(REDUCED_MOTION_SCALE)).toBe(true)
    expect(REDUCED_MOTION_SCALE).toBeGreaterThan(1)
  })

  it('uses a crossfade shorter than either normal turn', () => {
    expect(TURN_CROSSFADE_MS).toBeGreaterThan(0)
    expect(TURN_CROSSFADE_MS).toBeLessThan(FORWARD_DURATION_MS)
    expect(TURN_CROSSFADE_MS).toBeLessThan(BACK_DURATION_MS)
  })
})

describe('motionScaleFor without reduced motion', () => {
  it('returns the neutral scale 1 for every phase and turn state', () => {
    for (const phase of PHASES) {
      for (const turn of [null, pageTurn()]) {
        expect(motionScaleFor(false, phase, turn), `${phase} turn=${turn !== null}`).toBe(1)
      }
    }
  })
})

describe('motionScaleFor with reduced motion', () => {
  it('lands open and close on their first frame', () => {
    for (const phase of ['CLOSED', 'OPENING', 'OPEN', 'CLOSING'] as const) {
      expect(motionScaleFor(true, phase, null), phase).toBe(REDUCED_MOTION_SCALE)
    }
  })

  it('keeps a turn alive for exactly the crossfade, not the first frame', () => {
    expect(motionScaleFor(true, 'TURNING', pageTurn(FORWARD_DURATION_MS))).toBe(
      FORWARD_DURATION_MS / TURN_CROSSFADE_MS,
    )
    expect(motionScaleFor(true, 'TURNING', pageTurn(BACK_DURATION_MS, -1))).toBeCloseTo(
      BACK_DURATION_MS / TURN_CROSSFADE_MS,
      12,
    )
  })

  it('scales a turn so its duration becomes the crossfade length', () => {
    for (const duration of [FORWARD_DURATION_MS, BACK_DURATION_MS, 400, 1]) {
      const scale = motionScaleFor(true, 'TURNING', pageTurn(duration))
      // frameStep divides the duration by the scale.
      expect(duration / scale, `duration=${duration}`).toBeCloseTo(TURN_CROSSFADE_MS, 9)
    }
  })

  it('falls back to the first-frame scale when there is no usable turn', () => {
    expect(motionScaleFor(true, 'TURNING', null)).toBe(REDUCED_MOTION_SCALE)
    expect(motionScaleFor(true, 'TURNING', pageTurn(0))).toBe(REDUCED_MOTION_SCALE)
    expect(motionScaleFor(true, 'TURNING', pageTurn(-500))).toBe(REDUCED_MOTION_SCALE)
    expect(motionScaleFor(true, 'TURNING', pageTurn(Number.NaN))).toBe(REDUCED_MOTION_SCALE)
  })

  it('only uses the crossfade window while TURNING, even if a turn is passed', () => {
    const turn = pageTurn()
    for (const phase of ['CLOSED', 'OPENING', 'OPEN', 'CLOSING'] as const) {
      expect(motionScaleFor(true, phase, turn), phase).toBe(REDUCED_MOTION_SCALE)
    }
  })
})

describe('the reduced-motion turn still commits', () => {
  it('reaches progress 1 exactly at the end of the crossfade, in both directions', () => {
    for (const dir of [1, -1] as const) {
      const turn = pageTurn(dir === 1 ? FORWARD_DURATION_MS : BACK_DURATION_MS, dir)
      const scale = motionScaleFor(true, 'TURNING', turn)
      const atEnd = frameStep({ phase: 'TURNING', open: null, turn, now: 1_000 + TURN_CROSSFADE_MS, motionScale: scale })

      expect(atEnd.commit, `dir=${dir}`).toBe('turn')
      // The sheet lands flat: forward ends at 1 (flat left), backward at 0.
      expect(atEnd.turn, `dir=${dir}`).toBe(dir === 1 ? 1 : 0)
    }
  })

  it('does not commit before the crossfade has played out', () => {
    const turn = pageTurn()
    const scale = motionScaleFor(true, 'TURNING', turn)

    for (const elapsed of [0, 1, 90, TURN_CROSSFADE_MS - 1]) {
      const step = frameStep({ phase: 'TURNING', open: null, turn, now: 1_000 + elapsed, motionScale: scale })
      expect(step.commit, `elapsed=${elapsed}`).toBeUndefined()
      expect(step.turn, `elapsed=${elapsed}`).toBeDefined()
    }
  })

  it('is half turned at half the crossfade', () => {
    const turn = pageTurn()
    const scale = motionScaleFor(true, 'TURNING', turn)
    const step = frameStep({ phase: 'TURNING', open: null, turn, now: 1_000 + TURN_CROSSFADE_MS / 2, motionScale: scale })

    expect(step.turn).toBeCloseTo(0.5, 12)
    expect(step.commit).toBeUndefined()
  })

  it('commits an open on the first rendered frame rather than waiting 900 ms', () => {
    const step = frameStep({
      phase: 'OPENING',
      open: { startedAt: 1_000, duration: FORWARD_DURATION_MS },
      turn: null,
      now: 1_000 + 16,
      motionScale: REDUCED_MOTION_SCALE,
    })

    expect(step.commit).toBe('open')
    expect(step.open).toBe(1)
  })
})

describe('preference detection', () => {
  it('defaults to no reduced motion outside a browser', () => {
    expect(scope.window).toBeUndefined()
    expect(prefersReducedMotion()).toBe(false)
    expect(renderToString(createElement(Probe))).toBe('false')
  })

  it('defaults to no reduced motion when matchMedia is unavailable', () => {
    stubWindow(undefined)
    expect(prefersReducedMotion()).toBe(false)

    stubWindow('not a function')
    expect(prefersReducedMotion()).toBe(false)
  })

  it('reads the media query result', () => {
    stubPreference(true)
    expect(prefersReducedMotion()).toBe(true)

    stubPreference(false)
    expect(prefersReducedMotion()).toBe(false)
  })

  it('asks for the canonical prefers-reduced-motion query', () => {
    const queries: string[] = []
    stubPreference(true, queries)

    prefersReducedMotion()

    expect(queries).toEqual([QUERY])
  })

  it('server-renders as no preference even when the client prefers reduce', () => {
    // The server snapshot is deliberately constant, so hydration cannot fork
    // the markup; the live value arrives through the subscription.
    stubPreference(true)
    expect(renderToString(createElement(Probe))).toBe('false')
  })
})
