/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  BONE_COUNT,
  CURL_AMPLITUDE,
  GAUSSIAN_WIDTH,
  MAX_BONE_DELTA,
  PEAK_U,
  curlPose,
  writeCurlPose,
  type MutableCurlPose,
} from './curlPose.ts'

type Dir = 1 | -1

const DIRS: readonly Dir[] = [1, -1]
const LAST_BONE = BONE_COUNT - 1

/** Progress values used by the broad equality / symmetry checks. */
const SAMPLE_PROGRESS: readonly number[] = [
  0, 0.001, 0.01, 0.125, 0.25, 0.333, 0.4, 0.5, 0.62, 0.75, 0.875, 0.95, 0.999, 1,
]

const range = (from: number, to: number, step: number): number[] =>
  Array.from({ length: Math.round((to - from) / step) + 1 }, (_, index) => from + index * step)

/** 0.01 sweep as required by the bone budget, plus a finer sweep for shape work. */
const SWEEP = range(0, 1, 0.01)
const FINE_SWEEP = range(0, 1, 0.001)

const sumAbs = (values: readonly number[]): number =>
  values.reduce((total, value) => total + Math.abs(value), 0)

const uOf = (index: number): number => index / LAST_BONE

const peakIndex = (deltas: readonly number[]): number =>
  deltas.reduce((best, value, index) => (Math.abs(value) > Math.abs(deltas[best]) ? index : best), 0)

const expectDeltasCloseTo = (
  actual: readonly number[],
  expected: readonly number[],
  tolerance: number,
  label = 'deltas',
): void => {
  expect(actual, `${label} length`).toHaveLength(expected.length)
  actual.forEach((value, index) => {
    expect(
      Math.abs(value - expected[index]),
      `${label}[${index}] expected ~${expected[index]} got ${value}`,
    ).toBeLessThanOrEqual(tolerance)
  })
}

const scratchPose = (): MutableCurlPose => ({
  root: Number.NaN,
  // Deliberately stale garbage: every slot must be overwritten by the writer.
  deltas: new Array<number>(BONE_COUNT).fill(99),
})

describe('exact rest and end poses', () => {
  it('is a perfectly flat sheet at p = 0', () => {
    for (const dir of DIRS) {
      const pose = curlPose(0, dir)
      expect(pose.root, `root dir=${dir}`).toBe(0)
      pose.deltas.forEach((delta, index) => {
        expect(delta, `deltas[${index}] dir=${dir}`).toBe(0)
      })
    }
  })

  it('lands on exactly one half turn at p = 1 with a flat sheet', () => {
    for (const dir of DIRS) {
      const pose = curlPose(1, dir)
      expect(pose.root, `root dir=${dir}`).toBe(dir * Math.PI)
      expectDeltasCloseTo(pose.deltas, new Array<number>(BONE_COUNT).fill(0), 1e-9, `p=1 dir=${dir}`)
    }
  })

  it('has no leftover curl immediately after the start or before the end', () => {
    for (const p of [1e-9, 1 - 1e-9]) {
      const pose = curlPose(p, 1)
      expect(sumAbs(pose.deltas), `sum at p=${p}`).toBeLessThan(1e-6)
    }
  })

  it('returns one delta per bone at every progress value', () => {
    for (const p of SAMPLE_PROGRESS) {
      for (const dir of DIRS) {
        expect(curlPose(p, dir).deltas, `p=${p} dir=${dir}`).toHaveLength(BONE_COUNT)
      }
    }
  })
})

