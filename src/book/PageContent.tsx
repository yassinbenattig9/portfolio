import type { About, Contact, Project, Site } from '../content/schema'
import type { ContentsEntry, Page, PageKind } from '../content/deriveSpreads'
import type { PageSide } from './pageLookup'

/**
 * The real, readable contents of one page. This is the only copy of a page's
 * text: the static sheet renders it once (`variant="page"`), and the future
 * turning sheet renders the same component as presentation only
 * (`variant="sheet"`: no ids, links are styled spans so nothing is duplicated
 * in the tab order).
 *
 * Data comes in as props; the component reads no store and owns no animation.
 * The side is a CSS concern (gutter, corner radius), the variant is semantics.
 */

export type PageVariant = 'page' | 'sheet'

export interface PageContentProps {
  readonly page: Page
  readonly project?: Project
  readonly side: PageSide
  readonly variant: PageVariant
  /** Contents page data, in book order. */
  readonly contents?: readonly ContentsEntry[]
  readonly about?: About
  /** Contact page data (links and email). */
  readonly contact?: Contact
  readonly site?: Site
  /**
   * Called when a Contents row is activated, with the project's spread index.
   * Only the `page` variant has controls; the sheet variant renders the same
   * rows as inert spans, so a turn's clone can never own a second tab stop.
   */
  readonly onJump?: (spreadIndex: number) => void
}

const EYEBROWS: Readonly<Record<PageKind, string>> = {
  contents: 'Contents',
  about: 'About',
  story: 'Story',
  demo: 'Demo',
  blank: '',
  contact: 'Contact',
}

interface PageLinkProps {
  readonly href: string
  readonly children: string
  readonly variant: PageVariant
  /** Leaves the site: opens a new tab and drops the referrer. */
  readonly external?: boolean
  /** Set when the visible text alone is ambiguous (e.g. "CV (PDF)"). */
  readonly label?: string
}

function PageLink({ href, children, variant, external = false, label }: PageLinkProps) {
  if (variant === 'sheet') {
    // Presentation only: the same look, no href, no tab stop.
    return <span className="page__link">{children}</span>
  }

  return (
    <a
      className="page__link"
      href={href}
      aria-label={label}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer noopener' : undefined}
    >
      {children}
    </a>
  )
}

function titleOf(page: Page, project: Project | undefined): string {
  return project?.title ?? page.key
}

/** What the demo block says while no component or media is registered yet. */
function demoCopy(project: Project | undefined): { label: string; hint?: string } {
  const demo = project?.right.demo
  if (demo === undefined) return { label: 'Demo' }
  if (demo.type === 'media') return { label: 'Demo media — registered in a later phase' }
  return { label: 'Interactive demo — registered in a later phase', hint: demo.id }
}

function ProjectLinks({ project, variant }: { project: Project; variant: PageVariant }) {
  const live = project.links.live
  const repo = project.links.repo
  if (live === null && repo === null) return null

  return (
    <p className="page__links-inline">
      {live === null ? null : (
        <PageLink
          href={live}
          variant={variant}
          external
          label={`${project.title} live site (opens in a new tab)`}
        >
          Live site
        </PageLink>
      )}
      {repo === null ? null : (
        <PageLink
          href={repo}
          variant={variant}
          external
          label={`${project.title} repository (opens in a new tab)`}
        >
          Repository
        </PageLink>
      )}
    </p>
  )
}

