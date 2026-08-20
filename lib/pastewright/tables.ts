/**
 * Table adaptation — a first-class Pastewright capability, not an edge case.
 *
 * A Markdown pipe table looks great in a Markdown-aware surface and becomes
 * useless when pasted elsewhere. This module understands a table structurally
 * (headers, rows, cells, per-column alignment, inline formatting inside cells)
 * and degrades it deliberately into one of two plain-text shapes:
 *
 *   - Aligned columns  — a bordered, width-bounded ASCII table. Compact tables
 *                        fit at their natural widths; wider ones wrap each cell
 *                        to its column, so a logical row can span several physical
 *                        lines with continuation text kept under the right cell.
 *   - Record layout    — one labelled block per row, ideal for narrow/social.
 *
 * Every header and every cell is preserved, in order. Nothing is dropped because
 * a destination "can't do tables".
 */

import type { Table, AlignType } from 'mdast';
import type { Destination, TableLayout } from './types';
import { supportsAlignedTables } from './profiles';
import { renderInline, type InlineCtx } from './inline';
import {
  displayWidth,
  padEndDisplay,
  padStartDisplay,
  padCenterDisplay,
  segmentGraphemes,
} from './width';

/**
 * Aligned tables are drawn as bordered ASCII tables with a bounded target width.
 * Cells that don't fit are wrapped to their column width, so a logical row can
 * span several physical lines — the layout never relies on the destination to
 * wrap an arbitrarily wide line.
 */
export const ALIGNED_TARGET_WIDTH = 72;
/** A compact table (≤ this many columns, natural width within target) needs no wrapping. */
export const MAX_ALIGNED_COLUMNS = 6;
/** Above this column count a wide table reads better as records than as wrapped columns. */
export const WRAP_MAX_COLUMNS = 4;
/** A wrapped column is never squeezed below this content width. */
export const MIN_COLUMN_WIDTH = 5;

/** The chosen plain-text table shape. `aligned` and `wrapped` share one renderer. */
export type AlignedChoice = 'aligned' | 'wrapped' | 'records';

export interface TableModel {
  columns: number;
  align: AlignType[];
  header: string[];
  rows: string[][];
}

