/**
 * diagnostics — the "these look identical" engine.
 *
 * Two layers:
 *   - `computeVerdict` states, in one sentence, how A and B relate: exactly
 *     identical, identical-except-for-<one cosmetic dimension>, canonically
 *     equivalent, a combination of cosmetic differences, or genuinely different.
 *   - `extractSubtleFindings` locates the *specific* character-level differences
 *     that a human eye misses — derived from the grapheme-level diff, so a curly
 *     quote is only ever reported where it actually stands opposite a straight
 *     one. Findings are suppressed when the inputs differ substantially (a lone
 *     invisible character inside two unrelated texts would just be noise).
 */

import { classify, formatCodePoint } from '@/lib/inspector';
import { diffKeys } from './myers';
import {
  collapseWhitespace,
  foldCase,
  foldConfusables,
  foldHomoglyphs,
  foldTypographicPunctuation,
  isStrippableInvisible,
  normLineEndings,
  stripInvisibles,
  toNFC,
} from './normalize';
import { LineIndex } from './positions';
import { computeLineEndings } from './stats';
import { tokenizeGraphemes, tokenizeLines } from './tokenize';
import type {
  CosmeticDim,
  LineEndingCounts,
  SubtleFinding,
  SubtleKind,
  SubtlePosition,
  SubtleSeverity,
  Token,
  Verdict,
  VerdictKind,
} from './types';

/** Per-side graphemes above which the subtle scan is skipped as too costly. */
const SUBTLE_CHAR_LIMIT = 20_000;
const EXAMPLE_CAP = 12;
/** Below this fraction of common graphemes, suppress subtle findings as noise. */
const SIMILARITY_SHOW = 0.7;

const SEVERITY: Record<SubtleKind, SubtleSeverity> = {
  'line-ending': 'notice',
  whitespace: 'notice',
  invisible: 'warning',
  homoglyph: 'warning',
  punctuation: 'info',
  case: 'info',
  normalization: 'notice',
};

const ASCII_NAMES: Record<number, string> = {
  0x20: 'Space',
  0x09: 'Tab',
  0x0a: 'Line feed (LF)',
  0x0d: 'Carriage return (CR)',
  0x27: 'Apostrophe',
  0x22: 'Quotation mark',
  0x2d: 'Hyphen-minus',
  0x2e: 'Full stop',
  0x2c: 'Comma',
  0x3b: 'Semicolon',
  0x3a: 'Colon',
  0x2f: 'Solidus (slash)',
  0x60: 'Grave accent',
};

/** Best-effort human name + canonical code point label for a code point. */
export function describeCodePoint(cp: number): { cp: number; name: string; label: string } {
  const label = formatCodePoint(cp);
  const classified = classify(cp);
  if (classified) return { cp, name: classified.name, label };
  if (ASCII_NAMES[cp]) return { cp, name: ASCII_NAMES[cp]!, label };
  if (cp >= 0x21 && cp <= 0x7e) return { cp, name: `“${String.fromCodePoint(cp)}”`, label };
  return { cp, name: label, label };
}

// ── Verdict ────────────────────────────────────────────────────────────────

interface Transform {
  dim: CosmeticDim;
  fn: (s: string) => string;
}

// Canonical composition order: strip invisibles, canonicalize, fold confusable
// letters (homoglyphs) then confusable punctuation, fold case, then collapse
// whitespace (which also unifies line endings). Homoglyph letters and typographic
// punctuation are folded separately so the dimension attribution can tell them
// apart (a spoofed Cyrillic letter is not "punctuation").
const COSMETIC: Transform[] = [
  { dim: 'invisibles', fn: stripInvisibles },
  { dim: 'nfc', fn: toNFC },
  { dim: 'homoglyph', fn: foldHomoglyphs },
  { dim: 'punctuation', fn: foldTypographicPunctuation },
  { dim: 'case', fn: foldCase },
  { dim: 'whitespace', fn: collapseWhitespace },
];

function applySubset(text: string, subset: Transform[]): string {
  let out = text;
  for (const t of subset) out = t.fn(out);
  return out;
}

const DIM_LABEL: Record<CosmeticDim, string> = {
  'line-endings': 'line endings',
  whitespace: 'whitespace',
  case: 'letter case',
  nfc: 'Unicode form',
  punctuation: 'punctuation',
  homoglyph: 'look-alike letters',
  invisibles: 'invisible characters',
};

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function verdict(
  kind: VerdictKind,
  label: string,
  headline: string,
  dimensions: CosmeticDim[] = [],
): Verdict {
  return { kind, label, headline, dimensions };
}

