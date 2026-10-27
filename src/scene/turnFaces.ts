/**
 * Which page sits in each of the four slots a page turn puts on screen.
 *
 * Pure: no React, no three.js, no store. `TurnLayer` renders what this returns,
 * so the rule that used to live inside that component can be unit-tested.
 *
 * One sheet always covers the spine, so a turn from spread `from` to spread
 * `to` needs four pages (the table in `TurnLayer.tsx`, encoded here):
 *
 * | dir | static left | static right | recto (front) | verso (back) |
 * |-----|-------------|--------------|---------------|--------------|
 * | +1  | from.left   | to.right     | from.right    | to.left      |
 * | -1  | to.left     | from.right   | to.right      | from.left    |
 *
 * `recto` is the face that is up while the sheet lies on the right, `verso` the
 * face that is up once it lies on the left. A forward turn runs recto -> verso
 * (it lifts the right page and lands it on the left); a backward turn is the
 * same pose read from the other end, which is why its recto is the page it
 * lands on and its verso the page it starts from.
 *
 * Invariant: the face that is up is always the page in the slot the sheet lies
 * in. With `p` the curl parameter the renderer poses (0 = sheet flat on the
 * right, 1 = flat on the left) the recto shows at `p = 0` and the verso at
 * `p = 1`. Forward `p` equals the turn progress, so the recto is the page the
 * sheet rests on at `p = 0` and the verso the page it lands on at `p = 1`.
 * Backward `p = 1 - progress`, so the sheet rests on its verso and lands on
 * its recto. In both cases each static page is only replaced while the sheet
 * is flat on top of it: at the start of the turn the slot the sheet occupies
 * already holds the destination's page (hidden underneath), and the far slot
 * still holds the origin's page, which the sheet covers just before the commit
 * that swaps it.
 */

/** A single page of a spread. `spread` is an index into the derived spreads. */
export interface PageRef {
  readonly spread: number
  readonly side: 'left' | 'right'
}

/** The four pages a turning sheet needs: the two static sides and its faces. */
export interface TurnFaces {
  /** Page that stays on the resting left side while the sheet is away from it. */
  readonly staticLeft: PageRef
  /** Page that stays on the resting right side while the sheet is away from it. */
  readonly staticRight: PageRef
  /** Face up at `p = 0`, while the sheet lies on the right. */
  readonly recto: PageRef
  /** Face up at `p = 1`, once the sheet has landed on the left. */
  readonly verso: PageRef
}

function left(spread: number): PageRef {
  return { spread, side: 'left' }
}

function right(spread: number): PageRef {
  return { spread, side: 'right' }
}

/**
 * The four pages of a turn from spread `from` to spread `to`, in direction
 * `dir` (+1 forward, -1 backward). See the invariant above; the mapping is
 * pinned by tests.
 */
export function turnFaces(from: number, to: number, dir: 1 | -1): TurnFaces {
  if (dir === 1) {
    return {
      staticLeft: left(from),
      staticRight: right(to),
      recto: right(from),
      verso: left(to),
    }
  }

  return {
    staticLeft: left(to),
    staticRight: right(from),
    recto: right(to),
    verso: left(from),
  }
}

/**
 * The flat book: both static sides show `spread`, and the hidden sheet is
 * pre-bound to that spread's two pages so the first frame of a turn is already
 * the right content. Same shape as `turnFaces`, no turn involved.
 */
export function restFaces(spread: number): TurnFaces {
  return {
    staticLeft: left(spread),
    staticRight: right(spread),
    recto: right(spread),
    verso: left(spread),
  }
}
