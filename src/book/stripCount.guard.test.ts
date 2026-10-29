/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CURL_AMPLITUDE, STRIP_COUNT, shadeWeights, stripWeights } from './curlShape.ts'

/**
 * Cross-module guard for the strip count.
 *
 * `TurningSheet` does not export how many strips it renders; it renders one
 * `.strip` per index from 0 to `STRIP_COUNT - 1`, and the weights tables must
 * line up with those indices. The count also appears in `book.css` as a width
 * divisor, the last-strip selector and the shade gradient width, so this test
 * reads the real sources and fails if any of those drift apart silently.
 */

const read = (file: string): string =>
  readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8')

const TSX = read('./TurningSheet.tsx')
const CSS = read('./book.css')

/** First capture group of `pattern`, as a number, or a failure if absent. */
function captured(source: string, pattern: RegExp): number {
  const match = source.match(pattern)
  if (match === null) throw new Error(`source no longer matches ${pattern}`)
  return Number(match[1])
}

describe('the weights tables and the sheet agree on the strip count', () => {
  it('has one weight per strip, in both tables', () => {
    expect(stripWeights().length).toBe(STRIP_COUNT)
    expect(shadeWeights().length).toBe(STRIP_COUNT)
    expect(stripWeights().length).toBe(shadeWeights().length)
  })

  it('terminates the rendered strip chain at STRIP_COUNT - 1 rather than a literal', () => {
    expect(TSX).toMatch(/import\s*\{[^}]*\bSTRIP_COUNT\b[^}]*\}\s*from\s*'\.\/curlShape'/)
    expect(TSX).toMatch(/const last = index === STRIP_COUNT - 1/)
    expect(TSX).toMatch(/index=\{index \+ 1\}/)
    // The count is defined in one place only: curlShape.
    expect(TSX).not.toMatch(/const STRIP_COUNT =/)
  })

  it('derives the per-strip CSS angle from CURL_AMPLITUDE', () => {
    expect(TSX).toMatch(/const CURL_DEG = .*CURL_AMPLITUDE/)
  })
})

describe('the stylesheet agrees on the strip count', () => {
  it('styles the last rendered strip index', () => {
    const indexes = [...CSS.matchAll(/\.strip\[data-strip='(\d+)'\]/g)].map((match) =>
      Number(match[1]),
    )

    expect(indexes.length).toBeGreaterThan(0)
    for (const index of indexes) expect(index).toBeLessThan(STRIP_COUNT)
    // The special "fore edge" rule must target the last of the chain.
    expect(Math.max(...indexes)).toBe(STRIP_COUNT - 1)
  })

  it('makes a strip one STRIP_COUNTth of a page', () => {
    const pageDivisor = captured(CSS, /--page-w:\s*calc\(var\(--book-w\)\s*\/\s*(\d+)\)/)
    const stripDivisor = captured(CSS, /--strip-w:\s*calc\(var\(--book-w\)\s*\/\s*(\d+)\)/)

    expect(pageDivisor).toBe(2)
    expect(stripDivisor).toBe(STRIP_COUNT * 2)
    // Sanity: the two lengths describe the same page.
    expect(stripDivisor / pageDivisor).toBe(STRIP_COUNT)
  })

  it('sizes the shade gradient to the whole strip table', () => {
    expect(captured(CSS, /background-size:\s*calc\(var\(--strip-w\)\s*\*\s*(\d+)\)/)).toBe(
      STRIP_COUNT,
    )
  })

  it('keeps the CSS curl fallback in step with CURL_AMPLITUDE', () => {
    const fallbackDeg = captured(CSS, /--curl,\s*([\d.]+)deg/)
    const expectedDeg = (CURL_AMPLITUDE * 180) / Math.PI

    // Tolerance, not equality: the fallback is only used if `--curl` is
    // missing (the component always writes it). The current literal is
    // 60.159deg against a computed 60.161deg, a 0.002deg cosmetic drift.
    expect(Math.abs(fallbackDeg - expectedDeg)).toBeLessThan(0.01)
  })
})