describe('direction handling', () => {
  it('negates the root turn exactly when the direction flips', () => {
    for (const p of SAMPLE_PROGRESS) {
      const forward = curlPose(p, 1).root
      const backward = curlPose(p, -1).root

      if (forward === 0) {
        // The flat start is a literal 0 in both directions, never -0.
        expect(Object.is(backward, 0), `p=${p}`).toBe(true)
      } else {
        // Exact bit-level sign flip, not just approximately equal.
        expect(backward, `p=${p}`).toBe(-forward)
      }
    }
  })

  it('keeps identical deltas for both directions, as documented ("dir is only a sign of the root turn")', () => {
    // NOTE: the T8b brief expected full negation of every delta. The module doc
    // comment says the opposite, and the implementation is dir-independent for
    // deltas. Reported as a brief/source mismatch; this test pins the documented
    // behaviour so a future change is a visible decision.
    for (const p of SAMPLE_PROGRESS) {
      expect(curlPose(p, -1).deltas, `p=${p}`).toEqual(curlPose(p, 1).deltas)
    }
  })
})

describe('amplitude envelope', () => {
  it('carries no curl at either end of the turn', () => {
    for (const dir of DIRS) {
      expect(sumAbs(curlPose(0, dir).deltas), `dir=${dir} p=0`).toBe(0)
      expect(sumAbs(curlPose(1, dir).deltas), `dir=${dir} p=1`).toBe(0)
    }
  })

  it('peaks at p = 0.5 with the full curl amplitude', () => {
    for (const dir of DIRS) {
      expect(sumAbs(curlPose(0.5, dir).deltas), `dir=${dir}`).toBeCloseTo(CURL_AMPLITUDE, 6)
    }
  })

  it('is maximal at p = 0.5 across a dense sweep', () => {
    let best = -1
    let bestP = Number.NaN
    for (const p of FINE_SWEEP) {
      const total = sumAbs(curlPose(p, 1).deltas)
      if (total > best) {
        best = total
        bestP = p
      }
    }
    expect(bestP).toBe(0.5)
    expect(best).toBeCloseTo(CURL_AMPLITUDE, 6)
  })

  it('stays within [0, CURL_AMPLITUDE] for every progress value', () => {
    for (const p of FINE_SWEEP) {
      for (const dir of DIRS) {
        const total = sumAbs(curlPose(p, dir).deltas)
        expect(total, `p=${p} dir=${dir}`).toBeGreaterThanOrEqual(0)
        expect(total, `p=${p} dir=${dir}`).toBeLessThanOrEqual(CURL_AMPLITUDE)
      }
    }
  })

  it('is symmetric about the middle of the turn', () => {
    for (const p of SAMPLE_PROGRESS.slice(0, -1)) {
      const left = sumAbs(curlPose(p, 1).deltas)
      const right = sumAbs(curlPose(1 - p, 1).deltas)
      expect(Math.abs(left - right), `p=${p}`).toBeLessThanOrEqual(1e-9)
    }
  })
})

describe('curl shape along the chain', () => {
  it('places the peak bend within one bone of PEAK_U', () => {
    const peak = peakIndex(curlPose(0.5, 1).deltas)
    expect(Math.abs(uOf(peak) - PEAK_U), `peak bone ${peak} at u=${uOf(peak)}`).toBeLessThanOrEqual(
      1 / LAST_BONE,
    )
  })

  it('rises then falls along the chain (unimodal weights)', () => {
    const magnitudes = curlPose(0.5, 1).deltas.map(Math.abs)
    const peak = peakIndex(magnitudes)

    for (let index = 1; index <= peak; index += 1) {
      expect(magnitudes[index], `rise at ${index}`).toBeGreaterThan(magnitudes[index - 1])
    }
    for (let index = peak + 1; index <= LAST_BONE; index += 1) {
      expect(magnitudes[index], `fall at ${index}`).toBeLessThan(magnitudes[index - 1])
    }
  })

  it('tapers towards the spine and the fore edge instead of clipping', () => {
    const deltas = curlPose(0.5, 1).deltas
    const peak = Math.abs(deltas[peakIndex(deltas)])
    expect(Math.abs(deltas[0])).toBeLessThan(peak / 10)
    expect(Math.abs(deltas[LAST_BONE])).toBeLessThan(peak / 2)
  })

  it('follows a gaussian of GAUSSIAN_WIDTH centred on PEAK_U', () => {
    const deltas = curlPose(0.5, 1).deltas.map(Math.abs)
    const peak = peakIndex(deltas)
    const gaussian = (index: number): number =>
      Math.exp(-(((uOf(index) - PEAK_U) / GAUSSIAN_WIDTH) ** 2))
    // The sampled peak sits next to PEAK_U, so fit the scale once and compare the shape.
    const scale = deltas[peak] / gaussian(peak)

    deltas.forEach((delta, index) => {
      expect(Math.abs(delta - scale * gaussian(index)), `bone ${index}`).toBeLessThanOrEqual(1e-12)
    })
  })
})

