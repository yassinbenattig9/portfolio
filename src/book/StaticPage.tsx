import type { About, Contact, Project, Site } from '../content/schema'
import type { ContentsEntry, Page } from '../content/deriveSpreads'
import { PageContent } from './PageContent'
import type { PageSide } from './pageLookup'

/**
 * One static page of the spread: the paper surface plus its position.
 *
 * The wrapper is a 3D plane hinged on the spine (`transform-origin` on the
 * inner edge in `book.css`), so the future turning sheet can be authored in
 * the same space without mirroring the static pages.
 *
 * While the book is closed both pages carry `inert` and `aria-hidden`: the
 * cover button and the chrome are the only reachable things, and screen
 * readers are not offered page text that is physically under the cover.
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
