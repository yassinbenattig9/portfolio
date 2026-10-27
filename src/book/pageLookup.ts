import type { Page, Spread } from '../content/deriveSpreads'
import type { Portfolio, Project } from '../content/schema'

/**
 * Turns a `(spread, side)` reference into the page that sits there.
 *
 * This replaces the private `faceFor` that used to live inside the R3F
 * `TurnLayer`: the CSS-3D book, the future turning sheet and any lookup in
 * tests all resolve a slot the same way, including the out-of-range rule
 * (`null`, never a made-up page).
 *
 * The returned `key` is the slot identity (spread index + side), not the
 * content key: the same placeholder page can be reused, but two slots can
 * never share a DOM key.
 */

export type PageSide = 'left' | 'right'

/** One side of one spread. `spread` indexes the derived spreads. */
export interface PageRef {
  readonly spread: number
  readonly side: PageSide
}

export interface PageLookup {
  readonly page: Page
  /** Resolved only when a project map is supplied and the page has a project. */
  readonly project?: Project
  readonly side: PageSide
  /** Stable, slot-unique DOM key: `"<spread>.<side>"`. */
  readonly key: string
}

/**
 * The page at `ref`, or `null` for an out-of-range reference.
 *
 * `projects` is optional so the function stays usable without content (tests,
 * the future sheet); project pages then come back without `project`.
 */
export function pageFor(
  spreads: readonly Spread[],
  ref: PageRef,
  projects?: ReadonlyMap<string, Project>,
): PageLookup | null {
  const spread = spreads[ref.spread]
  if (spread === undefined) return null

  const page = ref.side === 'left' ? spread.left : spread.right
  const project = page.projectId === undefined ? undefined : projects?.get(page.projectId)

  return {
    page,
    ...(project === undefined ? {} : { project }),
    side: ref.side,
    key: `${spread.index}.${ref.side}`,
  }
}

/** Index projects by id once, for every slot lookup in the book. */
export function projectMap(content: Portfolio): ReadonlyMap<string, Project> {
  return new Map(content.projects.map((project) => [project.id, project]))
}

/** A readable spread name, used by the live region and by the page eyebrow. */
export function spreadLabel(spread: Spread, projects?: ReadonlyMap<string, Project>): string {
  switch (spread.kind) {
    case 'contents':
      return 'Contents'
    case 'closing':
      return 'Contact'
    case 'project': {
      if (spread.projectId === undefined) return 'Project'
      return projects?.get(spread.projectId)?.title ?? spread.projectId
    }
  }
}
