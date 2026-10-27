import { useEffect, useState } from 'react'
import { ClampToEdgeWrapping } from 'three'
import type { Group } from 'three'
import { acquirePageTexture, type PageSide, type PageText } from '../Page'
import { createPageRig, type CurlPoseLike, type PageRig } from './pageSkeleton'

/**
 * The turning sheet: one skinned page rig (see `curl/pageSkeleton.ts`) plus the
 * two printed faces, mounted for as long as the book is open.
 *
 * Two rules make this cheap and flicker-free:
 *
 * - The rig is created in an effect, never in render. React StrictMode mounts
 *   twice in dev, so the effect that creates a rig is always the effect that
 *   destroys it; a stub is never `dispose()`d under a live sheet.
 * - The sheet starts hidden and is only made visible by the frame loop that
 *   poses it, so the first rendered frame of a turn is never the bind pose at
 *   the wrong height.
 *
 * Textures come from the one cache in `Page.tsx`; the verso is a `clone()` of
 * the cached texture (same canvas, same GPU upload, no second texture system).
 */

export interface PageFace {
  readonly side: PageSide
  readonly pageKey: string
  readonly text: PageText
}

/** What the frame loop is allowed to do with the sheet. */
export interface PageMeshRig {
  readonly group: Group
  applyPose(pose: CurlPoseLike, lift?: number): void
}

export interface PageMeshProps {
  /** Recto: the face that shows while the sheet lies on the right page. */
  readonly front: PageFace
  /** Verso: the face that shows once the sheet has flipped onto the left. */
  readonly back: PageFace
  /** Receives the live rig (or `null` when it is gone). Must be stable. */
  readonly onRig: (rig: PageMeshRig | null) => void
}

export function PageMesh({ front, back, onRig }: PageMeshProps) {
  const [rig, setRig] = useState<PageRig | null>(null)

  useEffect(() => {
    const created = createPageRig()
    created.group.visible = false
    setRig(created)
    onRig(created)

    return () => {
      onRig(null)
      setRig(null)
      created.dispose()
    }
  }, [onRig])

  useEffect(() => {
    if (rig === null) return

    const recto = acquirePageTexture(front.side, front.pageKey, front.text)
    const verso = acquirePageTexture(back.side, back.pageKey, back.text)

    // A verso is printed on the reverse of the sheet, so it reads upright only
    // when seen from the back: mirror it in u. Every other aspect of the cached
    // texture (canvas, colour space, rotation for the left page) is undone here
    // because the skinned sheet supplies its own orientation.
    const mirrored = verso.texture.clone()
    mirrored.center.set(0.5, 0.5)
    mirrored.rotation = 0
    mirrored.repeat.set(-1, 1)
    mirrored.offset.set(0, 0)
    mirrored.wrapS = ClampToEdgeWrapping
    mirrored.needsUpdate = true

    // The rig ships with plain grey materials; with the canvas texture on them
    // the white base keeps the paper reading as the same grey sheet as the
    // static pages next to it.
    rig.frontMaterial.map = recto.texture
    rig.backMaterial.map = mirrored
    rig.frontMaterial.color.setRGB(1, 1, 1)
    rig.backMaterial.color.setRGB(1, 1, 1)
    rig.frontMaterial.needsUpdate = true
    rig.backMaterial.needsUpdate = true

    return () => {
      rig.frontMaterial.map = null
      rig.backMaterial.map = null
      rig.frontMaterial.needsUpdate = true
      rig.backMaterial.needsUpdate = true
      mirrored.dispose()
      verso.release()
      recto.release()
    }
  }, [rig, front, back])

  if (rig === null) return null
  return <primitive object={rig.group} />
}
