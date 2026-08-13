import type { Finding, SlopCategoryId } from '@/lib/slopometer';

/** A single flagged span, flattened from a finding's evidence. */
export interface EvidenceItem {
  id: string;
  ruleId: string;
  category: SlopCategoryId;
  title: string;
  start: number;
  end: number;
  note?: string;
}

/** A renderable run of the annotated text: plain, or a highlighted mark. */
export type AnnotatedSegment =
  { kind: 'text'; text: string } | { kind: 'mark'; text: string; item: EvidenceItem };

/**
 * Flatten every finding's evidence into a single list of non-overlapping spans,
 * ordered by position. Where two spans overlap (rare — e.g. a contrast template
 * that contains a jargon word), the earlier/longer one wins and the other is
 * dropped, so the annotated text never double-marks a character.
 */
export function collectEvidence(findings: Finding[]): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  for (const finding of findings) {
    for (const ev of finding.evidence) {
      items.push({
        id: ev.id,
        ruleId: finding.ruleId,
        category: finding.category,
        title: finding.title,
        start: ev.start,
        end: ev.end,
        note: ev.note,
      });
    }
  }
  items.sort((a, b) => a.start - b.start || b.end - a.end);

  const resolved: EvidenceItem[] = [];
  let lastEnd = -1;
  for (const item of items) {
    if (item.start >= lastEnd) {
      resolved.push(item);
      lastEnd = item.end;
    }
  }
  return resolved;
}

export interface AnnotatedResult {
  segments: AnnotatedSegment[];
  truncated: boolean;
}

/**
 * Build the annotated segment list for `text`, marking each resolved evidence
 * span. Rendering is bounded to `maxChars` so a pathologically large paste can't
 * explode the DOM (the score and findings still cover the whole input).
 */
export function buildAnnotatedSegments(
  text: string,
  items: EvidenceItem[],
  maxChars: number,
): AnnotatedResult {
  const limit = Math.min(text.length, maxChars);
  const segments: AnnotatedSegment[] = [];
  let cursor = 0;

  for (const item of items) {
    if (item.start >= limit) break;
    if (item.start > cursor) {
      segments.push({ kind: 'text', text: text.slice(cursor, item.start) });
    }
    const end = Math.min(item.end, limit);
    if (end > item.start) {
      segments.push({ kind: 'mark', text: text.slice(item.start, end), item });
      cursor = end;
    }
  }
  if (cursor < limit) {
    segments.push({ kind: 'text', text: text.slice(cursor, limit) });
  }
  return { segments, truncated: text.length > limit };
}
