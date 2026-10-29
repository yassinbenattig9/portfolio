import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createContentLoader, escapeHtml } from './lib.ts';
import type { Portfolio } from '../src/content/schema.ts';

/**
 * Writes `dist/plain.html`: the recruiter's plain-text version of the site,
 * generated from the validated content so it can never disagree with the book
 * (plan §7.2). Runs after `vite build`.
 *
 * Self-contained static HTML: no JavaScript, no web fonts, no images, inline
 * CSS only, and every text value is escaped. Only exists if
 * `validate-content` passed, because the content is re-validated here.
 */

/** Direction A palette (mirrors the tokens in src/index.css). */
const STYLE = `
  :root { color-scheme: light; }
  body {
    margin: 0 auto;
    max-width: 62ch;
    padding: 2rem 1.25rem 4rem;
    background: #e9edea;
    color: #15202d;
    font: 16px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  h1 { font-size: 1.9rem; margin: 0 0 0.25rem; }
  h1 + p { margin-top: 0; color: #1d4f9f; font-weight: 600; }
  h2 { font-size: 1.1rem; margin: 2.5rem 0 0.5rem; }
  h3 { font-size: 1rem; margin: 1.5rem 0 0.25rem; }
  .rule { border: 0; border-top: 2px solid #bc9440; margin: 2rem 0; }
  a { color: #1d4f9f; text-underline-offset: 3px; }
  ul { margin: 0.25rem 0; padding-left: 1.25rem; }
  li + li { margin-top: 0.25rem; }
  .meta { color: #5a646e; margin: 0; }
  .links { margin: 0.25rem 0 0; padding: 0; list-style: none; display: flex; gap: 1rem; flex-wrap: wrap; }
  .stack { color: #5a646e; }
  .back { margin-top: 3rem; }
`.trim();

function header(content: Portfolio): string {
  const name = escapeHtml(content.site.name);
  const role = escapeHtml(content.site.role);
  const description = escapeHtml(content.about.summary);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name} — ${role}</title>
  <meta name="description" content="${description}" />
  <style>
${STYLE.split('\n').map((line) => `    ${line}`).join('\n')}
  </style>
</head>
<body>
  <h1>${name}</h1>
  <p>${role}</p>`;
}

function about(content: Portfolio): string {
  const { headline, summary, languages } = content.about;
  return `
  <h2>About</h2>
  <p><strong>${escapeHtml(headline)}</strong></p>
  <p>${escapeHtml(summary)}</p>
  <p class="stack">Languages: ${languages.map(escapeHtml).join(', ')}</p>
  <hr class="rule" />`;
}

function linksList(
  links: ReadonlyArray<{ url: string; label: string }>,
): string {
  return links
    .map((link) => `<li><a href="${escapeHtml(link.url)}">${escapeHtml(link.label)}</a></li>`)
    .join('\n    ');
}

function projects(content: Portfolio): string {
  const visible = content.projects.filter((project) => project.visible);

  const articles = visible.map((project) => {
    const parts: string[] = [
      `  <article id="${escapeHtml(project.id)}">`,
      `    <h3>${escapeHtml(project.title)}</h3>`,
      `    <p class="meta">${escapeHtml(project.period)} · ${escapeHtml(project.role)}</p>`,
      `    <p>${escapeHtml(project.summary)}</p>`,
    ];

    parts.push(
      '    <ul>',
      project.highlights.map((highlight) => `      <li>${escapeHtml(highlight)}</li>`).join('\n'),
      '    </ul>',
      `    <p class="stack">Stack: ${project.stack.map(escapeHtml).join(', ')}</p>`,
    );

    const linkTargets = [
      project.links.live !== null ? { url: project.links.live, label: 'Live' } : null,
      project.links.repo !== null ? { url: project.links.repo, label: 'Repository' } : null,
    ].filter((link) => link !== null);

    if (linkTargets.length > 0) {
      parts.push(
        '    <ul class="links">',
        `    ${linksList(linkTargets)}`,
        '    </ul>',
      );
    }

    parts.push('  </article>');
    return parts.join('\n');
  });

  return `
  <h2>Projects</h2>
${articles.join('\n')}`;
}

function contact(content: Portfolio): string {
  const { email, linkedin, github, cv } = content.contact;
  const targets = [
    { url: `mailto:${email}`, label: 'Email' },
    { url: linkedin, label: 'LinkedIn' },
    { url: github, label: 'GitHub' },
    // A CV link only when the field is set; the schema keeps it today, but the
    // plain page must not invent a dead link.
    cv.length > 0 ? { url: cv, label: 'Curriculum vitae (PDF)' } : null,
  ].filter((target) => target !== null);

  return `
  <h2>Contact</h2>
  <ul class="links">
    ${linksList(targets)}
  </ul>
  <p class="back"><a href="/">Open the interactive book →</a></p>`;
}

function renderPlain(content: Portfolio): string {
  return [header(content), about(content), projects(content), contact(content), '\n</body>\n</html>\n'].join('\n');
}

async function main(): Promise<void> {
  const loader = await createContentLoader();
  try {
    // The optional argument exists so this script can render a candidate
    // document during development; npm scripts never pass anything, so deploys
    // always build from the real src/content/portfolio.json.
    const raw = await loader.readRawJson(process.argv[2]);
    const { validateContent } = await loader.loadContentModule();
    const content = validateContent(raw);

    const outPath = resolve(process.cwd(), 'dist/plain.html');
    await mkdir(resolve(process.cwd(), 'dist'), { recursive: true });
    await writeFile(outPath, renderPlain(content), 'utf8');

    const kilobytes = (renderPlain(content).length / 1024).toFixed(1);
    console.log(`dist/plain.html written (${kilobytes} kB)`);
  } finally {
    await loader.close();
  }
}

try {
  await main();
} catch (cause) {
  console.error(`build-plain: unexpected failure: ${(cause as Error).message}`);
  process.exitCode = 1;
}
