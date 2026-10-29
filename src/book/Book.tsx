import { useMemo, useCallback, type RefObject } from 'react'
import { deriveContents, type Spread } from '../content/deriveSpreads'
import type { Portfolio } from '../content/schema'
import { getFreeze } from '../dev/freeze'
import { useBookStore, type TurnDir } from '../state/bookState'
import { pageFor, projectMap, type PageLookup } from './pageLookup'
import { frozenSheet } from './sheetPose'
import { SinglePage, StaticPage } from './StaticPage'
import { TurningSheet } from './TurningSheet'
import { turnFaces, type TurnFaces } from './turnFaces'

/**
 * The book itself: back board, page block, the two static pages, the turning
 * sheet and the cover.
 *
 * The two static pages are rendered side by side, not mirrored. Each is hinged
 * on the spine (`transform-origin` in `book.css`), so the turning sheet's verso
 * can be authored in right-page space and rotated 180 degrees, which is the
 * only surface that needs mirroring.
 *
 * While a turn runs, the static pages come from `turnFaces`: the slot the sheet
 * covers already holds the destination page underneath, and the far slot still
 * holds the origin page the sheet has just left. That is what makes the commit
 * invisible — unmounting the sheet reveals the page it was already covering.
 *
 * The cover is a real button while the book is closed and a plain surface once
 * it opens; that is the only interactive element the book owns. `BookStage`
 * owns the element that writes `--open` and `--t`; this component only reads
 * the store and the freeze flag.
 */

export interface BookProps {
  readonly spreads: readonly Spread[]
  readonly content: Portfolio
  /** The turn loop writes `--t` here; the sheet itself never animates. */
  readonly sheetRef?: RefObject<HTMLDivElement | null>
  /**
   * `spread` (default) shows the open pair and the turning sheet. `single`
   * (narrow screens) shows one page and no sheet: the crossfade replaces the
   * turn, and the store is not asked for faces.
   */
  readonly layout?: 'spread' | 'single'
  /** The page to show in `single` layout. */
  readonly single?: PageLookup | null
  /** The page crossfading out in `single` layout, if any. */
  readonly previous?: PageLookup | null
  /** Fired when a single-page crossfade has finished. */
  readonly onSettled?: () => void
}

interface CoverProps {
  readonly closed: boolean
  readonly site: Portfolio['site']
  readonly onOpen: () => void
}

interface ResolvedFaces {
  readonly recto: PageLookup
  readonly verso: PageLookup
  readonly staticLeft: PageLookup
  readonly staticRight: PageLookup
}

function resolveFaces(
  spreads: readonly Spread[],
  faces: TurnFaces,
  projects: ReadonlyMap<string, Portfolio['projects'][number]>,
): ResolvedFaces | null {
  const recto = pageFor(spreads, faces.recto, projects)
  const verso = pageFor(spreads, faces.verso, projects)
  const staticLeft = pageFor(spreads, faces.staticLeft, projects)
  const staticRight = pageFor(spreads, faces.staticRight, projects)

  if (recto === null || verso === null || staticLeft === null || staticRight === null) return null
  return { recto, verso, staticLeft, staticRight }
}

function Cover({ closed, site, onOpen }: CoverProps) {
  const faces = (
    <>
      <span className="book__cover-face book__cover-face--front">
        <span className="book__cover-name">{site.name}</span>
        <span className="book__cover-role">{site.role}</span>
        <span className="book__cover-action" aria-hidden="true">
          Open the logbook
        </span>
      </span>
      <span className="book__cover-face book__cover-face--back" aria-hidden="true">
        <span className="book__cover-back-title">The Logbook</span>
      </span>
    </>
  )

  if (closed) {
    return (
      <button
        type="button"
        className="book__cover"
        data-cover="closed"
        aria-label="Open the logbook"
        onClick={() => onOpen()}
      >
        {faces}
      </button>
    )
  }

  return (
    <div className="book__cover" data-cover="open" aria-hidden="true">
      {faces}
    </div>
  )
}

export function Book({
  spreads,
  content,
  sheetRef,
  layout = 'spread',
  single = null,
  previous = null,
  onSettled,
}: BookProps) {
  const phase = useBookStore((state) => state.phase)
  const spreadIndex = useBookStore((state) => state.spread)
  const turn = useBookStore((state) => state.turn)
  const openBook = useBookStore((state) => state.openBook)

  const projects = useMemo(() => projectMap(content), [content])
  const contents = useMemo(() => deriveContents(content, spreads), [content, spreads])
  // Parsed once per page load, and only ever read: the freeze harness is a
  // still, so it must not dispatch or commit anything.
  const freeze = useMemo(() => getFreeze(), [])

  const index = Math.max(0, Math.min(spreadIndex, spreads.length - 1))

  const inTurn = phase === 'TURNING' && turn !== null
  const frozen = inTurn || phase !== 'OPEN' ? null : frozenSheet(freeze, index, spreads.length)

  const faces: TurnFaces | null = inTurn
    ? turnFaces(turn.from, turn.to, turn.dir)
    : (frozen?.faces ?? null)
  const dir: TurnDir = inTurn ? turn.dir : (frozen?.dir ?? 1)
  const pinned = inTurn ? null : (frozen?.turn ?? null)

  const left = pageFor(spreads, faces?.staticLeft ?? { spread: index, side: 'left' }, projects)
  const right = pageFor(spreads, faces?.staticRight ?? { spread: index, side: 'right' }, projects)
  const sheet = faces === null ? null : resolveFaces(spreads, faces, projects)

  const closed = phase === 'CLOSED'

  const pageData = {
    contents,
    about: content.about,
    contact: content.contact,
    site: content.site,
    // A Contents row turns the book: the store's guards apply as usual, so a
    // row can only start a turn while the book is OPEN.
    onJump: useCallback((spread: number) => {
      useBookStore.getState().jump(spread)
    }, []),
  }
  const pageProps = { ...pageData, inert: closed }

  // One mount per turn: the sheet's opening pose lives in its inline `--t`, so
  // reusing the element across turns would carry a stale pose for a frame.
  const sheetKey = inTurn
    ? `turn:${turn.from}:${turn.to}`
    : `freeze:${frozen?.faces.recto.spread ?? 0}:${dir}:${pinned ?? 0}`

  return (
    <>
      <div className="book__contact" aria-hidden="true" />
      <div className="book__board" aria-hidden="true" />
      <div className="book__block" aria-hidden="true" />

      {layout === 'single' ? (
        // One page, full width, no sheet: the crossfade is the turn here.
        // Everything below (left/right faces, the sheet) is spread geometry.
        single === null ? null : (
          <SinglePage
            current={single}
            previous={previous}
            inert={closed}
            onSettled={onSettled}
            {...pageData}
          />
        )
      ) : (
        <>
          {left === null ? null : (
            <StaticPage
              key={left.key}
              slot={left.key}
              page={left.page}
              project={left.project}
              side="left"
              {...pageProps}
            />
          )}

          {right === null ? null : (
            <StaticPage
              key={right.key}
              slot={right.key}
              page={right.page}
              project={right.project}
              side="right"
              {...pageProps}
            />
          )}

          {sheet === null ? null : (
            <TurningSheet
              key={sheetKey}
              recto={sheet.recto}
              verso={sheet.verso}
              staticLeft={sheet.staticLeft}
              staticRight={sheet.staticRight}
              dir={dir}
              turn={pinned}
              sheetRef={sheetRef}
              {...pageData}
            />
          )}
        </>
      )}

      <Cover closed={closed} site={content.site} onOpen={openBook} />
    </>
  )
}
