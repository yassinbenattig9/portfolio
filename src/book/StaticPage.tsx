import type { About, Contact, Project, Site } from '../content/schema'
import type { ContentsEntry, Page } from '../content/deriveSpreads'
import { PageContent } from './PageContent'
import type { PageLookup, PageSide } from './pageLookup'

/**
 * The keyframe `book.css` plays on the incoming single page. `SinglePage`
 * waits for its `animationend` to drop the outgoing layer, so the name here
 * and the `@keyframes` rule in `book.css` must stay the same string.
 */
const PAGE_IN_ANIMATION = 'page-in'

/**
 * The paper of the book, in both layouts.
 *
 * `StaticPage` is one page of the open spread: a 3D plane hinged on the spine
 * (the hinge lives in `book.css`), so the future turning sheet can be authored
 * in the same space without mirroring the static pages.
 *
 * `SinglePage` is the whole page on a narrow screen (plan §5.5): one page at a
 * time, full width. A page change fades the incoming page in over the outgoing
 * one; the outgoing page is presentation only (`variant="sheet"`: no ids, no
 * links, no tab stops) and is inert, so only the visible page is reachable.
 *
 * While the book is closed both carry `inert` and `aria-hidden`: the cover
 * button and the chrome are the only reachable things, and screen readers are
 * not offered page text that is physically under the cover.
 */

export interface StaticPageProps {
  readonly page: Page
  readonly project?: Project
  readonly side: PageSide
  /** Slot identity (`"<spread>.<side>"`), used to park focus for a turn. */
  readonly slot: string
  readonly inert: boolean
  readonly contents?: readonly ContentsEntry[]
  readonly about?: About
  readonly contact?: Contact
  readonly site?: Site
}

/** Page data every page renderer needs; kept in one shape for both layouts. */
export interface PageDataProps {
  readonly contents?: readonly ContentsEntry[]
  readonly about?: About
  readonly contact?: Contact
  readonly site?: Site
}

export function StaticPage({
  page,
  project,
  side,
  slot,
  inert,
  contents,
  about,
  contact,
  site,
}: StaticPageProps) {
  return (
    <div
      className={`book__page book__page--${side}`}
      data-page={page.key}
      data-slot={slot}
      inert={inert}
      aria-hidden={inert ? true : undefined}
    >
      <PageContent
        page={page}
        project={project}
        side={side}
        variant="page"
        contents={contents}
        about={about}
        contact={contact}
        site={site}
      />
    </div>
  )
}

export interface SinglePageProps extends PageDataProps {
  /** The page being read. Its heading is the focus landing point. */
  readonly current: PageLookup
  /** The page being crossfaded away from, or `null` at rest. */
  readonly previous: PageLookup | null
  readonly inert: boolean
  /** Called when the incoming page's fade has finished, to drop `previous`. */
  readonly onSettled?: () => void
}

export function SinglePage({
  current,
  previous,
  inert,
  onSettled,
  contents,
  about,
  contact,
  site,
}: SinglePageProps) {
  return (
    <div
      className="book__page book__page--single"
      data-page={current.page.key}
      data-slot={current.key}
      inert={inert}
      aria-hidden={inert ? true : undefined}
    >
      {previous === null ? null : (
        <div className="page__layer page__layer--outgoing" aria-hidden="true" inert>
          <PageContent
            page={previous.page}
            project={previous.project}
            side={previous.side}
            variant="sheet"
            contents={contents}
            about={about}
            contact={contact}
            site={site}
          />
        </div>
      )}

      <div
        className="page__layer page__layer--current"
        key={current.key}
        onAnimationEnd={(event) => {
          // Bubbling child animations (none today) must not end the fade early.
          if (event.target !== event.currentTarget) return
          if (event.animationName !== PAGE_IN_ANIMATION) return
          onSettled?.()
        }}
      >
        <PageContent
          page={current.page}
          project={current.project}
          side={current.side}
          variant="page"
          contents={contents}
          about={about}
          contact={contact}
          site={site}
        />
      </div>
    </div>
  )
}
