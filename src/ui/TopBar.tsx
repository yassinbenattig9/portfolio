import type { Contact, Site } from '../content/schema'
import { PlainLink } from './PlainLink'

/**
 * The 2D chrome above the scene (plan §5.3): wordmark on the left, "Plain
 * version" and the "Get in touch" pill on the right.
 *
 * It is a fixed overlay that ignores the pointer everywhere except on its two
 * interactive elements, so the canvas underneath stays clickable for the book.
 */

export interface TopBarProps {
  readonly site: Site
  readonly contact: Contact
}

export function TopBar({ site, contact }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar__brand">
        {/* TODO(Phase 2): the arch-seal SVG replaces this monogram slot. */}
        <span className="topbar__mark" aria-hidden="true">
          {site.name.slice(0, 1)}
        </span>
        <span className="topbar__name">{site.name}</span>
        <span className="topbar__role">{site.role}</span>
      </div>

      <nav className="topbar__actions" aria-label="Site">
        {/* Phase 3: the build script generates /plain.html inside dist/ from
            src/content/portfolio.json. Dev note: `npm run dev` has no dist/,
            so this link 404s until `npm run build` runs once. */}
        <PlainLink
          href="/plain.html"
          label="Plain version: the same portfolio as a fast HTML page"
        >
          Plain version
        </PlainLink>
        <a
          className="ui-pill"
          href={`mailto:${contact.email}`}
          aria-label={`Get in touch by email at ${contact.email}`}
        >
          Get in touch
        </a>
      </nav>
    </header>
  )
}
