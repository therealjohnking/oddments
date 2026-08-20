/**
 * A copyable, plain-text diagnostic summary — the "what did this actually do?"
 * you can paste into a bug report or a code review. Deterministic and local; it
 * restates only what the engine found.
 */

import { toRegexLiteral } from './export';
import type { CompileOk, Diagnostic, MatchRecord, MatchResult } from './types';

export interface SummaryInput {
  compile: CompileOk;
  matches: MatchResult;
  diagnostics: Diagnostic[];
}

function describeMatch(m: MatchRecord): string {
  const where = `[${m.start}, ${m.end})`;
  const empty = m.empty ? ' (zero-width)' : '';
  const groups = m.groups.length
    ? '\n' +
      m.groups
        .map((g) => {
          const label = g.name ? `$${g.number} <${g.name}>` : `$${g.number}`;
          const value = g.value === null ? '(unmatched)' : JSON.stringify(g.value);
          return `    ${label} = ${value}`;
        })
        .join('\n')
    : '';
  return `  #${m.ordinal} ${where}${empty} ${JSON.stringify(m.value)}${groups}`;
}

export function toDiagnosticSummary(input: SummaryInput): string {
  const { compile, matches, diagnostics } = input;
  const lines: string[] = [];
  lines.push('Regex Workbench — JavaScript / ECMAScript RegExp');
  lines.push(`Pattern: ${toRegexLiteral(compile.source, compile.flags)}`);
  lines.push(
    `Flags: ${compile.flags || '(none)'} · groups: ${compile.groupCount}` +
      (compile.groupNames.length ? ` · named: ${compile.groupNames.join(', ')}` : ''),
  );

  if (matches.status === 'timeout') {
    lines.push('Matching: stopped by the safety timeout (possible heavy backtracking).');
  } else {
    const total = matches.truncated
      ? `${matches.matches.length}+ (truncated)`
      : `${matches.matches.length}`;
    lines.push(`Matches: ${total}`);
    const shown = matches.matches.slice(0, 20);
    for (const m of shown) lines.push(describeMatch(m));
    if (matches.matches.length > shown.length) {
      lines.push(`  … and ${matches.matches.length - shown.length} more`);
    }
  }

  if (diagnostics.length) {
    lines.push('Diagnostics:');
    for (const d of diagnostics) lines.push(`  [${d.severity}] ${d.title} — ${d.detail}`);
  }

  lines.push('Positions are UTF-16 code-unit offsets.');
  return lines.join('\n');
}
