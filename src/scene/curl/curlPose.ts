/**
 * Page-curl mathematics.
 *
 * Pure numbers only: no three, no React, no store. `pageSkeleton.ts` turns the
 * result into bone rotations; tests and look-dev can run this in isolation.
 *
 * A chain of `BONE_COUNT` bones runs along the sheet from the spine (x = 0) to
 * the fore edge, each rotating about local z. The root bone carries the whole
 * turn; every bone adds a slice of a gaussian curl, so the sheet folds like
 * paper instead of swinging like a card.
 */

import { easeInOutCubic } from '../../state/timing'

/** Bones in the chain. Must match `BONE_COUNT` in `pageSkeleton.ts`. */
export const BONE_COUNT = 48

/** Total curl at the peak of the turn, in radians (~60 degrees). */
export const CURL_AMPLITUDE = 1.05

/** Where the curl peaks along the chain, as a fraction of the sheet width. */
export const PEAK_U = 0.62

/** Gaussian spread around `PEAK_U`. Smaller tightens the roll. */
export const GAUSSIAN_WIDTH = 0.3

/** Look-dev budget per bone. The shipped weights peak at ~0.044 rad. */
export const MAX_BONE_DELTA = 0.12

/** Root turn angle plus one local-z delta per bone. */
export interface CurlPose {
  readonly root: number
  readonly deltas: readonly number[]
}

/** The same shape, caller-owned, for the allocation-free per-frame path. */
export interface MutableCurlPose {
  root: number
  deltas: number[]
}

const LAST_BONE = BONE_COUNT - 1

/**
 * Unit gaussian weights, normalised once at load. The distribution is constant
 * in `p`: only the amplitude moves, so every frame is 48 multiplies.
 */
function buildUnitWeights(): readonly number[] {
  const raw: number[] = []
  let sum = 0

  for (let i = 0; i <= LAST_BONE; i += 1) {
    const u = i / LAST_BONE
    const weight = Math.exp(-(((u - PEAK_U) / GAUSSIAN_WIDTH) ** 2))
    raw.push(weight)
    sum += weight
  }

  return Object.freeze(raw.map((weight) => weight / sum))
}

const UNIT_WEIGHTS = buildUnitWeights()

const clamp01 = (value: number): number =>
  Number.isNaN(value) ? 0 : value < 0 ? 0 : value > 1 ? 1 : value

/**
 * Writes a pose into a caller-owned object. No allocation, so `useFrame` can
 * reuse one scratch pose for the life of the rig.
 *
 * `dir` is only a sign of the root turn: forward and backward turns share the
 * same maths, so there is no second code path to keep in sync.
 */
export function writeCurlPose(p: number, dir: 1 | -1, out: MutableCurlPose): void {
  const progress = clamp01(p)

  // Exact endpoints: rest is bit-identical to a flat sheet and the turn lands
  // on exactly pi, so neither end pops.
  if (progress <= 0) {
    out.root = 0
    out.deltas.fill(0)
    return
  }

  if (progress >= 1) {
    out.root = dir * Math.PI
    out.deltas.fill(0)
    return
  }

  const s = easeInOutCubic(progress)
  const amplitude = CURL_AMPLITUDE * Math.sin(Math.PI * s)

  out.root = dir * Math.PI * s
  for (let i = 0; i <= LAST_BONE; i += 1) {
    out.deltas[i] = amplitude * UNIT_WEIGHTS[i]
  }
}

/**
 * The pose of a sheet that has turned `p` of the way, `dir = 1` forward or
 * `dir = -1` backward.
 *
 * `root` is the turn of the whole sheet about the spine; `deltas[i]` is the
 * extra bend of bone `i`, all about the same local z axis (no twist). The
 * deltas never sum to more than `CURL_AMPLITUDE` in absolute value and are
 * exactly zero at `p = 0` and `p = 1`.
 */
export function curlPose(p: number, dir: 1 | -1): CurlPose {
  const deltas = new Array<number>(BONE_COUNT).fill(0)
  const pose: MutableCurlPose = { root: 0, deltas }

  writeCurlPose(p, dir, pose)

  // Frozen so a caller cannot corrupt a pose that is shared with a rig.
  Object.freeze(deltas)
  return { root: pose.root, deltas }
}
