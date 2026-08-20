/**
 * The canonical list of shipped tools — the one place that knows every route.
 *
 * Ordered newest-first: the same order the landing page presents them, so the
 * most recent additions to the bench are the first thing a returning visitor
 * sees. The landing page keeps its richer hand-written cards (copy with
 * markup doesn't belong in a data file); a test asserts the two stay in sync.
 *
 * Deliberately not a "tool registry": no components, no metadata objects, no
 * lifecycle — just names, slugs, and a one-line hook for places that need to
 * enumerate routes (sitemap, 404 quick links).
 */

export interface ToolInfo {
  /** URL slug under /tools/. */
  slug: string;
  /** Display name, as it appears in titles and links. */
  name: string;
  /** One-line hook, lowercase, no trailing period — used by the 404 page. */
  hook: string;
}

export const TOOLS: readonly ToolInfo[] = [
  {
    slug: 'pastewright',
    name: 'Pastewright',
    hook: 'adapt Markdown for wherever it’s going',
  },
  {
    slug: 'regex-workbench',
    name: 'Regex Workbench',
    hook: 'see exactly what a JavaScript regex does',
  },
  {
    slug: 'date-goblin',
    name: 'Date Goblin',
    hook: 'make timestamps, zones, and DST legible',
  },
  {
    slug: 'corporate-bingo',
    name: 'Corporate Phrase Bingo',
    hook: 'survive meetings one cliché at a time',
  },
  {
    slug: 'json-crime-scene',
    name: 'JSON Crime Scene',
    hook: 'understand one JSON document, forensically',
  },
  {
    slug: 'diffoscope',
    name: 'Diffoscope',
    hook: 'see what actually changed between two texts',
  },
  {
    slug: 'csv-autopsy',
    name: 'CSV Autopsy',
    hook: 'profile a CSV before you trust it',
  },
  {
    slug: 'slopometer',
    name: 'Slopometer',
    hook: 'score the stylistic tics of generic prose',
  },
  {
    slug: 'invisible-characters',
    name: 'Invisible Character Inspector',
    hook: 'reveal the characters you can’t see',
  },
];

/** The route path for a tool. */
export function toolPath(tool: ToolInfo): string {
  return `/tools/${tool.slug}`;
}
