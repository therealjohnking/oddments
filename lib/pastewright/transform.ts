/**
 * The Pastewright transform pipeline.
 *
 *   Markdown → parse (mdast) → per-destination render → TransformResult
 *
 * One entry point, deterministic, side-effect free. It changes representation for
 * the chosen destination and reports what it did — it never changes the author's
 * words.
 */

import type { Destination, TableLayout, TransformResult, RichNode } from './types';
import { emptyStats } from './types';
import { parseMarkdown } from './parse';
import { collectDefinitions } from './util';
import { renderPlain } from './plain-text';
import { renderRich, serializeRich } from './rich-text';
import { renderReddit } from './reddit';
import { buildFindings, statusFromFindings } from './report';
import { PLAIN_POLICIES, isPlainDestination, supportsAlignedTables } from './profiles';

/** Transform Markdown for a destination. `tableLayout` matters only for the plain family. */
export function transform(
  source: string,
  destination: Destination,
  tableLayout: TableLayout = 'auto',
): TransformResult {
  const root = parseMarkdown(source);
  const defs = collectDefinitions(root);
  const stats = emptyStats();

  let text: string;
  let html: string | null = null;
  let rich: RichNode[] | null = null;

  if (destination === 'rich') {
    rich = renderRich(root, stats, defs);
    html = serializeRich(rich);
    // Plain-text fallback for the clipboard; discard its stats so findings are
    // counted once, from the rich render above.
    text = renderPlain(root, 'plain', PLAIN_POLICIES.plain, 'auto', emptyStats(), defs);
  } else if (destination === 'reddit') {
    text = renderReddit(root, stats);
  } else if (isPlainDestination(destination)) {
    text = renderPlain(root, destination, PLAIN_POLICIES[destination], tableLayout, stats, defs);
  } else {
    text = '';
  }

  const findings = buildFindings(destination, stats);
  const status = statusFromFindings(findings);
  const tableCount = stats.tables.length;

  return {
    destination,
    text,
    html,
    rich,
    findings,
    status,
    tableCount,
    tableLayout,
    // The Auto/Aligned/Records control only makes sense where aligned columns
    // are actually usable (LinkedIn is records-only, so it shows no control).
    showTableControl: supportsAlignedTables(destination) && tableCount > 0,
    charCount: Array.from(text).length,
  };
}
