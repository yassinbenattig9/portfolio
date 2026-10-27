import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { Spread } from '../content/deriveSpreads'
import { getFreeze } from '../dev/freeze'
import { getBookState, useBookStore } from '../state/bookState'
import { easeInOutCubic, progressAt } from '../state/timing'
import { Page, PAGE_HEIGHT, PAGE_WIDTH, type PageText } from './Page'
import { TurnLayer, type TurnSheet } from './TurnLayer'

/**
 * The closed hardcover and its page block.
 *
 * Local frame: spine at x = 0, right sheet extends +x, book lies in the XZ
 * plane, +y is up. 1 unit = 10 cm. Nothing shares a height with anything else:
 * the boards, the page block and every sheet are offset by at least 0.3 mm so
 * no two faces are coplanar (z-fighting is a hard fail).
 */

const BOARD_T = 0.03 // 3 mm boards
const STACK_BOTTOM = 0.031
const STACK_TOP = 0.076
const RIGHT_PAGE_Y = 0.079
const COVER_BOTTOM = 0.082
const LEFT_PAGE_Y = 0.095
/** Spine outer face; the front cover is hinged here, clear of the spine board. */
const SPINE_X = -0.06
const BOOK_LIFT = 0.0015 // clear of the desk plane at y = 0

const COVER_WIDTH = PAGE_WIDTH - SPINE_X
const COVER_CENTER_X = COVER_WIDTH / 2

export interface BookProps {
  readonly spreads: readonly Spread[]
  readonly pageText: ReadonlyMap<string, PageText>
}

/** One spread's pair of static sheets, by index into `spreads`. */
interface StaticPages {
  readonly left: number
  readonly right: number
}

