/**
 * The shape of the faux curl, as numbers.
 *
 * The CSS-3D sheet is cut into `STRIP_COUNT` vertical strips (a later task
 * owns the DOM). Each strip is rotated a little more than the one before it,
 * which bends the sheet around an axis parallel to the spine. This module only
 * answers two questions, and pure answers keep them testable without a browser:
 *
 * - how much of the whole bend falls on each strip (`stripWeights`), and
 * - how dark each strip is, as a fraction of the darkest one (`shadeWeights`).
 *
 * The weights are a Gaussian sampled at the middle of every strip, then
 * normalised to sum to exactly 1. The peak sits at `PEAK_U` (0.62), a little
 * past the middle of the page: a real page lifts near the fold and the last
 * third stays flat on the desk for longer, so the bend visually travels from
 * the fold outwards as the sheet turns.
 */

/** Number of vertical strips the turning sheet is cut into. */
export const STRIP_COUNT = 12

/** How far the strips fan out past a flat 180-degree sweep (visual tuning). */
export const CURL_AMPLITUDE = 1.05

/** Where along the sheet (0 = spine, 1 = fore edge) the bend is strongest. */
export const PEAK_U = 0.62

/** Standard deviation of the Gaussian, in the same 0..1 units as `u`. */
export const GAUSSIAN_WIDTH = 0.3

/** Middle of strip `i` in 0..1 sheet coordinates. */
function stripCenter(i: number): number {
  return (i + 0.5) / STRIP_COUNT
}

/** Raw (unnormalised) Gaussian weight for a strip. */
function gaussian(u: number): number {
  const t = (u - PEAK_U) / GAUSSIAN_WIDTH
  return Math.exp(-(t * t))
}

/**
 * Normalised bend weights: `STRIP_COUNT` finite, non-negative numbers whose
 * sum is 1. Index `i` is the strip covering `u = (i + 0.5) / STRIP_COUNT`.
 */
function computeStripWeights(): readonly number[] {
  const raw = Array.from({ length: STRIP_COUNT }, (_, i) => gaussian(stripCenter(i)))
  const total = raw.reduce((sum, weight) => sum + weight, 0)
  return Object.freeze(raw.map((weight) => weight / total))
}

/** Shade multiplier per strip: weight relative to the heaviest strip, in (0, 1]. */
function computeShadeWeights(weights: readonly number[]): readonly number[] {
  const peak = Math.max(...weights)
  return Object.freeze(weights.map((weight) => weight / peak))
}

const STRIP_WEIGHTS = computeStripWeights()
const SHADE_WEIGHTS = computeShadeWeights(STRIP_WEIGHTS)

/** Shared, frozen bend weights. Never mutate: the array is reused every frame. */
export function stripWeights(): readonly number[] {
  return STRIP_WEIGHTS
}

/** Shared, frozen shade multipliers: `weight / maxWeight`, each in (0, 1]. */
export function shadeWeights(): readonly number[] {
  return SHADE_WEIGHTS
}
