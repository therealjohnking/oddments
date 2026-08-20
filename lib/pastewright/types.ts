/**
 * Shared domain types for Pastewright — a local-first instrument that adapts the
 * *representation* of a Markdown document for a chosen destination, without ever
 * changing the author's words.
 *
 * Everything here is plain, serialisable data: no mdast node, no React type, and
 * certainly no `RegExp` crosses this boundary. The engine's job is to turn
 * (Markdown + destination + table layout) into a `TransformResult`; the UI's job
 * is to render it. Keeping the seam this clean is what would let the engine be
 * extracted later, and lets every rule be unit-tested without a DOM.
 *
 * Pastewright transforms structure, not prose. It never summarises, paraphrases,
 * reorders, or "improves" text — it only changes how a destination needs to
 * receive that same text.
 */

// ── Destinations ─────────────────────────────────────────────────────────────

/** The five destination profiles shipped in M0.9. */
export type Destination = 'rich' | 'linkedin' | 'slack' | 'reddit' | 'plain';

/**
 * How a source table is laid out for a plain-text destination.
 * - `auto`     — a deterministic heuristic picks aligned vs. records per table.
 * - `aligned`  — monospace column alignment (compact tables).
 * - `records`  — one labelled block per row (wide tables / social prose).
 *
 * Rich text always emits a real HTML table and Reddit always keeps a Markdown
 * pipe table, so the choice is inert for those two.
 */
export type TableLayout = 'auto' | 'aligned' | 'records';

/** The concrete representation a single table ended up in. */
export type TableRepresentation = 'html' | 'pipe' | 'aligned' | 'records';

// ── Transformation findings ──────────────────────────────────────────────────

export type FindingCategory =
  | 'headings'
  | 'emphasis'
  | 'links'
  | 'images'
  | 'lists'
  | 'blockquotes'
  | 'code'
  | 'tables'
  | 'html'
  | 'rules';

/**
 * Whether a construct came through untouched, was adapted faithfully, or lost
 * some formatting semantics. Content is *always* preserved — `compromised` means
 * a formatting/semantic feature had no direct representation, never that text was
 * dropped.
 */
export type FindingImpact = 'preserved' | 'adapted' | 'compromised';

/** One aggregated note about what Pastewright did to a class of construct. */
export interface Finding {
  id: string;
  category: FindingCategory;
  impact: FindingImpact;
  /** A short title, e.g. "Table adapted". */
  title: string;
  /** A human sentence explaining what happened. */
  detail: string;
  /** How many source constructs this finding aggregates. */
  count: number;
}

export type TransformStatusKind = 'preserved' | 'adapted' | 'compromised';

export interface TransformStatus {
  kind: TransformStatusKind;
  /** "Preserved" | "Adapted" | "Formatting compromises". */
  label: string;
  /** A one-line summary derived from the findings. */
  summary: string;
}

// ── Rich (HTML) output ───────────────────────────────────────────────────────

/** The restrained, paste-friendly HTML element tags Pastewright will emit. */
export type RichTag =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'p'
  | 'strong'
  | 'em'
  | 'del'
  | 'code'
  | 'pre'
  | 'a'
  | 'br'
  | 'ul'
  | 'ol'
  | 'li'
  | 'blockquote'
  | 'hr'
  | 'table'
  | 'thead'
  | 'tbody'
  | 'tr'
  | 'th'
  | 'td'
  | 'span';

export interface RichAttrs {
  /** Only ever a scheme-checked http/https/mailto/tel URL. */
  href?: string;
  /** `start` on an `<ol>` when the list does not start at 1. */
  start?: number;
  /** `text-align` for a `<th>`/`<td>` — the only inline style we emit. */
  align?: 'left' | 'right' | 'center';
}

/**
 * A tiny, controlled node tree. It is the single source of truth for both the
 * HTML string placed on the clipboard *and* the React preview, so the two can
 * never drift. Text is escaped at serialisation time; there is no path from
 * source Markdown to executable markup.
 */
export type RichNode =
  | { kind: 'element'; tag: RichTag; attrs?: RichAttrs; children: RichNode[] }
  | { kind: 'text'; value: string };

// ── The transform result ─────────────────────────────────────────────────────

export interface TransformResult {
  destination: Destination;
  /** The text placed on the clipboard as `text/plain` for every destination. */
  text: string;
  /** The `text/html` payload for the Rich text destination; otherwise `null`. */
  html: string | null;
  /** The controlled node tree for the Rich text preview; otherwise `null`. */
  rich: RichNode[] | null;
  /** Aggregated, de-duplicated notes about what changed. */
  findings: Finding[];
  status: TransformStatus;
  /** Number of Markdown tables found in the source. */
  tableCount: number;
  /** The table layout the caller selected (echoed for the UI control). */
  tableLayout: TableLayout;
  /**
   * Whether the table-layout control is meaningful for this destination —
   * true only for plain-text destinations that actually contain a table.
   */
  showTableControl: boolean;
  /** Character count of `text` — informational only; no limits are enforced. */
  charCount: number;
}

// ── Render statistics (engine-internal, shared across renderers) ─────────────

/** Per-table facts gathered while rendering, used to word table findings. */
export interface TableStat {
  columns: number;
  /** Body rows (excludes the header row). */
  rows: number;
  representation: TableRepresentation;
}

/**
 * A mutable tally the renderers fill and `report.ts` reads. Every renderer
 * (plain, rich, reddit) fills the same shape so the report logic stays
 * destination-generic, branching only on wording.
 */
export interface RenderStats {
  headings: number;
  strong: number;
  emphasis: number;
  strike: number;
  links: number;
  /** Links rendered as "label (url)" rather than kept clickable/Markdown. */
  linksExpanded: number;
  images: number;
  lists: number;
  taskItems: number;
  /** Task items rendered with a Unicode box because the target has no checkbox. */
  taskItemsAdapted: number;
  blockquotes: number;
  inlineCode: number;
  codeBlocks: number;
  tables: TableStat[];
  html: number;
  thematicBreaks: number;
  /** True when this destination removed emphasis markup (bold/italic/strike). */
  emphasisStripped: boolean;
}

export function emptyStats(): RenderStats {
  return {
    headings: 0,
    strong: 0,
    emphasis: 0,
    strike: 0,
    links: 0,
    linksExpanded: 0,
    images: 0,
    lists: 0,
    taskItems: 0,
    taskItemsAdapted: 0,
    blockquotes: 0,
    inlineCode: 0,
    codeBlocks: 0,
    tables: [],
    html: 0,
    thematicBreaks: 0,
    emphasisStripped: false,
  };
}
