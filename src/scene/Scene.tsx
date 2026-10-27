import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import type { RootState } from '@react-three/fiber'
import type { Page, Spread } from '../content/deriveSpreads'
import type { Portfolio } from '../content/schema'
import { getBookState } from '../state/bookState'
import { Book } from './Book'
import { CameraRig, CAMERA_POSES } from './CameraRig'
import { Desk } from './Desk'
import { Lights } from './Lights'
import type { PageText } from './Page'

/**
 * The R3F entry point. Named export so `React.lazy(() => import('./scene/Scene'))`
 * can split the whole 3D bundle (three + R3F) out of the first paint later.
 *
 * This is also the only place that turns content into page text: the Book gets
 * finished spreads and a page-key -> text map, so the CSS-3D fallback can reuse
 * the same derivation without knowing about three.
 */

export interface SceneProps {
  readonly spreads: readonly Spread[]
  readonly content: Portfolio
}

function textForPage(page: Page, content: Portfolio): PageText {
  const project =
    page.projectId === undefined
      ? undefined
      : content.projects.find((entry) => entry.id === page.projectId)

  switch (page.kind) {
    case 'contents':
      return { label: 'Contents', title: 'Contents' }
    case 'about':
      return { label: 'About', title: 'About', body: content.about.summary }
    case 'story':
      return {
        label: 'Story',
        title: project?.title ?? page.key,
        body: project?.summary,
      }
    case 'demo':
      return { label: 'Demo', title: project?.title ?? page.key }
    case 'blank':
      return { label: 'Blank', title: '' }
    case 'contact':
      return { label: 'Contact', title: 'Contact', body: content.contact.email }
  }
}

function buildPageText(content: Portfolio, spreads: readonly Spread[]): ReadonlyMap<string, PageText> {
  const map = new Map<string, PageText>()
  for (const spread of spreads) {
    map.set(spread.left.key, textForPage(spread.left, content))
    map.set(spread.right.key, textForPage(spread.right, content))
  }
  return map
}

/**
 * Shadow-map upkeep for the on-demand map set up in `onCreated`.
 *
 * A shadow map is 2048² re-rendered from scratch: while the book sits still it
 * is pure waste. The map is redrawn on every frame that actually moves
 * something (OPENING, CLOSING, TURNING — the hinge, the cover, the curl and
 * the sheet's new contact shadow) plus the first frame after a transition ends,
 * so whichever `useFrame` runs last cannot leave the map one frame stale.
 * Sitting OPEN costs a boolean read per frame and no shadow pass.
 */
function ShadowMapSync() {
  const wasAnimating = useRef(true)

  useFrame((state) => {
    const book = getBookState()
    const animating = book.open !== null || book.turn !== null
    if (animating || wasAnimating.current) state.gl.shadowMap.needsUpdate = true
    wasAnimating.current = animating
  })

  return null
}

export function Scene({ spreads, content }: SceneProps) {
  const pageText = useMemo(() => buildPageText(content, spreads), [content, spreads])
  const [cameraX, cameraY, cameraZ] = CAMERA_POSES.closed.position
  const warmedUp = useRef(false)

  // Shader warm-up: three 0.186's `compile(scene, camera)` walks every mesh —
  // hidden ones included — and builds its program, returning Set<Material>.
  // Without it the first turn compiles the skinned sheet's material inside the
  // frame that starts the curl, which reads as a stutter. `onCreated` fires
  // once, after the scene graph exists and before the first render.
  const warmUp = (state: RootState) => {
    if (warmedUp.current) return
    warmedUp.current = true
    state.gl.compile(state.scene, state.camera)
    // The key light and the book only move during a transition, so the shadow
    // map is rendered on demand (`ShadowMapSync`) instead of 60 times a second.
    state.gl.shadowMap.autoUpdate = false
    state.gl.shadowMap.needsUpdate = true
  }

  // three 0.186 removed PCFSoftShadowMap: "soft" silently falls back to PCF and
  // logs a warning, so request the PCF map that is actually in use.
  return (
    <Canvas
      dpr={[1, 2]}
      frameloop="always"
      shadows="percentage"
      gl={{ antialias: true }}
      camera={{ fov: CAMERA_POSES.closed.fov, near: 0.1, far: 60, position: [cameraX, cameraY, cameraZ] }}
      onCreated={warmUp}
    >
      <color attach="background" args={['#24262a']} />
      <Lights />
      <Desk />
      <Book spreads={spreads} pageText={pageText} />
      <ShadowMapSync />
      <CameraRig />
    </Canvas>
  )
}