/** Collapse a cell's inline content to a single clean line. */
function cellText(
  cellChildren: readonly import('mdast').PhrasingContent[],
  ctx: InlineCtx,
): string {
  // Hard breaks / stray newlines inside a cell become spaces so a cell stays on
  // one line; runs of whitespace are collapsed for tidy alignment.
  return renderInline(cellChildren, ctx)
    .replace(/\s*\n\s*/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * Turn an mdast `table` into a normalised model. Ragged rows (fewer or more
 * cells than the header) are padded/kept so no cell is ever lost.
 */
export function extractTable(node: Table, ctx: InlineCtx): TableModel {
  const bodyRows = node.children;
  const headerRow = bodyRows[0];
  const rawHeader = headerRow ? headerRow.children.map((c) => cellText(c.children, ctx)) : [];

  const rawRows = bodyRows
    .slice(1)
    .map((row) => row.children.map((c) => cellText(c.children, ctx)));

  const columns = Math.max(
    rawHeader.length,
    node.align?.length ?? 0,
    ...rawRows.map((r) => r.length),
    1,
  );

  const pad = (arr: string[]): string[] => {
    const out = arr.slice(0, columns);
    while (out.length < columns) out.push('');
    return out;
  };

  const align: AlignType[] = [];
  for (let c = 0; c < columns; c += 1) align.push(node.align?.[c] ?? null);

  return {
    columns,
    align,
    header: pad(rawHeader),
    rows: rawRows.map(pad),
  };
}

/** Natural per-column display widths (max of header and all body cells, ≥ 1). */
export function columnWidths(model: TableModel): number[] {
  return model.header.map((h, c) => {
    let width = displayWidth(h);
    for (const row of model.rows) width = Math.max(width, displayWidth(row[c] ?? ''));
    return Math.max(1, width);
  });
}

/** A bordered row costs `| ` + ` | ` between cells + ` |` = 3·columns + 1 fixed columns. */
function borderOverhead(columns: number): number {
  return 3 * columns + 1;
}

/** The natural bordered width of a table if no wrapping were applied. */
function naturalBorderedWidth(model: TableModel): number {
  return columnWidths(model).reduce((a, b) => a + b, 0) + borderOverhead(model.columns);
}

/**
 * Fit the natural column widths into the target by shrinking the widest columns
 * toward a fair common ceiling — never below `MIN_COLUMN_WIDTH` (or a column's own
 * natural width, whichever is smaller). Columns that already fit keep their width.
 */
function fitWidths(natural: number[], columns: number, targetWidth: number): number[] {
  const avail = Math.max(columns, targetWidth - borderOverhead(columns));
  const widths = natural.slice();
  let sum = widths.reduce((a, b) => a + b, 0);
  if (sum <= avail) return widths;
  const floor = natural.map((n) => Math.min(n, MIN_COLUMN_WIDTH));
  // Reduce the widest reducible column by one until we fit or nothing can shrink.
  // Bounded by `sum` iterations; deterministic (ties resolve to the lowest index).
  let guard = sum;
  while (sum > avail && guard > 0) {
    guard -= 1;
    let bestIndex = -1;
    let bestWidth = -1;
    for (let c = 0; c < columns; c += 1) {
      if (widths[c]! > floor[c]! && widths[c]! > bestWidth) {
        bestWidth = widths[c]!;
        bestIndex = c;
      }
    }
    if (bestIndex < 0) break;
    widths[bestIndex]! -= 1;
    sum -= 1;
  }
  return widths;
}

/** Break a single token into chunks each within `width` display columns (grapheme-safe). */
function hardBreak(word: string, width: number): string[] {
  const chunks: string[] = [];
  let chunk = '';
  let chunkWidth = 0;
  for (const grapheme of segmentGraphemes(word)) {
    const gw = displayWidth(grapheme);
    if (chunk !== '' && chunkWidth + gw > width) {
      chunks.push(chunk);
      chunk = '';
      chunkWidth = 0;
    }
    chunk += grapheme;
    chunkWidth += gw;
  }
  if (chunk !== '') chunks.push(chunk);
  return chunks.length ? chunks : [''];
}

/** Word-wrap a single-line cell to `width`, hard-breaking any over-long token. */
function wrapCell(text: string, width: number): string[] {
  const w = Math.max(1, width);
  const words = text.split(' ').filter((word) => word !== '');
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let line = '';
  const place = (piece: string): void => {
    if (line === '') line = piece;
    else if (displayWidth(line) + 1 + displayWidth(piece) <= w) line += ` ${piece}`;
    else {
      lines.push(line);
      line = piece;
    }
  };
  for (const word of words) {
    if (displayWidth(word) <= w) place(word);
    else for (const piece of hardBreak(word, w)) place(piece);
  }
  if (line !== '') lines.push(line);
  return lines.length ? lines : [''];
}

function padCell(text: string, width: number, align: AlignType): string {
  if (align === 'right') return padStartDisplay(text, width);
  if (align === 'center') return padCenterDisplay(text, width);
  return padEndDisplay(text, width);
}

/** Build the physical lines for one logical row (its height = the tallest cell). */
function physicalRow(cellLines: string[][], widths: number[], align: AlignType[]): string[] {
  const height = Math.max(1, ...cellLines.map((lines) => lines.length));
  const lines: string[] = [];
  for (let i = 0; i < height; i += 1) {
    const parts = cellLines.map((lines_, c) =>
      padCell(lines_[i] ?? '', widths[c]!, align[c] ?? null),
    );
    // The row ends with a border pipe, so there is never trailing whitespace.
    lines.push(`| ${parts.join(' | ')} |`);
  }
  return lines;
}

/**
 * Render the model as a bordered, width-bounded table. Compact tables fit at
 * their natural widths (no wrapping); wider tables wrap cell contents to fitted
 * column widths, so a logical row may span multiple physical lines with
 * continuation text kept under the correct cell. Every cell and row is preserved.
 *
 * Column alignment comes from the source; display width is measured
 * approximately (grapheme- and CJK-aware), so exotic Unicode may be a column off.
 */
export function renderAligned(model: TableModel, targetWidth = ALIGNED_TARGET_WIDTH): string {
  const widths = fitWidths(columnWidths(model), model.columns, targetWidth);
  const align = model.align;
  const headerLines = model.header.map((cell, c) => wrapCell(cell, widths[c]!));
  const divider = `|${widths.map((w) => '-'.repeat(w + 2)).join('|')}|`;

  const out: string[] = [];
  out.push(...physicalRow(headerLines, widths, align));
  out.push(divider);
  for (const row of model.rows) {
    out.push(
      ...physicalRow(
        row.map((cell, c) => wrapCell(cell ?? '', widths[c]!)),
        widths,
        align,
      ),
    );
  }
  return out.join('\n');
}

/**
 * Build a record's heading from the first column. The first-column *value* is the
 * heading. A multi-word value is self-sufficient and stands alone ("Capability
 * capital", "Creative capital"); a single-token value (e.g. "Atlas", "A") reads
 * better with its column header for context ("Vendor Atlas"), which also keeps
 * that header from being lost for bare-identifier key columns.
 */
function recordHeading(header: string, value: string): string {
  const h = header.trim();
  const v = value.trim();
  if (h === '') return v;
  return /\s/.test(v) ? v : `${h} ${v}`;
}

/** Render the model as one labelled record block per row. */
export function renderRecords(model: TableModel): string {
  // A header-only table (no body rows) has no records to make, but its headers
  // are still content and must not be dropped — list them, one per line.
  if (model.rows.length === 0) {
    return model.header.filter((h) => h.trim() !== '').join('\n');
  }
  const blocks: string[] = [];
  for (const row of model.rows) {
    const lines: string[] = [];
    const firstHeader = model.header[0] ?? '';
    const firstValue = row[0] ?? '';
    // The first column's value becomes the record's heading. When that value is
    // blank, show the column as a labelled line ("Header:") like any other, so a
    // blank first cell is visible rather than making the header look like data.
    if (firstValue.trim() !== '') {
      lines.push(recordHeading(firstHeader, firstValue));
    } else if (firstHeader.trim() !== '') {
      lines.push(`${firstHeader}:`);
    }
    for (let c = 1; c < model.columns; c += 1) {
      const label = model.header[c] ?? '';
      const value = row[c] ?? '';
      lines.push(value === '' ? `${label}:` : `${label}: ${value}`);
    }
    blocks.push(lines.join('\n'));
  }
  return blocks.join('\n\n');
}

/** Whether the table fits, bordered, within the target at its natural widths. */
function isCompact(model: TableModel): boolean {
  return (
    model.columns <= MAX_ALIGNED_COLUMNS && naturalBorderedWidth(model) <= ALIGNED_TARGET_WIDTH
  );
}

/**
 * The deterministic Auto strategy — never viewport-driven, so the copied result
 * is stable. It chooses among three shapes:
 *   - `aligned`  — genuinely compact tables (fit bordered within the target);
 *   - `wrapped`  — moderately wide tables (few enough columns to wrap usefully);
 *   - `records`  — sufficiently wide/verbose that columns stop being a good
 *                  plain-text representation (too many columns).
 * Destinations without fixed-width layout (e.g. LinkedIn) always use records.
 */
export function chooseAutoLayout(model: TableModel, destination: Destination): AlignedChoice {
  if (!supportsAlignedTables(destination)) return 'records';
  if (isCompact(model)) return 'aligned';
  if (model.columns <= WRAP_MAX_COLUMNS) return 'wrapped';
  return 'records';
}

/**
 * Resolve the effective layout for a table given the user's choice. An explicit
 * `aligned` request is honoured with the robust wrapping renderer (never demoted
 * to records just because the source table is wide) — except on destinations that
 * can't hold aligned columns at all (LinkedIn), where tables are always records.
 */
export function resolveLayout(
  model: TableModel,
  destination: Destination,
  layout: TableLayout,
): AlignedChoice {
  if (!supportsAlignedTables(destination)) return 'records';
  if (layout === 'records') return 'records';
  if (layout === 'aligned') return isCompact(model) ? 'aligned' : 'wrapped';
  return chooseAutoLayout(model, destination);
}