/** State the single most informative relationship between the raw inputs. */
export function computeVerdict(a: string, b: string): Verdict {
  if (a === b) {
    return verdict(
      'identical',
      'Identical',
      'The two inputs are exactly identical — every character matches.',
    );
  }
  if (a === '' || b === '') {
    const which = a === '' ? 'A / Before' : 'B / After';
    const other = a === '' ? 'B / After' : 'A / Before';
    return verdict(
      'empty-vs-nonempty',
      'One side empty',
      `${which} is empty; ${other} has content.`,
    );
  }
  if (normLineEndings(a) === normLineEndings(b)) {
    return verdict(
      'line-endings',
      'Line endings only',
      'The text is identical except for line-ending style (LF vs CRLF vs CR).',
    );
  }
  // Checked before whitespace because JS `\s` matches U+FEFF (BOM), which would
  // otherwise mislabel a BOM/zero-width difference as "whitespace only".
  if (stripInvisibles(a) === stripInvisibles(b)) {
    return verdict(
      'invisibles',
      'Invisible chars only',
      'Identical except for invisible formatting characters — zero-width spaces, joiners, BOM, soft hyphen, or bidi controls.',
    );
  }
  if (collapseWhitespace(a) === collapseWhitespace(b)) {
    return verdict(
      'whitespace',
      'Whitespace only',
      'The visible text is identical; only whitespace differs — spaces, tabs, non-breaking spaces, or line endings.',
    );
  }
  if (foldCase(a) === foldCase(b)) {
    return verdict('case', 'Letter case only', 'The text is identical except for letter case.');
  }
  if (toNFC(a) === toNFC(b)) {
    return verdict(
      'nfc',
      'Unicode form only',
      'Different at the code-point level, but canonically equivalent — equal after Unicode NFC normalization.',
    );
  }
  if (foldHomoglyphs(a) === foldHomoglyphs(b)) {
    return verdict(
      'homoglyph',
      'Look-alike letters',
      'Identical except for homoglyph letters — characters from another script (Cyrillic/Greek) that mimic Latin ones. A common spoofing trick.',
    );
  }
  if (foldTypographicPunctuation(a) === foldTypographicPunctuation(b)) {
    return verdict(
      'punctuation',
      'Punctuation only',
      'Identical except for typographic punctuation — curly vs straight quotes, dashes, and similar look-alikes.',
    );
  }
  if (applySubset(a, COSMETIC) === applySubset(b, COSMETIC)) {
    const dims = COSMETIC.filter((t) => {
      const others = COSMETIC.filter((x) => x !== t);
      return applySubset(a, others) !== applySubset(b, others);
    }).map((t) => t.dim);
    const labels = dims.map((d) => DIM_LABEL[d]);
    return verdict(
      'cosmetic',
      'Cosmetic only',
      `Identical except for cosmetic differences: ${joinList(labels)}.`,
      dims,
    );
  }
  return verdict(
    'different',
    'Different content',
    'The inputs differ in their actual content — see the comparison below.',
  );
}

// ── Subtle findings ──────────────────────────────────────────────────────────

export interface SubtleResult {
  findings: SubtleFinding[];
  capped: boolean;
  skipped: boolean;
}

interface Occurrence {
  aOffset?: number;
  bOffset?: number;
}

interface Bucket {
  kind: SubtleKind;
  aCp?: number;
  bCp?: number;
  aText?: string;
  bText?: string;
  side?: 'a' | 'b';
  occ: Occurrence[];
}

function isBlankGrapheme(value: string): boolean {
  return /^\s+$/u.test(value);
}

function hasLineTerminator(value: string): boolean {
  return value.includes('\n') || value.includes('\r');
}

function singleCodePoint(value: string): number | null {
  const cp = value.codePointAt(0);
  if (cp === undefined) return null;
  const width = cp > 0xffff ? 2 : 1;
  return value.length === width ? cp : null;
}

/**
 * Locate the subtle differences between A and B. Runs a grapheme diff and
 * classifies each small change (1:1 replaces and pure whitespace/invisible
 * insertions/deletions) into a human-facing family. Returns `skipped` when the
 * input is too large, and suppresses findings entirely when the inputs are only
 * loosely related (see `SIMILARITY_SHOW`).
 */
