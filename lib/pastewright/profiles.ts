/**
 * Destination profiles.
 *
 * A profile is an explicit, testable policy — not an abstract plugin. Each one
 * describes how a destination needs to *receive* a document, so the same words
 * come through faithfully while their representation adapts. Nothing here is a
 * generic conversion framework; it is exactly five hand-tuned targets.
 */

import type { Destination, TableLayout } from './types';

export interface DestinationMeta {
  id: Destination;
  /** Short control label, e.g. "Rich text". */
  label: string;
  /** One-line context, e.g. "Email & documents". */
  hint: string;
  /** A sentence used in the empty state and report header. */
  description: string;
  /** Whether the primary copy action writes rich clipboard data or plain text. */
  clipboard: 'rich' | 'plain';
  /** The primary copy button's label. */
  copyLabel: string;
  /** How the preview should render the produced text. */
  previewFont: 'sans' | 'mono';
}

export const DESTINATIONS: DestinationMeta[] = [
  {
    id: 'rich',
    label: 'Rich text',
    hint: 'Email & documents',
    description:
      'Standards-based rich clipboard for editors that accept it — Gmail, Outlook, Word, Google Docs. Both text/html and a plain-text fallback are placed on the clipboard.',
    clipboard: 'rich',
    copyLabel: 'Copy rich text',
    previewFont: 'sans',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    hint: 'Posts & comments',
    description:
      'Clean plain text for a LinkedIn post — structure adapted honestly, with no pseudo-bold Unicode letters and no engagement gimmicks.',
    clipboard: 'plain',
    copyLabel: 'Copy for LinkedIn',
    previewFont: 'sans',
  },
  {
    id: 'slack',
    label: 'Slack',
    hint: 'Messages',
    description:
      'Text that pastes predictably into the Slack composer. Compact tables ride inside a code block so their columns actually line up.',
    clipboard: 'plain',
    copyLabel: 'Copy for Slack',
    previewFont: 'mono',
  },
  {
    id: 'reddit',
    label: 'Reddit Markdown',
    hint: 'Markdown mode',
    description:
      "Markdown for Reddit's Markdown editing mode (new Reddit): tables and fenced code are kept; a few constructs Reddit can't show are adapted.",
    clipboard: 'plain',
    copyLabel: 'Copy Reddit Markdown',
    previewFont: 'mono',
  },
  {
    id: 'plain',
    label: 'Plain text',
    hint: 'Universally readable',
    description:
      "Exceptionally readable plain text that keeps the document's information architecture — headings, lists, quotes, code and tables all stay legible.",
    clipboard: 'plain',
    copyLabel: 'Copy plain text',
    previewFont: 'mono',
  },
];

export function destinationMeta(id: Destination): DestinationMeta {
  return DESTINATIONS.find((d) => d.id === id) ?? DESTINATIONS[0]!;
}

// ── Plain-text family policy ─────────────────────────────────────────────────

export type PlainDestination = 'linkedin' | 'slack' | 'plain';

export interface PlainPolicy {
  id: PlainDestination;
  /** Unicode bullet for unordered lists. */
  bullet: string;
  /** Task-list glyphs (accessible Unicode boxes, never fake typography). */
  task: { checked: string; unchecked: string };
  /** How blockquotes are shown: line prefix, or wrapped in typographic quotes. */
  blockquote: 'prefix' | 'wrap';
  /** The per-line prefix when `blockquote === 'prefix'`. */
  quotePrefix: string;
  /** `plain` keeps fenced code verbatim; `fence` wraps it in ``` (Slack). */
  codeBlock: 'plain' | 'fence';
  /**
   * Whether headings get a box-drawing underline (`═` / `─`). True on monospaced
   * surfaces; false for LinkedIn, whose proportional font renders a repeated-rule
   * line as a conspicuous, mis-sized bar — its headings are plain section labels.
   */
  headingUnderline: boolean;
  /** The horizontal-rule separator string. */
  hr: string;
  /** Table layout used when the caller asks for `auto`. */
  tableDefault: TableLayout;
  /** Slack wraps aligned tables in a ``` block so monospace holds the columns. */
  tableInCodeFence: boolean;
}

const HR_DASHES = '─'.repeat(24);

export const PLAIN_POLICIES: Record<PlainDestination, PlainPolicy> = {
  linkedin: {
    id: 'linkedin',
    bullet: '•',
    task: { checked: '☑', unchecked: '☐' },
    blockquote: 'wrap',
    quotePrefix: '> ',
    codeBlock: 'plain',
    headingUnderline: false,
    // A single em dash — LinkedIn renders long rule strings as conspicuous solid
    // lines, so keep the separator minimal (surrounding paragraph spacing does the rest).
    hr: '—',
    tableDefault: 'records',
    tableInCodeFence: false,
  },
  slack: {
    id: 'slack',
    bullet: '•',
    task: { checked: '☑', unchecked: '☐' },
    blockquote: 'prefix',
    quotePrefix: '> ',
    codeBlock: 'fence',
    headingUnderline: true,
    hr: HR_DASHES,
    tableDefault: 'auto',
    tableInCodeFence: true,
  },
  plain: {
    id: 'plain',
    bullet: '•',
    task: { checked: '☑', unchecked: '☐' },
    blockquote: 'prefix',
    quotePrefix: '> ',
    codeBlock: 'plain',
    headingUnderline: true,
    hr: HR_DASHES,
    tableDefault: 'auto',
    tableInCodeFence: false,
  },
};

export function isPlainDestination(id: Destination): id is PlainDestination {
  return id === 'linkedin' || id === 'slack' || id === 'plain';
}

/**
 * Whether a destination can hold aligned (fixed-width) table columns. Only
 * monospaced/preserved-spacing surfaces qualify. LinkedIn cannot: it renders posts
 * in a proportional font and re-wraps text, so space-padded columns and separator
 * rows fall apart — it always uses the record layout for tables instead. This is
 * the single source of truth for both the layout engine and the UI control.
 */
export function supportsAlignedTables(id: Destination): boolean {
  return id === 'plain' || id === 'slack';
}
