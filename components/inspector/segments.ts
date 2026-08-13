import {
  CATEGORY_META,
  formatCodePoint,
  type Analysis,
  type Finding,
  type LineInfo,
} from '@/lib/inspector';

/** A renderable piece of one line in the visual reveal. */
export type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'space'; count: number; trailing: boolean }
  | { kind: 'finding'; finding: Finding };

/**
 * Break a line into runs of plain text, marked spaces, and findings. Only the
 * flagged characters (and, optionally, ordinary spaces) become their own
 * elements — long normal runs stay as single text nodes so large inputs don't
 * explode the DOM.
 */
export function segmentLine(line: LineInfo, showSpaces: boolean): Segment[] {
  const base = line.startOffset;
  const text = line.text;
  const trailingStart = line.trailing ? line.trailing.offset - base : Number.POSITIVE_INFINITY;
  const findings = line.findings;

  const segments: Segment[] = [];
  let textBuf = '';
  let spaceRun = 0;
  let spaceTrailing = false;

  const flushText = () => {
    if (textBuf) {
      segments.push({ kind: 'text', text: textBuf });
      textBuf = '';
    }
  };
  const flushSpace = () => {
    if (spaceRun > 0) {
      segments.push({ kind: 'space', count: spaceRun, trailing: spaceTrailing });
      spaceRun = 0;
    }
  };

  let findingIndex = 0;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const nextFinding = findingIndex < findings.length ? findings[findingIndex] : undefined;
    if (nextFinding && nextFinding.offset - base === i) {
      flushText();
      flushSpace();
      segments.push({ kind: 'finding', finding: nextFinding });
      i += nextFinding.char.length;
      findingIndex += 1;
      continue;
    }

    const codePoint = text.codePointAt(i) ?? 0;
    const width = codePoint > 0xffff ? 2 : 1;

    if (text[i] === ' ') {
      const isTrailing = i >= trailingStart;
      if (isTrailing || showSpaces) {
        flushText();
        if (spaceRun > 0 && spaceTrailing !== isTrailing) flushSpace();
        spaceTrailing = isTrailing;
        spaceRun += 1;
      } else {
        flushSpace();
        textBuf += ' ';
      }
    } else {
      flushSpace();
      textBuf += text.slice(i, i + width);
    }
    i += width;
  }

  flushText();
  flushSpace();
  return segments;
}

/**
 * Build the "expanded text" reveal: a plain-text rendering where every notable
 * character becomes a readable bracket token. This is the most robust
 * representation for screen readers, verification, and copying.
 */
export function buildExpandedText(
  analysis: Analysis,
  showSpaces: boolean,
  maxLines: number,
): string {
  const out: string[] = [];
  const lines = analysis.lines.slice(0, maxLines);
  for (const line of lines) {
    for (const segment of segmentLine(line, showSpaces)) {
      if (segment.kind === 'text') {
        out.push(segment.text);
      } else if (segment.kind === 'space') {
        out.push(
          segment.trailing || showSpaces ? '[SP]'.repeat(segment.count) : ' '.repeat(segment.count),
        );
      } else {
        const finding = segment.finding;
        const meta = CATEGORY_META[finding.category];
        if (meta.render === 'annotate') {
          out.push(`${finding.char}(${formatCodePoint(finding.codePoint)})`);
        } else {
          out.push(`[${finding.abbr}]`);
        }
      }
    }
    if (line.terminator === 'lf') out.push('[LF]\n');
    else if (line.terminator === 'cr') out.push('[CR]\n');
    else if (line.terminator === 'crlf') out.push('[CRLF]\n');
  }
  return out.join('');
}
