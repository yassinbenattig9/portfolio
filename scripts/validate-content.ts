import { findMissingAssets, createContentLoader } from './lib.ts';

/**
 * Build-time content gate: the same `validateContent` that the app and the
 * tests use, run before `vite build`.
 *
 * - Zod failures exit 1 with every field path and reason (no stack trace).
 * - Every asset reference (the schema-derived whitelist in scripts/lib.ts)
 *   must point at a file that exists under `public/`.
 * - An optional argument (or `PORTFOLIO_JSON`) points the gate at another
 *   file, e.g. a candidate document; the default is the real
 *   `src/content/portfolio.json`.
 */
async function main(): Promise<void> {
  const loader = await createContentLoader();
  try {
    const raw = await loader.readRawJson(process.argv[2]);
    const { validateContent, deriveSpreads } = await loader.loadContentModule();

    let content;
    try {
      content = validateContent(raw);
    } catch (cause) {
      console.error((cause as Error).message);
      console.error(
        '\nHint: fix src/content/portfolio.json, then run "npm run build" again.',
      );
      process.exitCode = 1;
      return;
    }

    const missing = await findMissingAssets(content, 'public');
    if (missing.length > 0) {
      console.error(
        `Missing media files referenced by the content (${missing.length}):\n` +
          missing
            .map((ref) => `  - ${ref.fieldPath}: ${ref.value} (expected under public/)`)
            .join('\n'),
      );
      console.error(
        '\nHint: drop the files into public/media/... (or fix the paths in ' +
          'src/content/portfolio.json), then run "npm run build" again.',
      );
      process.exitCode = 1;
      return;
    }

    const visibleProjects = content.projects.filter((project) => project.visible).length;
    console.log(`content OK (${visibleProjects} projects, ${deriveSpreads(content).length} spreads)`);
  } finally {
    await loader.close();
  }
}

try {
  await main();
} catch (cause) {
  console.error(`validate-content: unexpected failure: ${(cause as Error).message}`);
  process.exitCode = 1;
}
