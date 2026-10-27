import type { Contact, Site } from '../content/schema'
import { PlainLink } from './PlainLink'

/**
 * The WebGL guard (plan §7.7, "fallback to the plain version if WebGL is
 * unavailable"). No book, no CSS-3D attempt, no second renderer: just the
 * essentials a recruiter needs, in plain HTML.
 */

/**
 * True when this browser can create a WebGL context.
 *
 * The probe canvas is never attached to the document and is released at once
 * (`WEBGL_lose_context` plus a zero size), because browsers cap live contexts
 * and a leaked probe would count against the real scene.
 */
export function detectWebGL(): boolean {
  if (typeof document === 'undefined') return false

  const canvas = document.createElement('canvas')
  try {
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    if (context === null) return false
    context.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    // Some locked-down browsers throw instead of returning null.
    return false
  } finally {
    canvas.width = 0
    canvas.height = 0
  }
}

export interface NoWebGLProps {
  readonly site: Site
  readonly contact: Contact
}

export function NoWebGL({ site, contact }: NoWebGLProps) {
  return (
    <section className="nowebgl" aria-labelledby="nowebgl-name">
      <p className="nowebgl__eyebrow">The Logbook</p>
      <h2 className="nowebgl__name" id="nowebgl-name">
        {site.name}
      </h2>
      <p className="nowebgl__role">{site.role}</p>

      <p className="nowebgl__message">
        This browser cannot draw the 3D book, because WebGL is turned off or unsupported. The
        notebook stays closed, but nothing is lost: the same content is a message or a click away.
      </p>

      <ul className="nowebgl__links">
        <li>
          <PlainLink href={`mailto:${contact.email}`} label={`Email ${site.name} at ${contact.email}`}>
            {contact.email}
          </PlainLink>
        </li>
        <li>
          <PlainLink
            href={contact.linkedin}
            label={`${site.name} on LinkedIn (opens in a new tab)`}
            external
          >
            LinkedIn
          </PlainLink>
        </li>
        <li>
          <PlainLink
            href={contact.github}
            label={`${site.name} on GitHub (opens in a new tab)`}
            external
          >
            GitHub
          </PlainLink>
        </li>
        <li>
          <PlainLink href={contact.cv} label={`Download ${site.name}'s CV as a PDF`}>
            Download the CV (PDF)
          </PlainLink>
        </li>
      </ul>

      <p className="nowebgl__note">
        Want the same content without WebGL? Use “Plain version” in the top bar.
      </p>
    </section>
  )
}
