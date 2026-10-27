import * as THREE from 'three'

/**
 * The page rig: one flat sheet turned into a bone chain, ready to be bent by
 * the numbers from `curlPose.ts` (this file deliberately imports only three so
 * the maths can be swapped or run in tests without a renderer).
 *
 * Book frame, as in `Page.tsx`: spine at local x = 0, sheet extends +x, the
 * sheet lies in the XZ plane with its front face up. The bind pose is flat, so
 * a page at rest is indistinguishable from the static plane it replaces.
 */

/** Sheet size in book units (1 unit = 10 cm): 15 cm x 21 cm. Mirrors `Page.tsx`. */
const PAGE_WIDTH = 1.5
const PAGE_HEIGHT = 2.1

/** Bones in the chain. Must match `BONE_COUNT` in `curlPose.ts`. */
const BONE_COUNT = 48

/** Vertical strips per bone: 96 segments, 485 vertices for 48 bones. */
const SEGMENTS_PER_BONE = 2

/** Rows across the sheet. The bend is uniform along z; rows serve shading and tuning. */
const SEGMENTS_Z = 4

const PAPER_FRONT = '#9c9c9c'
const PAPER_BACK = '#8d8d8d'
const PAPER_ROUGHNESS = 0.92

/** Structural copy of `CurlPose`; importing it would break the three-only rule. */
export interface CurlPoseLike {
  readonly root: number
  readonly deltas: readonly number[]
}

export interface PageRigOptions {
  readonly width?: number
  readonly height?: number
  readonly boneCount?: number
}

export interface PageRig {
  /** Add this to the scene and place it; the rig re-binds if you move it. */
  readonly group: THREE.Group
  readonly geometry: THREE.BufferGeometry
  readonly skeleton: THREE.Skeleton
  readonly bones: readonly THREE.Bone[]
  readonly front: THREE.SkinnedMesh
  readonly back: THREE.SkinnedMesh
  readonly frontMaterial: THREE.MeshStandardMaterial
  readonly backMaterial: THREE.MeshStandardMaterial
  /**
   * Writes the pose into the bones. Allocation-free: call it from `useFrame`.
   * `lift` is a vertical translation of the whole sheet, applied on the root
   * bone after the bind: keep `group` still and animate the sheet through this,
   * or every frame re-binds the skeleton.
   */
  applyPose(pose: CurlPoseLike, lift?: number): void
  /** Back to the flat bind pose without touching the geometry. */
  resetPose(): void
  /** Re-captures bind matrices from the current placement of `group`. */
  rebind(): void
  /** Frees geometry, materials and skeleton. Unmount the group first. */
  dispose(): void
}

/**
 * Tent weights along the chain: every vertex is influenced by the bone behind
 * it and the one ahead, so the sheet bends smoothly and two influences per
 * vertex are enough (the shader limit three uses anyway).
 */
function buildSkinAttributes(
  geometry: THREE.BufferGeometry,
  boneCount: number,
  spacing: number,
): void {
  const position = geometry.getAttribute('position')
  const vertexCount = position.count
  const skinIndex = new Float32Array(vertexCount * 4)
  const skinWeight = new Float32Array(vertexCount * 4)
  const lastBone = boneCount - 1

  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const x = position.getX(vertex)
    const t = Math.min(Math.max(x / spacing, 0), lastBone)
    const behind = Math.min(Math.floor(t), lastBone - 1)
    const ahead = t - behind
    const offset = vertex * 4

    skinIndex[offset] = behind
    skinWeight[offset] = 1 - ahead
    skinIndex[offset + 1] = behind + 1
    skinWeight[offset + 1] = ahead
  }

  geometry.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4))
  geometry.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4))
}

