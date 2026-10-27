import { useMemo } from 'react'
import { deriveContents, type Spread } from '../content/deriveSpreads'
import type { Portfolio } from '../content/schema'
import { useBookStore } from '../state/bookState'
import { pageFor, projectMap } from './pageLookup'
import { StaticPage } from './StaticPage'

/**
 * The book itself: back board, page block, the two static pages and the cover.
 *
 * The two pages are rendered side by side, not mirrored. Each is hinged on the
 * spine (`transform-origin` in `book.css`), so the future turning sheet's verso
 * can be authored in right-page space and rotated 180 degrees, which is the
 * only surface that needs mirroring.
 *
 * The cover is a real button while the book is closed and a plain surface once
 * it opens; that is the only interactive element the book owns today (page
 * turns arrive in a later task). `BookStage` owns the element that writes
 * `--open`; this component only reads `phase` from the store.
 */

export interface BookProps {
  readonly spreads: readonly Spread[]
  readonly content: Portfolio
}

interface CoverProps {
  readonly closed: boolean
  readonly site: Portfolio['site']
  readonly onOpen: () => void
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

export function Book({ spreads, content }: BookProps) {
  const phase = useBookStore((state) => state.phase)
  const spreadIndex = useBookStore((state) => state.spread)
  const openBook = useBookStore((state) => state.openBook)

  const projects = useMemo(() => projectMap(content), [content])
  const contents = useMemo(() => deriveContents(content, spreads), [content, spreads])

  const index = Math.max(0, Math.min(spreadIndex, spreads.length - 1))
  const left = pageFor(spreads, { spread: index, side: 'left' }, projects)
  const right = pageFor(spreads, { spread: index, side: 'right' }, projects)

  const closed = phase === 'CLOSED'

  const pageProps = {
    inert: closed,
    contents,
    about: content.about,
    contact: content.contact,
    site: content.site,
  }

  return (
    <>
      <div className="book__board" aria-hidden="true" />
      <div className="book__block" aria-hidden="true" />

      {left === null ? null : (
        <StaticPage
          key={left.key}
          page={left.page}
          project={left.project}
          side="left"
          {...pageProps}
        />
      )}

      {right === null ? null : (
        <StaticPage
          key={right.key}
          page={right.page}
          project={right.project}
          side="right"
          {...pageProps}
        />
      )}

      <Cover closed={closed} site={content.site} onOpen={openBook} />
    </>
  )
}
