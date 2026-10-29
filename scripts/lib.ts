import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { createServer, type ViteDevServer } from 'vite';
import type { Portfolio } from '../src/content/schema.ts';

/**
 * Helpers shared by `validate-content.ts` and `build-plain.ts`.
 *
 * Both scripts run under `node --experimental-strip-types` (no bundler), so
 * this file may only use erasable TypeScript syntax and explicit `.ts`
 * extensions on relative imports. The content modules are NOT imported
 * statically: they go through Vite's SSR loader, because
 * `src/content/loadContent.ts` uses extensionless imports and a bare JSON
 * import that Node's resolver does not accept. Loading them through Vite keeps
 * `validateContent` as the single source of validation for the whole pipeline
 * (tests, runtime, plain page, build gate).
 */

export const DEFAULT_CONTENT_PATH = 'src/content/portfolio.json';

export interface ContentLoader {
  loadContentModule(): Promise<{
    validateContent: (raw: unknown) => Portfolio;
    deriveSpreads: (content: Portfolio) => ReadonlyArray<unknown>;
  }>;
  /** Resolves a JSON value from the given (or the default) content path. */
  readRawJson(contentPath?: string): Promise<unknown>;
  close(): Promise<void>;
}

/** Starts a headless Vite SSR server without the project's dev plugins. */
export async function createContentLoader(): Promise<ContentLoader> {
  const server: ViteDevServer = await createServer({
    // The scripts only run TS/JSON through SSR; plugins and the vitest config
    // are not needed, so skip the config file entirely.
    configFile: false,
    root: process.cwd(),
    appType: 'custom',
    server: { middlewareMode: true },
    logLevel: 'error',
    optimizeDeps: { noDiscovery: true },
  });

  return {
    async loadContentModule() {
      const loadContentModule = await server.ssrLoadModule('/src/content/loadContent.ts');
      const deriveSpreadsModule = await server.ssrLoadModule('/src/content/deriveSpreads.ts');
      return {
        validateContent: loadContentModule.validateContent as (
          raw: unknown,
        ) => Portfolio,
        deriveSpreads: deriveSpreadsModule.deriveSpreads as (
          content: Portfolio,
        ) => ReadonlyArray<unknown>,
      };
    },
    async readRawJson(contentPath?: string) {
      const path = resolveJsonPath(contentPath);
      let text: string;
      try {
        text = await readFile(path, 'utf8');
      } catch (cause) {
        throw new Error(`content file not readable: ${path} (${(cause as Error).message})`);
      }
      try {
        return JSON.parse(text) as unknown;
      } catch (cause) {
        throw new Error(`${path} is not valid JSON: ${(cause as Error).message}`);
      }
    },
    close: () => server.close(),
  };
}

function resolveJsonPath(contentPath?: string): string {
  const raw = contentPath ?? process.env.PORTFOLIO_JSON ?? DEFAULT_CONTENT_PATH;
  return isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
}

/**
 * Collects every string value that looks like a site-absolute asset path
 * (starts with `/`, has a file extension in its last segment, no whitespace).
 * Field names are deliberately not hardcoded: the walk finds the paths
 * wherever they live in the document.
 */
export interface AssetPathRef {
  readonly fieldPath: string;
  readonly value: string;
}

export function collectAssetPaths(value: unknown, path: string): AssetPathRef[] {
  if (typeof value === 'string') {
    return looksLikeAssetPath(value) ? [{ fieldPath: path, value }] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectAssetPaths(item, `${path}[${index}]`),
    );
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      collectAssetPaths(child, path.length === 0 ? key : `${path}.${key}`),
    );
  }
  return [];
}

function looksLikeAssetPath(value: string): boolean {
  return value.startsWith('/') && !/\s/.test(value) && /\.[a-z0-9]+$/i.test(value.split('/').pop() ?? '');
}

/** Returns the missing files, checked against `public/`. */
export async function findMissingAssets(
  content: Portfolio,
  publicDir: string,
): Promise<AssetPathRef[]> {
  const references = collectAssetPaths(content, '');
  return references.filter(({ value }) => !existsSync(resolve(publicDir, value.slice(1))));
}

/** Escapes text for safe interpolation into HTML text and attributes. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