export function extractSubtleFindings(a: string, b: string, kind: VerdictKind): SubtleResult {
  if (a === b) return { findings: [], capped: false, skipped: false };

  const aTokens = tokenizeGraphemes(a);
  const bTokens = tokenizeGraphemes(b);
  if (aTokens.length > SUBTLE_CHAR_LIMIT || bTokens.length > SUBTLE_CHAR_LIMIT) {
    return { findings: [], capped: false, skipped: true };
  }

  const aKeys = aTokens.map((t) => t.value);
  const bKeys = bTokens.map((t) => t.value);
  const { ops } = diffKeys(aKeys, bKeys);

  // Similarity gate: count equal graphemes.
  let equalCount = 0;
  for (const op of ops) if (op === 'equal') equalCount++;
  const denom = Math.max(aTokens.length, bTokens.length, 1);
  const similarity = equalCount / denom;
  if (kind === 'different' && similarity < SIMILARITY_SHOW) {
    return { findings: [], capped: false, skipped: false };
  }

  const buckets = new Map<string, Bucket>();
  const bump = (key: string, seed: Omit<Bucket, 'occ'>, occ: Occurrence) => {
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { ...seed, occ: [] };
      buckets.set(key, bucket);
    }
    bucket.occ.push(occ);
  };

  let ai = 0;
  let bi = 0;
  let i = 0;
  while (i < ops.length) {
    if (ops[i] === 'equal') {
      ai++;
      bi++;
      i++;
      continue;
    }
    const dels: Token[] = [];
    const ins: Token[] = [];
    while (i < ops.length && ops[i] !== 'equal') {
      if (ops[i] === 'delete') dels.push(aTokens[ai++]!);
      else ins.push(bTokens[bi++]!);
      i++;
    }
    classifyRun(dels, ins, bump);
  }

  const aIndex = new LineIndex(a);
  const bIndex = new LineIndex(b);
  const findings: SubtleFinding[] = [];
  let capped = false;

  const lineEnding = lineEndingFinding(a, b);
  if (lineEnding) findings.push(lineEnding);

  for (const bucket of buckets.values()) {
    const built = buildFinding(bucket, aIndex, bIndex);
    if (built.examplesTruncated) capped = true;
    findings.push(built);
  }

  findings.sort((x, y) => {
    const bySev = severityRank(y.severity) - severityRank(x.severity);
    if (bySev !== 0) return bySev;
    if (y.count !== x.count) return y.count - x.count;
    return x.title.localeCompare(y.title);
  });

  return { findings, capped, skipped: false };
}

function severityRank(severity: SubtleSeverity): number {
  return severity === 'warning' ? 2 : severity === 'notice' ? 1 : 0;
}

