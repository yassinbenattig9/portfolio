import { describe, expect, it } from 'vitest'
import { restFaces, turnFaces, type PageRef } from './turnFaces.ts'

const page = (spread: number, side: 'left' | 'right'): PageRef => ({ spread, side })

/** The four slots as a set of `spread:side` keys, for double-draw checks. */
const slotKeys = (faces: {
  staticLeft: PageRef
  staticRight: PageRef
  recto: PageRef
  verso: PageRef
}): string[] =>
  [faces.staticLeft, faces.staticRight, faces.recto, faces.verso].map(
    (face) => `${face.spread}:${face.side}`,
  )

describe('turn face table', () => {
  it('forward (+1) keeps from.left and to.right static, puts from.right on the recto and to.left on the verso', () => {
    expect(turnFaces(4, 5, 1)).toEqual({
      staticLeft: page(4, 'left'),
      staticRight: page(5, 'right'),
      recto: page(4, 'right'),
      verso: page(5, 'left'),
    })
  })

  it('backward (-1) keeps to.left and from.right static, puts to.right on the recto and from.left on the verso', () => {
    expect(turnFaces(5, 4, -1)).toEqual({
      staticLeft: page(4, 'left'),
      staticRight: page(5, 'right'),
      recto: page(4, 'right'),
      verso: page(5, 'left'),
    })
  })

  it('is not accidentally the same mapping for both directions', () => {
    const forward = turnFaces(4, 5, 1)
    const backward = turnFaces(4, 5, -1)

    expect(backward).not.toEqual(forward)
    expect(backward.staticLeft).toEqual(page(5, 'left'))
    expect(backward.staticRight).toEqual(page(4, 'right'))
    expect(backward.recto).toEqual(page(5, 'right'))
    expect(backward.verso).toEqual(page(4, 'left'))
  })

  it('a return trip (to -> from, dir -1) shows the same four pages as the forward trip', () => {
    // The sheet is the same physical page: only the reading direction differs.
    expect(turnFaces(5, 4, -1)).toEqual(turnFaces(4, 5, 1))
  })
})

describe('endpoint invariants', () => {
  it('forward: the recto is the page the sheet rests on and the verso the page it lands on', () => {
    const from = 3
    const to = 4
    const faces = turnFaces(from, to, 1)

    // p = 0: sheet flat on the right of `from`.
    expect(faces.recto).toEqual(restFaces(from).staticRight)
    // p = 1: sheet flat on the left of `to`.
    expect(faces.verso).toEqual(restFaces(to).staticLeft)
  })

  it('backward: p runs backwards, so the recto is the landing page on the right and the verso the page it left on the left', () => {
    const from = 3
    const to = 2
    const faces = turnFaces(from, to, -1)

    // A backward turn renders curl p = 1 - progress: at p = 0 the sheet has
    // landed on the right of `to`; at p = 1 it is still on the left of `from`.
    expect(faces.recto).toEqual(restFaces(to).staticRight)
    expect(faces.verso).toEqual(restFaces(from).staticLeft)
  })

  it('covers each end of the turn with the static page it replaces', () => {
    const from = 3
    const to = 4

    const forward = turnFaces(from, to, 1)
    expect(forward.staticRight, 'forward start').toEqual(restFaces(to).staticRight)
    expect(forward.staticLeft, 'forward end').toEqual(restFaces(from).staticLeft)

    const backward = turnFaces(from, to, -1)
    expect(backward.staticRight, 'backward end').toEqual(restFaces(from).staticRight)
    expect(backward.staticLeft, 'backward start').toEqual(restFaces(to).staticLeft)
  })
})

describe('no page is drawn twice', () => {
  it('assigns four distinct spread/side slots for a forward turn', () => {
    expect(new Set(slotKeys(turnFaces(4, 5, 1))).size).toBe(4)
  })

  it('assigns four distinct spread/side slots for a backward turn', () => {
    expect(new Set(slotKeys(turnFaces(5, 4, -1))).size).toBe(4)
  })

  it('never pairs the recto with the static page on the same side', () => {
    const forward = turnFaces(4, 5, 1)
    // staticLeft and recto come from `from`, but they are the two faces of the
    // spread, so the same page cannot be drawn underneath and on the sheet.
    expect(forward.staticLeft.spread).toBe(forward.recto.spread)
    expect(forward.staticLeft.side).not.toBe(forward.recto.side)
    expect(forward.staticLeft).not.toEqual(forward.recto)

    const backward = turnFaces(5, 4, -1)
    // On a backward turn the recto is the landing page (to.right), so the
    // static page sharing its spread is to.left.
    expect(backward.staticLeft.spread).toBe(backward.recto.spread)
    expect(backward.staticLeft.side).not.toBe(backward.recto.side)
    expect(backward.staticLeft).not.toEqual(backward.recto)
  })
})

describe('out-of-range spread indices', () => {
  // NOTE: the brief expected a guard here that returns no faces. `turnFaces`
  // has no such guard: it is index-agnostic and always returns four refs. The
  // "no faces" resolution happens downstream in `TurnLayer.faceFor`, which
  // returns null when `spreads[ref.spread]` is undefined. These tests pin the
  // helper's actual behaviour so any added guard is a visible decision.
  it('passes negative and oversized indices through unchanged instead of returning undefined', () => {
    for (const [from, to] of [
      [-1, 0],
      [7, 99],
      [Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER],
    ] as const) {
      for (const dir of [1, -1] as const) {
        const faces = turnFaces(from, to, dir)
        for (const face of Object.values(faces)) {
          expect(face, `from=${from} to=${to} dir=${dir}`).toBeDefined()
          expect(Number.isInteger(face.spread)).toBe(true)
        }
        expect(faces.staticLeft.spread, `dir=${dir}`).toBe(dir === 1 ? from : to)
        expect(faces.staticRight.spread, `dir=${dir}`).toBe(dir === 1 ? to : from)
        expect(faces.recto.spread, `dir=${dir}`).toBe(dir === 1 ? from : to)
        expect(faces.verso.spread, `dir=${dir}`).toBe(dir === 1 ? to : from)
      }
    }
  })

  it('restFaces also keeps an out-of-range index rather than inventing a page', () => {
    const faces = restFaces(-3)
    expect(faces).toEqual({
      staticLeft: page(-3, 'left'),
      staticRight: page(-3, 'right'),
      recto: page(-3, 'right'),
      verso: page(-3, 'left'),
    })
  })
})

describe('restFaces', () => {
  it('binds the recto to the same page as staticRight', () => {
    for (const spread of [0, 1, 42]) {
      const faces = restFaces(spread)
      expect(faces.staticRight, `spread=${spread}`).toEqual(page(spread, 'right'))
      expect(faces.recto, `spread=${spread}`).toEqual(faces.staticRight)
    }
  })

  it('binds the verso to the same page as staticLeft', () => {
    for (const spread of [0, 1, 42]) {
      const faces = restFaces(spread)
      expect(faces.staticLeft, `spread=${spread}`).toEqual(page(spread, 'left'))
      expect(faces.verso, `spread=${spread}`).toEqual(faces.staticLeft)
    }
  })

  it('does not bind the left and right pages of a spread to each other', () => {
    const faces = restFaces(2)
    expect(faces.staticLeft).not.toEqual(faces.staticRight)
    expect(new Set(slotKeys(faces)).size).toBe(2)
  })
})