describe('per-bone budget', () => {
  it('never exceeds MAX_BONE_DELTA across a 0.01 sweep', () => {
    for (const p of SWEEP) {
      for (const dir of DIRS) {
        for (const [index, delta] of curlPose(p, dir).deltas.entries()) {
          expect(Math.abs(delta), `p=${p} dir=${dir} bone=${index}`).toBeLessThanOrEqual(
            MAX_BONE_DELTA,
          )
        }
      }
    }
  })

  it('peaks around the 0.044 rad the module advertises, well inside the budget', () => {
    const largest = Math.max(...curlPose(0.5, 1).deltas.map(Math.abs))
    expect(Math.abs(largest - 0.044), `largest bone delta ${largest}`).toBeLessThanOrEqual(2e-3)
    expect(largest).toBeLessThan(MAX_BONE_DELTA)
  })
})

describe('root monotonicity', () => {
  it('never turns back while moving forward', () => {
    let previous = Number.NEGATIVE_INFINITY
    for (const p of FINE_SWEEP) {
      const root = curlPose(p, 1).root
      expect(root, `p=${p}`).toBeGreaterThanOrEqual(previous)
      previous = root
    }
  })

  it('never turns back while moving backward either', () => {
    let previous = Number.POSITIVE_INFINITY
    for (const p of FINE_SWEEP) {
      const root = curlPose(p, -1).root
      expect(root, `p=${p}`).toBeLessThanOrEqual(previous)
      previous = root
    }
  })

  it('is exactly half a turn at the midpoint', () => {
    expect(curlPose(0.5, 1).root).toBeCloseTo(Math.PI / 2, 12)
    expect(curlPose(0.5, -1).root).toBeCloseTo(-Math.PI / 2, 12)
  })
})

describe('progress clamping and non-finite input', () => {
  it('treats negative progress as the flat start', () => {
    for (const p of [-0.001, -0.5, -1e9, Number.NEGATIVE_INFINITY]) {
      for (const dir of DIRS) {
        expect(curlPose(p, dir), `p=${p} dir=${dir}`).toEqual(curlPose(0, dir))
      }
    }
  })

  it('treats progress past the end as the completed turn', () => {
    for (const p of [1.001, 1.5, 1e9, Number.POSITIVE_INFINITY]) {
      for (const dir of DIRS) {
        expect(curlPose(p, dir), `p=${p} dir=${dir}`).toEqual(curlPose(1, dir))
      }
    }
  })

  it('treats NaN progress as the flat start instead of corrupting the pose', () => {
    // A non-finite clock value must never push NaN into bone rotations.
    for (const dir of DIRS) {
      expect(curlPose(Number.NaN, dir)).toEqual(curlPose(0, dir))
    }
  })
})

describe('purity and caller safety', () => {
  it('returns deeply equal but freshly allocated poses', () => {
    for (const p of SAMPLE_PROGRESS) {
      const first = curlPose(p, 1)
      const second = curlPose(p, 1)
      expect(second).toEqual(first)
      expect(second).not.toBe(first)
      expect(second.deltas).not.toBe(first.deltas)
    }
  })

  it('freezes the returned deltas so a caller cannot corrupt them', () => {
    const pose = curlPose(0.4, 1)
    expect(Object.isFrozen(pose.deltas)).toBe(true)
    expect(() => (pose.deltas as number[]).push(1)).toThrow(TypeError)
    expect(pose.deltas).toHaveLength(BONE_COUNT)
  })

  it('does not share state between calls, so a mutated result cannot poison the next one', () => {
    const first = curlPose(0.4, 1) as { root: number; deltas: number[] }
    first.root = 123
    expect(curlPose(0.4, 1).root).toBeCloseTo(Math.PI * 0.256, 12)
  })

  it('produces the same pose regardless of which calls came before it', () => {
    const expected = curlPose(0.37, 1)
    curlPose(Number.NaN, -1)
    curlPose(0, -1)
    curlPose(1, 1)
    expect(curlPose(0.37, 1)).toEqual(expected)
  })

  it('does not mutate the progress argument (a primitive, kept for contract clarity)', () => {
    const p = 0.42
    curlPose(p, 1)
    expect(p).toBe(0.42)
  })
})

