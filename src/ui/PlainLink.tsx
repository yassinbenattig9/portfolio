import type { ReactNode } from 'react'

/**
 * The chrome's text link. Deliberately tiny: the look comes from `.ui-link`
 * (44 px hit target, brass underline, limewash text on ink), so every caller
 * gets the same keyboard and contrast behaviour instead of re-styling an `<a>`.
 */

export interface PlainLinkProps {
  /** Where the link goes. The caller owns whether it is internal or external. */
  readonly href: string
  /** Visible, sentence-case link text. */
  readonly children: ReactNode
  /**
   * Accessible name. Required because "Plain version" or "here" alone is
   * ambiguous once a screen reader lists every link on the page.
   */
  readonly label: string
  /** Extra class for layout only; never for colour or focus styling. */
  readonly className?: string
  /** Links that leave the site open in a new tab and drop the referrer. */
  readonly external?: boolean
}

export function PlainLink({ href, children, label, className, external = false }: PlainLinkProps) {
  return (
    <a
      className={className === undefined ? 'ui-link' : `ui-link ${className}`}
      href={href}
      aria-label={label}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer noopener' : undefined}
    >
      {children}
    </a>
  )
}