export function Book({ spreads, pageText }: BookProps) {
  // Discrete facts only: `spread` moves when a command does, `phase` and `turn`
  // flip at most twice per transition. Nothing here re-renders per frame.
  const spreadIndex = useBookStore((state) => state.spread)
  const phase = useBookStore((state) => state.phase)
  const turn = useBookStore((state) => state.turn)
  const coverRef = useRef<THREE.Group>(null)
  const leftPageRef = useRef<THREE.Group>(null)

  const lastIndex = Math.max(spreads.length - 1, 0)
  const index = Math.max(0, Math.min(spreadIndex, spreads.length - 1))
  const freeze = getFreeze()

  /** A still for look-dev: the store stays OPEN, the sheet never commits. */
  const frozen = useMemo<TurnSheet | null>(() => {
    if (freeze === null || phase !== 'OPEN') return null
    const to = Math.min(Math.max(index + freeze.dir, 0), lastIndex)
    return { from: index, to, dir: freeze.dir }
  }, [freeze, phase, index, lastIndex])

  /** The sheet in the air: the store's live turn while TURNING, else a frozen one. */
  const sheet = useMemo<TurnSheet | null>(() => {
    if (turn !== null) return { from: turn.from, to: turn.to, dir: turn.dir }
    return frozen
  }, [turn, frozen])

  /**
   * Which static sheets flank the spine. Each one only changes while the
   * turning sheet is lying on top of it (see `TurnLayer` for the table), so the
   * page underneath can swap without a pop.
   */
  const staticPages = useMemo<StaticPages>(() => {
    if (sheet === null) return { left: index, right: index }
    return sheet.dir === 1
      ? { left: sheet.from, right: sheet.to }
      : { left: sheet.to, right: sheet.from }
  }, [sheet, index])

  const leftSpread = spreads[staticPages.left]
  const rightSpread = spreads[staticPages.right]
  const leftText = leftSpread === undefined ? undefined : pageText.get(leftSpread.left.key)
  const rightText = rightSpread === undefined ? undefined : pageText.get(rightSpread.right.key)

  /** Clicking the closed book opens it; an open book ignores page clicks for now. */
  const handleClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    const state = getBookState()
    if (state.phase === 'CLOSED') state.openBook(performance.now())
  }, [])

  const handlePointerOver = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (getBookState().phase !== 'CLOSED') return
    event.stopPropagation()
    document.body.style.cursor = 'pointer'
  }, [])

  const handlePointerOut = useCallback(() => {
    document.body.style.cursor = ''
  }, [])

  useEffect(() => () => { document.body.style.cursor = '' }, [])

  useFrame(() => {
    const cover = coverRef.current
    const leftPage = leftPageRef.current
    if (cover === null || leftPage === null) return

    const state = getBookState()
    const now = performance.now()
    const open = state.open

    // Progress is derived from the store's timestamp every frame; no state is
    // written while animating, only the two refs below (no per-frame setState).
    let progress: number
    if (open !== null) {
      progress = easeInOutCubic(progressAt(open, now))
    } else {
      progress = state.phase === 'CLOSED' ? 0 : 1
    }

    cover.rotation.z = progress * Math.PI

    // The left sheet only exists once the cover has swung past vertical; while
    // the book is closed it would stick out under the fore edge.
    leftPage.visible = progress > 0.5

    if (open !== null && progressAt(open, now) >= 1) {
      if (state.phase === 'OPENING') state.commitOpen()
      else if (state.phase === 'CLOSING') state.commitClose()
    }

    // The page turn itself lives in `TurnLayer`: it poses the skinned sheet and
    // commits the turn when the sheet has landed.
  })

  const bookOpen = phase === 'OPEN' || phase === 'TURNING'

  return (
    <group position={[0, BOOK_LIFT, 0]}>
      {/* Back board, flush with the spine. */}
      <mesh position={[COVER_CENTER_X + SPINE_X / 2, BOARD_T / 2, 0]} receiveShadow>
        <boxGeometry args={[COVER_WIDTH, BOARD_T, PAGE_HEIGHT]} />
        <meshStandardMaterial color="#333333" roughness={0.7} metalness={0} />
      </mesh>

      {/* Page block: the visible stack of sheet edges below the current page. */}
      <mesh
        position={[PAGE_WIDTH / 2 - 0.005, (STACK_BOTTOM + STACK_TOP) / 2, 0]}
        receiveShadow
      >
        <boxGeometry args={[PAGE_WIDTH + 0.01, STACK_TOP - STACK_BOTTOM, PAGE_HEIGHT - 0.04]} />
        <meshStandardMaterial color="#8a8a8a" roughness={0.95} metalness={0} />
      </mesh>

      {/* Spine board: stopped below the cover so the hinge stays clear. */}
      <mesh position={[SPINE_X / 2, COVER_BOTTOM / 2, 0]} receiveShadow>
        <boxGeometry args={[-SPINE_X, COVER_BOTTOM, PAGE_HEIGHT]} />
        <meshStandardMaterial color="#333333" roughness={0.7} metalness={0} />
      </mesh>

      {/* Left sheet rests on the opened cover; hidden while closed. */}
      <group ref={leftPageRef} visible={false}>
        {leftText !== undefined && leftSpread !== undefined && (
          <Page
            key={leftSpread.left.key}
            side="left"
            pageKey={leftSpread.left.key}
            text={leftText}
            y={LEFT_PAGE_Y}
          />
        )}
      </group>

      {/* Right sheet sits on top of the page block. */}
      {rightText !== undefined && rightSpread !== undefined && (
        <Page
          key={rightSpread.right.key}
          side="right"
          pageKey={rightSpread.right.key}
          text={rightText}
          y={RIGHT_PAGE_Y}
        />
      )}

      {/* The sheet in the air. Mounted whenever the book is open so the rig and
          its textures exist before the first turn needs them. */}
      {bookOpen && (
        <TurnLayer
          spreads={spreads}
          pageText={pageText}
          sheet={sheet}
          restIndex={index}
          fixedProgress={frozen === null || freeze === null ? null : freeze.progress}
          rightPageY={RIGHT_PAGE_Y}
          leftPageY={LEFT_PAGE_Y}
        />
      )}

      {/* Front cover: rigid, hinged on the spine's outer edge. */}
      <group ref={coverRef} position={[SPINE_X, COVER_BOTTOM, 0]}>
        <mesh
          position={[COVER_CENTER_X, BOARD_T / 2, 0]}
          castShadow
          receiveShadow
          onClick={handleClick}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          // TODO(T7): safe to cull today, but the cover may gain a skinned
          // endpaper; skinned bounds come from the bind pose only.
          frustumCulled={false}
        >
          <boxGeometry args={[COVER_WIDTH, BOARD_T, PAGE_HEIGHT]} />
          <meshStandardMaterial color="#3a3a3a" roughness={0.62} metalness={0} />
        </mesh>
      </group>
    </group>
  )
}
