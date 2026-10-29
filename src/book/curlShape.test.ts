import { describe, expect, it } from 'vitest'
import {
  CURL_AMPLITUDE,
  GAUSSIAN_WIDTH,
  PEAK_U,
  STRIP_COUNT,
  shadeWeights,
  stripWeights,
} from './curlShape.ts'

/** The strip whose middle is closest to the Gaussian's peak. */
const peakIndex = (weights: readonly number[]): number => weights.indexOf(Math.max(...weights))

describe('strip table shape', () => {
  it('produces exactly STRIP_COUNT weights per table', () => {
    expect(Number.isInteger(STRIP_COUNT)).toBe(true)
    expect(STRIP_COUNT).toBeGreaterThan(1)
    expect(stripWeights()).toHaveLength(STRIP_COUNT)
    expect(shadeWeights()).toHaveLength(STRIP_COUNT)
  })

  it('keeps its tuning constants inside the sheet', () => {
    expect(Number.isFinite(CURL_AMPLITUDE)).toBe(true)
    expect(CURL_AMPLITUDE).toBeGreaterThan(0)
    expect(PEAK_U).toBeGreaterThan(0)
    expect(PEAK_U).toBeLessThan(1)
    expect(GAUSSIAN_WIDTH).toBeGreaterThan(0)
  })
})

describe('stripWeights', () => {
  const weights = stripWeights()

  it('is a probability distribution over the strips', () => {
    expect(weights.every((weight) => Number.isFinite(weight))).toBe(true)
    expect(weights.every((weight) => weight > 0)).toBe(true)
    expect(weights.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1, 12)
  })

  it('is unimodal with a single peak near PEAK_U', () => {
    const peak = peakIndex(weights)

    expect(peak).toBe(7)
    // The peak strip's middle is within half a strip of the tuned peak.
    expect(Math.abs((peak + 0.5) / STRIP_COUNT - PEAK_U)).toBeLessThanOrEqual(0.5 / STRIP_COUNT)

    for (let index = 0; index < peak; index += 1) {
      expect(weights[index], `rising at ${index}`).toBeLessThan(weights[index + 1])
    }
    for (let index = peak; index < STRIP_COUNT - 1; index += 1) {
      expect(weights[index], `falling at ${index}`).toBeGreaterThan(weights[index + 1])
    }
  })

  it('puts more bend on the peak strip than the uniform share', () => {
    expect(Math.max(...weights)).toBeGreaterThan(1 / STRIP_COUNT)
    expect(weights[peakIndex(weights)]).toBe(Math.max(...weights))
  })

  it('is a shared frozen table, not a fresh array per frame', () => {
    expect(stripWeights()).toBe(weights)
    expect(Object.isFrozen(weights)).toBe(true)
    expect(() => (weights as unknown as number[]).push(0)).toThrow()
  })
})

describe('shadeWeights', () => {
  const weights = stripWeights()
  const shades = shadeWeights()
  const peakWeight = Math.max(...weights)

  it('stays in (0, 1] and reaches exactly 1 at the heaviest strip', () => {
    for (const shade of shades) {
      expect(Number.isFinite(shade)).toBe(true)
      expect(shade).toBeGreaterThan(0)
      expect(shade).toBeLessThanOrEqual(1)
    }

    expect(peakIndex(shades)).toBe(peakIndex(weights))
    expect(Math.max(...shades)).toBe(1)
  })

  it('is the bend weights normalised to their maximum', () => {
    weights.forEach((weight, index) => {
      expect(shades[index], `strip ${index}`).toBeCloseTo(weight / peakWeight, 12)
      expect(shades[index] * peakWeight, `strip ${index}`).toBeCloseTo(weight, 12)
    })
  })

  it('normalises to the max, so the table does not sum to 1', () => {
    const total = shades.reduce((sum, shade) => sum + shade, 0)
    expect(total).toBeGreaterThan(1)
    expect(total).toBeCloseTo(weights.reduce((sum, weight) => sum + weight, 0) / peakWeight, 12)
  })

  it('preserves the unimodal shape of the bend weights', () => {
    const peak = peakIndex(shades)

    for (let index = 0; index < peak; index += 1) {
      expect(shades[index], `rising at ${index}`).toBeLessThan(shades[index + 1])
    }
    for (let index = peak; index < STRIP_COUNT - 1; index += 1) {
      expect(shades[index], `falling at ${index}`).toBeGreaterThan(shades[index + 1])
    }

    // The fore edge is the lightest end, the fold end carries more ink.
    expect(shades.indexOf(Math.min(...shades))).toBe(0)
    expect(shades[STRIP_COUNT - 1]).toBeGreaterThan(shades[0])
  })

  it('keeps the same ratio between any two strips as the bend weights', () => {
    for (let a = 0; a < STRIP_COUNT; a += 1) {
      for (let b = 0; b < STRIP_COUNT; b += 1) {
        expect(shades[a] / shades[b], `shade ${a}/${b}`).toBeCloseTo(weights[a] / weights[b], 12)
      }
    }
  })

  it('is a shared frozen table', () => {
    expect(shadeWeights()).toBe(shades)
    expect(Object.isFrozen(shades)).toBe(true)
    expect(() => (shades as unknown as number[]).push(0)).toThrow()
  })
})
