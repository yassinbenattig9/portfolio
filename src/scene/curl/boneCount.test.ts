/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { BONE_COUNT } from './curlPose.ts'

/**
 * `pageSkeleton.ts` deliberately does not export its bone count (it imports
 * only three so the maths can run without a renderer), so the two literals are
 * compared at the source level. If either file changes its chain length alone,
 * the skin weights and the pose deltas no longer line up and the page deforms
 * incorrectly — this test makes that a failing build instead of a visual bug.
 */
const skeletonPath = fileURLToPath(new URL('./pageSkeleton.ts', import.meta.url))
const skeletonSource = readFileSync(skeletonPath, 'utf8')

const declaredBoneCount = /(?:^|\n)\s*(?:export\s+)?const\s+BONE_COUNT\s*=\s*(\d+)/.exec(
  skeletonSource,
)

describe('bone count consistency', () => {
  it('pageSkeleton declares a numeric BONE_COUNT for the comparison to be meaningful', () => {
    expect(declaredBoneCount, `${skeletonPath} must declare const BONE_COUNT = <number>`).not.toBeNull()
  })

  it('curlPose.BONE_COUNT equals the bone count pageSkeleton builds', () => {
    const skeletonBones = Number(declaredBoneCount?.[1])
    expect(Number.isInteger(skeletonBones)).toBe(true)
    expect(skeletonBones).toBe(BONE_COUNT)
  })

  it('the shared count is usable as a chain length', () => {
    expect(Number.isInteger(BONE_COUNT)).toBe(true)
    // The rig needs at least two bones for the tent weights to have an ahead bone.
    expect(BONE_COUNT).toBeGreaterThan(1)
  })
})