export function createPageRig(options: PageRigOptions = {}): PageRig {
  const width = options.width ?? PAGE_WIDTH
  const height = options.height ?? PAGE_HEIGHT
  const boneCount = Math.max(2, Math.round(options.boneCount ?? BONE_COUNT))
  const spacing = width / boneCount

  const geometry = new THREE.PlaneGeometry(
    width,
    height,
    boneCount * SEGMENTS_PER_BONE,
    SEGMENTS_Z,
  )
  // Bake the flat pose into the geometry: spine on x = 0, sheet in the XZ
  // plane. Same orientation as the rotated plane in `Page.tsx`, so textures
  // and placement line up unchanged.
  geometry.translate(width / 2, 0, 0)
  geometry.rotateX(-Math.PI / 2)
  buildSkinAttributes(geometry, boneCount, spacing)

  // The chain is built once and never re-parented; only rotations change.
  const bones: THREE.Bone[] = []
  for (let i = 0; i < boneCount; i += 1) {
    const bone = new THREE.Bone()
    bone.name = `page-bone-${i}`
    bone.position.set(i === 0 ? 0 : spacing, 0, 0)
    if (i > 0) bones[i - 1].add(bone)
    bones.push(bone)
  }

  const group = new THREE.Group()
  group.name = 'page-rig'
  group.add(bones[0])
  group.updateMatrixWorld(true)

  const skeleton = new THREE.Skeleton(bones)
  // Inverse rest transforms in the rig's own space, kept so a re-bind does not
  // have to straighten the bones first.
  const restInverses = skeleton.boneInverses.map((inverse) => inverse.clone())

  const frontMaterial = new THREE.MeshStandardMaterial({
    color: PAPER_FRONT,
    roughness: PAPER_ROUGHNESS,
    metalness: 0,
    side: THREE.FrontSide,
  })
  const backMaterial = new THREE.MeshStandardMaterial({
    color: PAPER_BACK,
    roughness: PAPER_ROUGHNESS,
    metalness: 0,
    side: THREE.BackSide,
  })

  // One sheet, two faces: the same geometry and the same skeleton, drawn from
  // both sides. FrontSide and BackSide never cover the same fragment, so the
  // verso cannot z-fight with the recto, and DetachedBindMode keeps both faces
  // on the bone transforms instead of each mesh's own matrix.
  const front = new THREE.SkinnedMesh(geometry, frontMaterial)
  const back = new THREE.SkinnedMesh(geometry, backMaterial)
  const faces: readonly THREE.SkinnedMesh[] = [front, back]

  for (const face of faces) {
    face.name = face === front ? 'page-front' : 'page-back'
    face.bindMode = THREE.DetachedBindMode
    // three derives a skinned mesh's bounds from the bind pose only, so a
    // curled page would be culled mid-turn and vanish. Two sheets must stay
    // visible, so the culling test is simply off.
    face.frustumCulled = false
    face.receiveShadow = true
    // The curl must throw its own contact shadow onto the page underneath: the
    // stills are judged on exactly that.
    face.castShadow = true
    group.add(face)
  }

  group.updateMatrixWorld(true)
  front.bind(skeleton)
  back.bind(skeleton)

  const boundWorld = new THREE.Matrix4()
  const worldInverse = new THREE.Matrix4()

  function rebind(): void {
    group.updateWorldMatrix(true, false)
    boundWorld.copy(group.matrixWorld)
    worldInverse.copy(boundWorld).invert()

    for (let i = 0; i < boneCount; i += 1) {
      // (P * rest)^-1 = rest^-1 * P^-1, so the rig can sit anywhere in the book.
      skeleton.boneInverses[i].multiplyMatrices(restInverses[i], worldInverse)
    }

    for (const face of faces) {
      face.updateWorldMatrix(true, false)
      face.bindMatrix.copy(face.matrixWorld)
      face.bindMatrixInverse.copy(face.bindMatrix).invert()
    }
  }

  function applyPose(pose: CurlPoseLike, lift = 0): void {
    // The group is meant to stay still, so this check is expected to fail its
    // first time only (the rig is parented after it is built) and never again:
    // moving the sheet by a bone instead of by the group is what keeps the
    // bind-pose equality holding and the 48 bone inversions off the frame path.
    group.updateWorldMatrix(true, false)
    if (!boundWorld.equals(group.matrixWorld)) rebind()

    // A y translation commutes with the root's z rotation, so this is the same
    // placement the group used to carry, without touching the group transform.
    bones[0].position.y = lift

    const deltas = pose.deltas
    for (let i = 0; i < boneCount; i += 1) {
      const curl = i < deltas.length ? deltas[i] : 0
      // The root carries the turn; its own curl slice rides on top of it.
      bones[i].rotation.z = i === 0 ? pose.root + curl : curl
    }
  }

  function resetPose(): void {
    for (const bone of bones) bone.rotation.z = 0
    bones[0].position.y = 0
  }

  function dispose(): void {
    geometry.dispose()
    frontMaterial.dispose()
    backMaterial.dispose()
    skeleton.dispose()
  }

  return {
    group,
    geometry,
    skeleton,
    bones,
    front,
    back,
    frontMaterial,
    backMaterial,
    applyPose,
    resetPose,
    rebind,
    dispose,
  }
}