export function PageContent({
  page,
  project,
  side,
  variant,
  contents,
  about,
  contact,
  site,
  onJump,
}: PageContentProps) {
  // The sheet variant deliberately sets no ids: it is a second rendering of a
  // page that already has one in the document.
  const titleId = variant === 'page' ? `page-title-${page.key}` : undefined
  // A page heading is a landing point for the turn's focus handoff, not a
  // control: reachable by script, never added to the tab order.
  const titleTabIndex = variant === 'page' ? -1 : undefined

  return (
    <article className={`page__body page__body--${side}`} aria-labelledby={titleId}>
      {EYEBROWS[page.kind].length > 0 ? <p className="page__eyebrow">{EYEBROWS[page.kind]}</p> : null}

      {page.kind === 'contents' ? (
        <>
          <h2 className="page__title" id={titleId} tabIndex={titleTabIndex}>
            Contents
          </h2>
          <ol className="page__contents">
            {(contents ?? []).map((entry) => {
              const row = (
                <>
                  <span className="page__contents-index" aria-hidden="true">
                    {String(entry.spreadIndex).padStart(2, '0')}
                  </span>
                  <span className="page__contents-title">{entry.title}</span>
                  <span className="page__contents-period">{entry.period}</span>
                </>
              )

              // The sheet variant is presentation only: no button, no tab stop.
              // (The turn that a jump starts announces itself in the existing
              // live region, so the row invents no extra announcement.)
              return (
                <li className="page__contents-item" key={entry.projectId}>
                  {variant === 'sheet' ? (
                    <span className="page__contents-row">{row}</span>
                  ) : (
                    <button
                      type="button"
                      className="page__contents-row"
                      onClick={() => onJump?.(entry.spreadIndex)}
                    >
                      {row}
                    </button>
                  )}
                </li>
              )
            })}
          </ol>
        </>
      ) : null}

      {page.kind === 'about' ? (
        <>
          <h2 className="page__title" id={titleId} tabIndex={titleTabIndex}>
            {about?.headline ?? 'About'}
          </h2>
          {about === undefined ? null : <p className="page__text">{about.summary}</p>}
          {about === undefined ? null : (
            <>
              <p className="page__eyebrow page__eyebrow--section">Languages</p>
              <ul className="page__list">
                {about.languages.map((language, index) => (
                  <li key={`${index}:${language}`}>{language}</li>
                ))}
              </ul>
            </>
          )}
        </>
      ) : null}

      {page.kind === 'story' ? (
        <>
          <h2 className="page__title" id={titleId} tabIndex={titleTabIndex}>
            {titleOf(page, project)}
          </h2>
          {project === undefined ? null : (
            <p className="page__meta">
              {project.period} · {project.role}
            </p>
          )}
          {project === undefined ? null : <p className="page__text">{project.summary}</p>}
          {project === undefined ? null : (
            <ul className="page__list">
              {project.highlights.map((highlight, index) => (
                // Placeholder content can repeat a highlight verbatim, so the
                // text alone is not a stable key.
                <li key={`${index}:${highlight}`}>{highlight}</li>
              ))}
            </ul>
          )}
          {project === undefined ? null : (
            <p className="page__stack">{project.stack.join(' · ')}</p>
          )}
          {project === undefined ? null : <ProjectLinks project={project} variant={variant} />}
        </>
      ) : null}

      {page.kind === 'demo' ? (
        <>
          <h2 className="page__title" id={titleId} tabIndex={titleTabIndex}>
            {titleOf(page, project)}
          </h2>
          {project === undefined ? null : <p className="page__meta">{project.period}</p>}
          <div className="page__demo" aria-hidden="true">
            <span className="page__demo-label">{demoCopy(project).label}</span>
            {demoCopy(project).hint === undefined ? null : (
              <span className="page__demo-hint">{demoCopy(project).hint}</span>
            )}
          </div>
          {project === undefined ? null : (
            <p className="page__stack">{project.stack.join(' · ')}</p>
          )}
        </>
      ) : null}

      {page.kind === 'blank' ? (
        <h2 className="page__title visually-hidden" id={titleId} tabIndex={titleTabIndex}>
          Blank page
        </h2>
      ) : null}

      {page.kind === 'contact' ? (
        <>
          <h2 className="page__title" id={titleId} tabIndex={titleTabIndex}>
            Contact
          </h2>
          {site === undefined ? null : (
            <p className="page__meta">
              {site.name} · {site.role}
            </p>
          )}
          {contact === undefined ? null : (
            <ul className="page__links">
              <li>
                <PageLink
                  href={`mailto:${contact.email}`}
                  variant={variant}
                  label={`Email ${site?.name ?? 'me'} at ${contact.email}`}
                >
                  {contact.email}
                </PageLink>
              </li>
              <li>
                <PageLink
                  href={contact.linkedin}
                  variant={variant}
                  external
                  label="LinkedIn (opens in a new tab)"
                >
                  LinkedIn
                </PageLink>
              </li>
              <li>
                <PageLink
                  href={contact.github}
                  variant={variant}
                  external
                  label="GitHub (opens in a new tab)"
                >
                  GitHub
                </PageLink>
              </li>
              {contact.cv ? (
                <li>
                  <PageLink href={contact.cv} variant={variant} label="Download the CV as a PDF">
                    CV (PDF)
                  </PageLink>
                </li>
              ) : null}
            </ul>
          )}
        </>
      ) : null}
    </article>
  )
}