function classifyRun(
  dels: Token[],
  ins: Token[],
  bump: (key: string, seed: Omit<Bucket, 'occ'>, occ: Occurrence) => void,
): void {
  // Invisible characters anywhere in the run are always worth surfacing.
  const sigDels: Token[] = [];
  const sigIns: Token[] = [];
  for (const token of dels) {
    const cp = singleCodePoint(token.value);
    if (cp !== null && isStrippableInvisible(cp)) {
      bump(
        `invisible|a|${cp}`,
        { kind: 'invisible', side: 'a', aCp: cp, aText: token.value },
        { aOffset: token.start },
      );
    } else {
      sigDels.push(token);
    }
  }
  for (const token of ins) {
    const cp = singleCodePoint(token.value);
    if (cp !== null && isStrippableInvisible(cp)) {
      bump(
        `invisible|b|${cp}`,
        { kind: 'invisible', side: 'b', bCp: cp, bText: token.value },
        { bOffset: token.start },
      );
    } else {
      sigIns.push(token);
    }
  }

  // Aligned replaces: an equal-length del/ins run pairs up 1:1, so adjacent
  // subtle differences (two homoglyphs in a row, a curly-quote pair, a
  // tab-vs-spaces indent) are each classified. classifyReplace only emits for a
  // genuinely subtle pair, so a run that is really content stays silent.
  if (sigDels.length === sigIns.length && sigDels.length >= 1) {
    for (let i = 0; i < sigDels.length; i++) {
      classifyReplace(sigDels[i]!, sigIns[i]!, bump);
    }
    return;
  }
  // Pure whitespace insertion/deletion (e.g. trailing spaces) — but not line
  // terminators, which get their own dedicated finding.
  if (
    sigDels.length === 0 &&
    sigIns.length >= 1 &&
    sigIns.every((t) => isBlankGrapheme(t.value) && !hasLineTerminator(t.value))
  ) {
    for (const token of sigIns) {
      const cp = token.value.codePointAt(0)!;
      bump(
        `ws-indel|b|${cp}`,
        { kind: 'whitespace', side: 'b', bCp: cp, bText: token.value },
        { bOffset: token.start },
      );
    }
    return;
  }
  if (
    sigIns.length === 0 &&
    sigDels.length >= 1 &&
    sigDels.every((t) => isBlankGrapheme(t.value) && !hasLineTerminator(t.value))
  ) {
    for (const token of sigDels) {
      const cp = token.value.codePointAt(0)!;
      bump(
        `ws-indel|a|${cp}`,
        { kind: 'whitespace', side: 'a', aCp: cp, aText: token.value },
        { aOffset: token.start },
      );
    }
    return;
  }
  // A single confusable that expands to (or contracts from) its ASCII sequence —
  // the classic ellipsis character vs "..." — where the two sides are otherwise
  // look-alikes rather than genuinely different content.
  if (sigDels.length === 1 && sigIns.length >= 1) {
    const dv = sigDels[0]!.value;
    const joined = sigIns.map((t) => t.value).join('');
    if (dv !== joined && foldConfusables(dv) === joined) {
      const cp0 = dv.codePointAt(0)!;
      bump(
        `punct-expand|a|${cp0}`,
        { kind: 'punctuation', aCp: cp0, aText: dv, bText: joined },
        { aOffset: sigDels[0]!.start, bOffset: sigIns[0]!.start },
      );
      return;
    }
  }
  if (sigIns.length === 1 && sigDels.length >= 1) {
    const sv = sigIns[0]!.value;
    const joined = sigDels.map((t) => t.value).join('');
    if (sv !== joined && foldConfusables(sv) === joined) {
      const cp0 = sv.codePointAt(0)!;
      bump(
        `punct-expand|b|${cp0}`,
        { kind: 'punctuation', bCp: cp0, aText: joined, bText: sv },
        { aOffset: sigDels[0]!.start, bOffset: sigIns[0]!.start },
      );
      return;
    }
  }
  // Otherwise: genuine multi-character content change — not a subtle difference.
}

function classifyReplace(
  del: Token,
  ins: Token,
  bump: (key: string, seed: Omit<Bucket, 'occ'>, occ: Occurrence) => void,
): void {
  const dv = del.value;
  const sv = ins.value;
  if (dv === sv) return;
  const occ: Occurrence = { aOffset: del.start, bOffset: ins.start };

  // Whitespace look-alikes (space vs NBSP, tab vs space) — line terminators excluded.
  if (
    isBlankGrapheme(dv) &&
    isBlankGrapheme(sv) &&
    !hasLineTerminator(dv) &&
    !hasLineTerminator(sv)
  ) {
    const aCp = dv.codePointAt(0)!;
    const bCp = sv.codePointAt(0)!;
    bump(`ws|${aCp}|${bCp}`, { kind: 'whitespace', aCp, bCp, aText: dv, bText: sv }, occ);
    return;
  }
  // Same rendering, different code points (precomposed vs combining).
  if (dv.normalize('NFC') === sv.normalize('NFC')) {
    bump(`nfc|${dv}|${sv}`, { kind: 'normalization', aText: dv, bText: sv }, occ);
    return;
  }
  // Same letter, different case.
  if (foldCase(dv) === foldCase(sv)) {
    bump(`case|${dv}|${sv}`, { kind: 'case', aText: dv, bText: sv }, occ);
    return;
  }
  // Confusable look-alikes (curly/straight, dashes) and homoglyph letters.
  const dcp = singleCodePoint(dv);
  const scp = singleCodePoint(sv);
  if (dcp !== null && scp !== null && foldConfusables(dv) === foldConfusables(sv)) {
    const category = classify(dcp)?.category ?? classify(scp)?.category;
    const kind: SubtleKind = category === 'confusable-letter' ? 'homoglyph' : 'punctuation';
    bump(`${kind}|${dcp}|${scp}`, { kind, aCp: dcp, bCp: scp, aText: dv, bText: sv }, occ);
    return;
  }
  // Otherwise: a genuine single-character content change — not subtle.
}

function locate(occ: Occurrence, aIndex: LineIndex, bIndex: LineIndex): SubtlePosition {
  const position: SubtlePosition = {};
  if (occ.aOffset !== undefined) {
    const at = aIndex.locate(occ.aOffset);
    position.aLine = at.line;
    position.aColumn = at.column;
  }
  if (occ.bOffset !== undefined) {
    const at = bIndex.locate(occ.bOffset);
    position.bLine = at.line;
    position.bColumn = at.column;
  }
  return position;
}

