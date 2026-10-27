import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

/**
 * One flat, static page sheet. Phase 0 only: no curl (see TODO(T7)).
 *
 * The sheet is a plane in the book's local XZ plane, hinged at the spine
 * (`local x = 0`). A right sheet extends +x; the left sheet is the same sheet
 * rotated pi about the y axis at the spine, like a real page flipped over.
 */

/** Sheet size in book units (1 unit = 10 cm): 15 cm x 21 cm. */
export const PAGE_WIDTH = 1.5
export const PAGE_HEIGHT = 2.1

export type PageSide = 'left' | 'right'

/** Everything the placeholder page prints. No art, only real JSON text. */
export interface PageText {
  /** Small eyebrow label, e.g. `STORY`. */
  readonly label: string
  /** Page title; an empty string draws a blank sheet. */
  readonly title: string
  readonly body?: string
}

export interface PageProps {
  readonly side: PageSide
  readonly pageKey: string
  readonly text: PageText
  /** Height of this sheet above the book group's origin, in book units. */
  readonly y: number
}

const TEXTURE_WIDTH = 1024
const TEXTURE_HEIGHT = Math.round(TEXTURE_WIDTH * (PAGE_HEIGHT / PAGE_WIDTH))
const FONT_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
const PAPER = '#9c9c9c'
const INK = '#141414'

/** Splits a string into lines that fit `maxWidth`, breaking on spaces. */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''

  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line.length === 0 ? word : `${line} ${word}`
    if (line.length > 0 && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }

  if (line.length > 0) lines.push(line)
  return lines
}

/** Draws the sheet with the 2D canvas API: title, optional summary, footer. */
function drawPage(ctx: CanvasRenderingContext2D, text: PageText, pageKey: string): void {
  const margin = 92
  const contentWidth = TEXTURE_WIDTH - margin * 2

  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT)
  ctx.textBaseline = 'top'
  ctx.fillStyle = INK

  let cursorY = 96

  if (text.label.length > 0) {
    ctx.font = `500 22px ${FONT_STACK}`
    ctx.globalAlpha = 0.62
    ctx.fillText(text.label.toUpperCase(), margin, cursorY)
    ctx.globalAlpha = 1
    cursorY += 52
  }

  if (text.title.length > 0) {
    ctx.font = `700 62px ${FONT_STACK}`
    for (const line of wrapLines(ctx, text.title, contentWidth).slice(0, 3)) {
      ctx.fillText(line, margin, cursorY)
      cursorY += 72
    }
    cursorY += 18

    ctx.strokeStyle = INK
    ctx.globalAlpha = 0.35
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(margin, cursorY)
    ctx.lineTo(TEXTURE_WIDTH - margin, cursorY)
    ctx.stroke()
    ctx.globalAlpha = 1
    cursorY += 46
  }

  if (text.body !== undefined && text.body.length > 0) {
    ctx.font = `400 34px ${FONT_STACK}`
    const maxLines = Math.floor((TEXTURE_HEIGHT - cursorY - 170) / 48)
    for (const line of wrapLines(ctx, text.body, contentWidth).slice(0, maxLines)) {
      ctx.fillText(line, margin, cursorY)
      cursorY += 48
    }
  }

  ctx.fillStyle = INK
  ctx.globalAlpha = 0.5
  ctx.font = `400 18px ${FONT_STACK}`
  ctx.fillText('The Logbook', margin, TEXTURE_HEIGHT - 84)
  ctx.textAlign = 'right'
  ctx.fillText(pageKey, TEXTURE_WIDTH - margin, TEXTURE_HEIGHT - 84)
  ctx.textAlign = 'left'
  ctx.globalAlpha = 1
}

function createPageTexture(side: PageSide, pageKey: string, text: PageText): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = TEXTURE_WIDTH
  canvas.height = TEXTURE_HEIGHT

  const ctx = canvas.getContext('2d')
  if (ctx === null) throw new Error('Page: 2D canvas context unavailable')

  drawPage(ctx, text, pageKey)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  texture.center.set(0.5, 0.5)
  // The left sheet is the right sheet rotated pi about the spine, which turns
  // its printed face 180 degrees in the page plane. Rotating the texture the
  // same way keeps the text upright, the way a verso is printed.
  texture.rotation = side === 'left' ? Math.PI : 0
  return texture
}

export function Page({ side, pageKey, text, y }: PageProps) {
  const texture = useMemo(
    () => createPageTexture(side, pageKey, text),
    [side, pageKey, text],
  )

  // CanvasTexture owns a canvas plus a GPU upload: release both on unmount.
  useEffect(() => () => texture.dispose(), [texture])

  return (
    <group rotation-y={side === 'left' ? Math.PI : 0}>
      <mesh
        position={[PAGE_WIDTH / 2, y, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        // TODO(T7): this mesh becomes the skinned curl mesh. Skinned bounding
        // volumes are computed from the bind pose only, so culling a bent page
        // would pop it out of view. Cheap here (two pages), so already off.
        frustumCulled={false}
      >
        <planeGeometry args={[PAGE_WIDTH, PAGE_HEIGHT]} />
        <meshStandardMaterial map={texture} roughness={0.92} metalness={0} />
      </mesh>
    </group>
  )
}
