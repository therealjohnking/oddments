/**
 * A copyable plain-text diagnostic summary of one interpretation. Unlike the
 * other tools' reports (which describe an analysis of user data), here the value
 * *is* the point, so the summary includes it — the user asked to copy their own
 * date's interpretation. Everything is generated locally.
 */

import { formatOffset } from './format';
import type { Interpretation } from './interpret';

const SEVERITY_LABEL = { warning: 'WARNING', notice: 'NOTICE', info: 'INFO' } as const;

/** Render an interpretation as a compact diagnostic summary. */
export function toDiagnosticSummary(interp: Interpretation): string {
  if (interp.status === 'empty') return 'Date Goblin: nothing to interpret.';
  if (interp.status === 'error') {
    return `Date Goblin: could not interpret input.\n${interp.error.message}${interp.error.hint ? `\nHint: ${interp.error.hint}` : ''}`;
  }
  if (interp.status === 'ambiguous') {
    const lines = [`Date Goblin: ambiguous input.`, interp.message];
    for (const c of interp.candidates) lines.push(`- ${c.label}: ${c.preview}`);
    if (interp.hint) lines.push(`Hint: ${interp.hint}`);
    return lines.join('\n');
  }

  const lines: string[] = ['Date Goblin — interpretation', ''];
  lines.push(`Recognized: ${interp.recognition.summary}`);
  lines.push(`Kind: ${interp.sourceKind === 'instant' ? 'instant' : 'local wall time'}`);
  if (interp.chosen) lines.push(`Selected interpretation: ${interp.chosen}`);
  lines.push('');

  lines.push('Instant');
  lines.push(`- ISO 8601 (UTC): ${interp.instant.iso}`);
  lines.push(`- Unix seconds: ${interp.epochSecondsText}`);
  lines.push(`- Unix milliseconds: ${interp.instant.epochMilliseconds}`);
  lines.push(`- Epoch nanoseconds: ${interp.instant.epochNanoseconds}`);
  lines.push('');

  lines.push('Across zones');
  for (const row of interp.zones) {
    const roles = row.roles.join(', ');
    lines.push(`- ${row.reading.zoneId} (${roles}): ${row.reading.iso}`);
  }
  lines.push('');

  const f = interp.facts;
  lines.push(`Calendar facts (in ${f.zoneId})`);
  lines.push(`- ${f.weekdayName}, ${f.monthName} ${f.day}, ${f.year}`);
  lines.push(`- Day of year: ${f.dayOfYear}`);
  lines.push(`- ISO week: ${f.isoWeek} of week-year ${f.isoWeekYear}`);
  lines.push(`- Quarter: Q${f.quarter}`);
  lines.push(`- Leap year: ${f.leapYear ? 'yes' : 'no'}; days in month: ${f.daysInMonth}`);
  lines.push('');

  const o = interp.offsetInfo;
  lines.push(
    `Offset in ${o.zoneId}: ${formatOffset(o.offsetMinutes)}${o.abbreviation ? ` (${o.abbreviation})` : ''}`,
  );
  lines.push(
    `Daylight saving: ${
      o.dst === 'daylight'
        ? `in effect (+${o.dstShiftMinutes} min over standard)`
        : o.dst === 'standard'
          ? 'not in effect (standard time)'
          : o.dst === 'fixed'
            ? 'zone has no DST'
            : 'undetermined'
    }`,
  );

  if (interp.findings.length > 0) {
    lines.push('');
    lines.push('Notes');
    for (const finding of interp.findings) {
      lines.push(`- [${SEVERITY_LABEL[finding.severity]}] ${finding.title}: ${finding.detail}`);
    }
  }

  return lines.join('\n').trimEnd() + '\n';
}