function buildFinding(bucket: Bucket, aIndex: LineIndex, bIndex: LineIndex): SubtleFinding {
  const count = bucket.occ.length;
  const shown = bucket.occ.slice(0, EXAMPLE_CAP);
  const examples: SubtlePosition[] = shown.map((occ) => {
    const position = locate(occ, aIndex, bIndex);
    if (bucket.aText !== undefined) {
      position.aText = bucket.aText;
      position.aCodePoint = bucket.aCp;
      position.aName = bucket.aCp !== undefined ? describeCodePoint(bucket.aCp).name : undefined;
    }
    if (bucket.bText !== undefined) {
      position.bText = bucket.bText;
      position.bCodePoint = bucket.bCp;
      position.bName = bucket.bCp !== undefined ? describeCodePoint(bucket.bCp).name : undefined;
    }
    return position;
  });

  const { title, detail, why } = describeBucket(bucket, count);
  return {
    id: bucketId(bucket),
    kind: bucket.kind,
    severity: SEVERITY[bucket.kind],
    title,
    detail,
    why,
    count,
    examples,
    examplesTruncated: count > shown.length,
  };
}

function bucketId(bucket: Bucket): string {
  return `${bucket.kind}-${bucket.side ?? ''}-${bucket.aCp ?? ''}-${bucket.bCp ?? ''}-${bucket.aText ?? ''}-${bucket.bText ?? ''}`;
}

const SIDE_LABEL = { a: 'A / Before', b: 'B / After' } as const;

function describeBucket(
  bucket: Bucket,
  count: number,
): { title: string; detail: string; why: string } {
  const occurrences = `${count.toLocaleString()} ${count === 1 ? 'place' : 'places'}`;
  switch (bucket.kind) {
    case 'whitespace': {
      if (bucket.side) {
        const label = SIDE_LABEL[bucket.side];
        const d = describeCodePoint(bucket.side === 'a' ? bucket.aCp! : bucket.bCp!);
        return {
          title: `Extra whitespace in ${bucket.side === 'a' ? 'A' : 'B'}`,
          detail: `${label} has ${d.name} (${d.label}) in ${occurrences} where the other side has nothing — often leading or trailing whitespace that is invisible on screen.`,
          why: 'Whitespace-only differences read identically but break exact matches, hashes, and “why aren’t these the same?” comparisons.',
        };
      }
      const a = describeCodePoint(bucket.aCp!);
      const b = describeCodePoint(bucket.bCp!);
      return {
        title: `${a.name} vs ${b.name}`,
        detail: `A uses ${a.name} (${a.label}) where B uses ${b.name} (${b.label}), in ${occurrences}. They occupy the same space but are different characters.`,
        why: 'Non-breaking spaces, tabs, and other Unicode spaces look like an ordinary space but fail exact equality and search.',
      };
    }
    case 'invisible': {
      const label = SIDE_LABEL[bucket.side ?? 'b'];
      const d = describeCodePoint(
        (bucket.side === 'a' ? bucket.aCp : bucket.bCp) ?? bucket.aCp ?? bucket.bCp!,
      );
      return {
        title: `${d.name} in ${bucket.side === 'a' ? 'A' : 'B'} only`,
        detail: `${label} contains ${d.name} (${d.label}) in ${occurrences} that the other side does not. It paints no ink, so the two look identical.`,
        why: 'Zero-width and other invisible characters can hide watermarks, break copy-paste, or smuggle instructions — worth knowing are there.',
      };
    }
    case 'punctuation': {
      const aName =
        bucket.aCp !== undefined ? describeCodePoint(bucket.aCp).name : `“${bucket.aText}”`;
      const aLabel = bucket.aCp !== undefined ? ` (${describeCodePoint(bucket.aCp).label})` : '';
      const bName =
        bucket.bCp !== undefined ? describeCodePoint(bucket.bCp).name : `“${bucket.bText}”`;
      const bLabel = bucket.bCp !== undefined ? ` (${describeCodePoint(bucket.bCp).label})` : '';
      return {
        title: `${aName} vs ${bName}`,
        detail: `A uses ${aName}${aLabel} where B uses ${bName}${bLabel}, in ${occurrences} — visually similar, technically different.`,
        why: 'Typographic punctuation (curly quotes, en/em dashes, the ellipsis character) mimics ASCII but is distinct — a frequent “why won’t this match?”.',
      };
    }
    case 'homoglyph': {
      const a = describeCodePoint(bucket.aCp!);
      const b = describeCodePoint(bucket.bCp!);
      return {
        title: `Homoglyph: ${a.name} vs ${b.name}`,
        detail: `A has ${a.name} (${a.label}) where B has ${b.name} (${b.label}), in ${occurrences}; one is a look-alike letter from another script.`,
        why: 'Homoglyphs (Cyrillic/Greek letters that mimic Latin) are the basis of spoofed names, domains, and identifiers.',
      };
    }
    case 'case': {
      return {
        title: 'Letter case',
        detail: `A has “${bucket.aText}” where B has “${bucket.bText}”, in ${occurrences} — the same letter in different case.`,
        why: 'A case-only change is easy to miss and matters for identifiers, codes, and case-sensitive systems.',
      };
    }
    case 'normalization': {
      return {
        title: 'Different Unicode representation',
        detail: `In ${occurrences}, A and B use different code-point sequences that render identically and are equal under NFC (for example a precomposed accent vs a base letter plus a combining mark).`,
        why: 'Canonically-equivalent text looks and usually behaves the same, but fails byte and code-point equality.',
      };
    }
    case 'line-ending':
    default:
      return { title: '', detail: '', why: '' };
  }
}

