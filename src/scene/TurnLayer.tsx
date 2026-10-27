import { useCallback, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Spread } from '../content/deriveSpreads'
import { getBookState, type PageTurn } from '../state/bookState'
import { progressAt } from '../state/timing'
import type { PageText } from './Page'
import { BONE_COUNT, writeCurlPose, type MutableCurlPose } from './curl/curlPose'
import { PageMesh, type PageFace, type PageMeshRig } from './curl/PageMesh'

/**
 * The turning sheet and its animation.
 *
 * Which pages show (the rule this file encodes, one sheet covering the spine):
 *
 * | dir | static left | static right | sheet recto | sheet verso |
 * |-----|-------------|--------------|-------------|-------------|
 * | +1  | from.left   | to.right     | from.right  | to.left     |
 * | -1  | to.left     | from.right   | to.right    | from.left   |
 *
 * The rule behind the table: the sheet's recto is the page it lies face-up on
 * at curl 0 (the right page it starts from, or the one it lands on going back)
 * and its verso is the page it lies face-up on at curl 1 (the left page it
 * lands on, or the one it starts from). Each static page therefore only changes
 * while the sheet covers it, so no sheet is ever seen to swap content.
 *
 * Geometry: the rig is built as a right-hand sheet hinged on the spine, and its
 * root is only ever rotated the positive way (curl `dir = +1`), because a
 * negative root sweeps the paper *through* the desk (measured: min.y = -1.32
 * for `dir = -1`, +0.0835 for every `dir = +1` pose). A backward turn is the
 * same pose read backwards: curl p runs 1 -> 0.
 *
 * The sheet rides between the two rest heights (the left page sits on the
 * opened cover, higher than the right page) so that at both ends it lies on the
 * static page it replaces, a sheet thickness above it: no pop, no z-fighting.
 */

/** Clearance above the static page the sheet rests on: 0.3 mm, as in `Book.tsx`. */
const SHEET_CLEARANCE = 0.003

export interface TurnSheet {
  readonly from: number
  readonly to: number
  readonly dir: 1 | -1
}

export interface TurnLayerProps {
  readonly spreads: readonly Spread[]
  readonly pageText: ReadonlyMap<string, PageText>
  /** The sheet that is turning; `null` while the book is flat. */
  readonly sheet: TurnSheet | null
  /** Index of the spread on screen while flat, used to pre-bind the rig. */
  readonly restIndex: number
  /** Fixed turn progress 0..1 for the freeze harness; `null` follows the store. */
  readonly fixedProgress: number | null
  /** Rest heights of the two static sheets, in book units. */
  readonly rightPageY: number
  readonly leftPageY: number
}

function faceFor(
  spread: Spread | undefined,
  side: 'left' | 'right',
  pageText: ReadonlyMap<string, PageText>,
): PageFace | null {
  if (spread === undefined) return null
  const page = side === 'left' ? spread.left : spread.right
  const text = pageText.get(page.key)
  if (text === undefined) return null
  return { side, pageKey: page.key, text }
}

export function TurnLayer({
  spreads,
  pageText,
  sheet,
  restIndex,
  fixedProgress,
  rightPageY,
  leftPageY,
}: TurnLayerProps) {
  const rigRef = useRef<PageMeshRig | null>(null)
  const committedRef = useRef<PageTurn | null>(null)
  const pose = useMemo<MutableCurlPose>(
    () => ({ root: 0, deltas: new Array<number>(BONE_COUNT).fill(0) }),
    [],
  )

  const handleRig = useCallback((rig: PageMeshRig | null) => {
    rigRef.current = rig
  }, [])

  const faces = useMemo<{ front: PageFace; back: PageFace } | null>(() => {
    const from = sheet === null ? undefined : spreads[sheet.from]
    const to = sheet === null ? undefined : spreads[sheet.to]

    // Flat: keep the rig warm with the two pages that are already on screen.
    const front =
      sheet === null
        ? faceFor(spreads[restIndex], 'right', pageText)
        : faceFor(sheet.dir === 1 ? from : to, 'right', pageText)
    const back =
      sheet === null
        ? faceFor(spreads[restIndex], 'left', pageText)
        : faceFor(sheet.dir === 1 ? to : from, 'left', pageText)

    if (front === null || back === null) return null
    return { front, back }
  }, [sheet, spreads, restIndex, pageText])

  useFrame(() => {
    const rig = rigRef.current
    const state = getBookState()

    let progress: number | null = null
    if (fixedProgress !== null) {
      progress = fixedProgress
    } else if (state.phase === 'TURNING' && state.turn !== null) {
      progress = progressAt(state.turn, performance.now())
    }

    if (rig === null || sheet === null || progress === null) {
      if (rig !== null) rig.group.visible = false
      return
    }

    // A backward turn is the forward pose read from the other end. The rig is
    // never mirrored: `dir = -1` would push the sheet below the desk.
    const curlP = sheet.dir === 1 ? progress : 1 - progress

    // Placement must be in place before `applyPose`, which re-binds the
    // skeleton to the rig's world matrix when that matrix has moved.
    const group = rig.group
    group.position.set(0, rightPageY + (leftPageY - rightPageY) * curlP + SHEET_CLEARANCE, 0)

    writeCurlPose(curlP, 1, pose)
    rig.applyPose(pose)
    group.visible = true

    // Freeze stills are not turns: they never commit and never move the book.
    if (fixedProgress !== null || progress < 1) return
    if (state.phase !== 'TURNING' || state.turn === null) return
    if (committedRef.current === state.turn) return

    committedRef.current = state.turn
    state.commitTurn()
  })

  if (faces === null) return null

  return <PageMesh front={faces.front} back={faces.back} onRig={handleRig} />
}