describe('writeCurlPose', () => {
  it('writes exactly what the pure function returns', () => {
    for (const p of SAMPLE_PROGRESS) {
      for (const dir of DIRS) {
        const expected = curlPose(p, dir)
        const out = scratchPose()
        writeCurlPose(p, dir, out)
        expect(out.root, `root p=${p} dir=${dir}`).toBeCloseTo(expected.root, 12)
        expectDeltasCloseTo(out.deltas, expected.deltas, 1e-12, `p=${p} dir=${dir}`)
      }
    }
  })

  it('overwrites every stale slot, including the exact endpoints', () => {
    for (const p of [0, 0.5, 1]) {
      const out = scratchPose()
      writeCurlPose(p, 1, out)
      out.deltas.forEach((delta, index) => {
        expect(delta, `p=${p} bone ${index}`).not.toBe(99)
      })
    }
  })

  it('is idempotent when the same buffer is written twice', () => {
    const out = scratchPose()
    writeCurlPose(0.3, -1, out)
    const firstRoot = out.root
    const firstDeltas = [...out.deltas]

    writeCurlPose(0.3, -1, out)

    expect(out.root).toBe(firstRoot)
    expect(out.deltas).toEqual(firstDeltas)
  })

  it('reuses the caller buffer and leaves it mutable for the next frame', () => {
    const out = scratchPose()
    const deltas = out.deltas
    writeCurlPose(0.6, 1, out)

    expect(out.deltas).toBe(deltas)
    expect(out.deltas).toHaveLength(BONE_COUNT)
    expect(Object.isFrozen(out.deltas)).toBe(false)
  })

  it('matches the pure function after a buffer has already been used', () => {
    const out = scratchPose()
    writeCurlPose(1, 1, out)
    writeCurlPose(0.25, 1, out)

    const expected = curlPose(0.25, 1)
    expect(out.root).toBeCloseTo(expected.root, 12)
    expectDeltasCloseTo(out.deltas, expected.deltas, 1e-12, 'reused buffer')
  })
})

describe('import hygiene', () => {
  const sourcePath = fileURLToPath(new URL('./curlPose.ts', import.meta.url))
  const source = readFileSync(sourcePath, 'utf8')

  const importSpecifiers = [
    ...source.matchAll(/^\s*(?:import|export)\b[^\n]*?from\s+(['"])([^'"]+)\1/gm),
    ...source.matchAll(/^\s*import\s+(['"])([^'"]+)\1/gm),
  ].map((match) => match[2])

  it('imports only the pure timing module', () => {
    expect(importSpecifiers.length).toBeGreaterThan(0)
    for (const specifier of importSpecifiers) {
      expect(specifier, `specifier ${specifier}`).toMatch(/^\.{1,2}\//)
      expect(specifier.replace(/\.ts$/, '')).toBe('../../state/timing')
    }
  })

  it('never pulls in three.js, React or the store', () => {
    // The doc comment names these words, so assert on module specifiers and
    // renderer globals rather than on raw text.
    const forbidden = /^(three|react|react-dom|@react-three|zustand)(\/|$)/
    for (const specifier of importSpecifiers) {
      expect(specifier, `specifier ${specifier}`).not.toMatch(forbidden)
    }
    expect(source).not.toMatch(/\brequire\s*\(/)
    expect(source).not.toMatch(/\b(?:document|window)\./)
  })
})