function styleWord(counts: LineEndingCounts): string {
  if (counts.total === 0) return 'no line breaks';
  if (counts.mixed) {
    const parts: string[] = [];
    if (counts.crlf) parts.push(`CRLF ×${counts.crlf}`);
    if (counts.lf) parts.push(`LF ×${counts.lf}`);
    if (counts.cr) parts.push(`CR ×${counts.cr}`);
    return `mixed line endings (${parts.join(', ')})`;
  }
  const style = counts.dominant === 'crlf' ? 'CRLF' : counts.dominant === 'cr' ? 'CR' : 'LF';
  return `${style} (${counts.total} line ${counts.total === 1 ? 'break' : 'breaks'})`;
}

/** The set of terminator styles a side actually uses, as a canonical signature. */
function stylesUsed(counts: LineEndingCounts): string {
  return [counts.crlf > 0 ? 'crlf' : '', counts.lf > 0 ? 'lf' : '', counts.cr > 0 ? 'cr' : '']
    .filter(Boolean)
    .join(',');
}

/** A dedicated finding for line-ending style differences, when they differ. */
function lineEndingFinding(a: string, b: string): SubtleFinding | null {
  const la = computeLineEndings(a);
  const lb = computeLineEndings(b);
  // Fire only when the SET of line-ending styles genuinely differs (e.g. LF vs
  // CRLF) and both sides actually have line breaks. A changed line *count* under
  // one shared style — a blank line added, or a trailing-newline change — is a
  // content difference the diff already shows, not a line-ending style change.
  if (la.total === 0 || lb.total === 0 || stylesUsed(la) === stylesUsed(lb)) return null;

  // Count lines whose terminator differs, when the line structure lines up.
  const examples: SubtlePosition[] = [];
  let differingLines = 0;
  const linesA = tokenizeLines(a);
  const linesB = tokenizeLines(b);
  if (linesA.length === linesB.length) {
    for (let i = 0; i < linesA.length; i++) {
      if (linesA[i]!.terminator !== linesB[i]!.terminator) {
        differingLines++;
        if (examples.length < EXAMPLE_CAP) {
          examples.push({
            aLine: i + 1,
            bLine: i + 1,
            note: `${termLabel(linesA[i]!.terminator)} → ${termLabel(linesB[i]!.terminator)}`,
          });
        }
      }
    }
  }

  const count = differingLines || Math.max(la.total, lb.total);
  return {
    id: 'line-ending',
    kind: 'line-ending',
    severity: SEVERITY['line-ending'],
    title: 'Line-ending style differs',
    detail: `A ${styleWord(la)}; B ${styleWord(lb)}${differingLines ? `, differing on ${differingLines} ${differingLines === 1 ? 'line' : 'lines'}` : ''}.`,
    why: 'Line endings (LF vs CRLF vs CR) are invisible on screen but change the file’s bytes, its diffs, and how some parsers read it.',
    count,
    examples,
    examplesTruncated: differingLines > examples.length,
  };
}

function termLabel(terminator: Token['terminator']): string {
  switch (terminator) {
    case 'crlf':
      return 'CRLF';
    case 'cr':
      return 'CR';
    case 'lf':
      return 'LF';
    default:
      return 'none';
  }
}
