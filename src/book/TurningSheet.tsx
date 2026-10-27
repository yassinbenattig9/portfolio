import type { CSSProperties, Ref } from 'react'
import type { ContentsEntry } from '../content/deriveSpreads'
import type { About, Contact, Site } from '../content/schema'
import type { TurnDir } from '../state/bookState'
import { CURL_AMPLITUDE, STRIP_COUNT, shadeWeights, stripWeights } from './curlShape'
import { useReducedMotion } from './motion'
import { PageContent } from './PageContent'
import type { PageLookup } from './pageLookup'

/**
 * The turning sheet: the page that lifts off one side and lands on the other.
 *
 * Shape (one face shown, the other is the same chain flipped):
 *
 *   .sheet                      left half, hinged on the spine, `--t` drives
 *     .sheet__face--recto       opaque paper, `backface-visibility: hidden`
 *       .strip (i = 0)          hinged on its own left edge
 *         .strip__clip          the only clipping element
 *           .strip__content     full page clone, shifted by i * pageWidth/12
 *           .strip__shade       white -> ink veil, one per strip
 *         .strip (i = 1)        sibling of the clip: rotations accumulate
 *
 * Each strip is nested at the right edge of the previous one, so strip i's
 * rotation applies to its own slice and to every slice after it. That is the
 * whole bend: twelve hinges, `--w` weights from `curlShape`, one `--t` on the
 * sheet root per frame. The sheet root only ever rotates 0 -> -180deg; a
 * backward turn is that pose read backwards (`frameStep` returns `1 - eased`),
 * never a mirrored origin or a positive rotation.
 *
 * The verso face is authored in right-page space and rotated 180deg, so it
 * reads upright once the sheet lands on the left. Both faces carry an opaque
 * paper background and hide their backface: only one side is ever painted.
 *
 * Reduced motion (and no freeze) replaces all of this with a flat crossfade of
 * the two spreads. A freeze keeps the strips, because a frozen still exists to
 * be inspected.
 *
 * Presentation only: the root is `aria-hidden` and `inert`, and every page is
 * rendered with `PageContent variant="sheet"` (no ids, links are spans).
 */

const WEIGHTS = stripWeights()
const SHADES = shadeWeights()

/** `CURL_AMPLITUDE` (1.05 rad) as a CSS angle, so the bend has one source. */
const CURL_DEG = `${((CURL_AMPLITUDE * 180) / Math.PI).toFixed(3)}deg`

/** Custom properties are legal on a style object but missing from `CSSProperties`. */
interface CSSVars extends CSSProperties {
  readonly [key: `--${string}`]: string | number
}

export interface SheetPageData {
  readonly contents: readonly ContentsEntry[]
  readonly about: About
  readonly contact: Contact
  readonly site: Site
}

export interface TurningSheetProps extends SheetPageData {
  /** Face up at `t = 0`, while the sheet lies on the right. */
  readonly recto: PageLookup
  /** Face up at `t = 1`, once the sheet has landed on the left. */
  readonly verso: PageLookup
  /** Page resting on the left while the sheet is away from it. */
  readonly staticLeft: PageLookup
  /** Page resting on the right while the sheet is away from it. */
  readonly staticRight: PageLookup
  readonly dir: TurnDir
  /**
   * Pinned sheet position for the freeze harness (`0..1`). `null` while the
   * rAF loop owns `--t`; a number makes this component a still.
   */
  readonly turn: number | null
  /** Set by `BookStage`; the loop writes `--t` on this element, once per frame. */
  readonly sheetRef?: Ref<HTMLDivElement>
}

interface StripChainProps extends SheetPageData {
  readonly lookup: PageLookup
  readonly index: number
  readonly face: 'recto' | 'verso'
}

function StripChain({ lookup, index, face, ...data }: StripChainProps) {
  const last = index === STRIP_COUNT - 1
  // The fore edge is the local right on the recto and the local left on the
  // verso, because the verso is the same chain rotated 180deg.
  const fore = face === 'recto' ? last : index === 0

  const style: CSSVars = {
    '--w': WEIGHTS[index] ?? 0,
    '--s': SHADES[index] ?? 0,
    '--i': index,
  }
  const contentStyle: CSSVars = { '--i': index }

  return (
    <div
      className="strip"
      data-strip={index}
      data-edge={fore ? 'fore' : undefined}
      style={style}
    >
      <div className="strip__clip">
        <div className="strip__content" style={contentStyle}>
          <PageContent
            page={lookup.page}
            project={lookup.project}
            side={lookup.side}
            variant="sheet"
            {...data}
          />
        </div>
        <span className="strip__shade" aria-hidden="true" />
      </div>
      {last ? null : <StripChain lookup={lookup} index={index + 1} face={face} {...data} />}
    </div>
  )
}

interface FlatSlotProps extends SheetPageData {
  readonly lookup: PageLookup
  readonly layer: 'in' | 'out'
}

function FlatSlot({ lookup, layer, ...data }: FlatSlotProps) {
  return (
    <div className={`book__page book__page--${lookup.side} sheet__slot sheet__slot--${layer}`}>
      <PageContent
        page={lookup.page}
        project={lookup.project}
        side={lookup.side}
        variant="sheet"
        {...data}
      />
    </div>
  )
}

export function TurningSheet({
  recto,
  verso,
  staticLeft,
  staticRight,
  dir,
  turn,
  sheetRef,
  ...data
}: TurningSheetProps) {
  const reduced = useReducedMotion()
  const frozen = turn !== null
  const flat = reduced && !frozen

  // `--t` starts at the pose the sheet is in on its first paint: flat on the
  // right for a forward turn, flat on the left for a backward one. The loop
  // overwrites it every frame; a frozen sheet keeps this exact value.
  const style: CSSVars = { '--t': turn ?? (dir === 1 ? 0 : 1), '--curl': CURL_DEG }

  if (flat) {
    // Reduced motion: the two spreads, crossfading in place. The outgoing
    // layers are the pages of the spread being left, the opaque layers are the
    // spread being turned to, so the commit swaps to identical pixels.
    const from =
      dir === 1 ? { left: staticLeft, right: recto } : { left: verso, right: staticRight }
    const to = dir === 1 ? { left: verso, right: staticRight } : { left: staticLeft, right: recto }

    return (
      <div
        className="sheet sheet--flat"
        data-dir={dir}
        style={style}
        ref={sheetRef}
        aria-hidden="true"
        inert
      >
        <FlatSlot lookup={to.left} layer="in" {...data} />
        <FlatSlot lookup={to.right} layer="in" {...data} />
        <FlatSlot lookup={from.left} layer="out" {...data} />
        <FlatSlot lookup={from.right} layer="out" {...data} />
      </div>
    )
  }

  return (
    <div
      className={frozen ? 'sheet sheet--frozen' : 'sheet'}
      style={style}
      ref={sheetRef}
      aria-hidden="true"
      inert
    >
      <span className="sheet__sheen" aria-hidden="true" />
      <div className="sheet__face sheet__face--recto">
        <StripChain lookup={recto} index={0} face="recto" {...data} />
      </div>
      <div className="sheet__face sheet__face--verso">
        <StripChain lookup={verso} index={0} face="verso" {...data} />
      </div>
    </div>
  )
}
