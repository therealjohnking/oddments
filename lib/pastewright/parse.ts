/**
 * The Markdown parsing seam.
 *
 * Pastewright does not parse Markdown with regexes. It uses `micromark` (a
 * CommonMark state machine) via `mdast-util-from-markdown`, with the GFM
 * extension for tables, task lists, strikethrough and autolinks, to produce a
 * proper `mdast` syntax tree. Everything downstream walks that tree; nothing
 * downstream re-parses source text.
 *
 * Raw HTML in the source becomes `html` nodes here. Pastewright treats those as
 * literal text — it never renders source HTML — so there is no path from source
 * to executable markup.
 */

import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfm } from 'micromark-extension-gfm';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import type { Root } from 'mdast';

/**
 * A generous cap on input size. Parsing and rendering are synchronous; this keeps
 * a pathological paste from janking the main thread. The UI warns near the cap.
 */
export const MAX_INPUT_LENGTH = 200_000;

/** Parse a Markdown string into a GFM-aware mdast tree. */
export function parseMarkdown(source: string): Root {
  return fromMarkdown(source, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });
}
