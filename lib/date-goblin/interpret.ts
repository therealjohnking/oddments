/**
 * The top-level orchestration: raw text + options → one `Interpretation` the UI
 * can render. It composes the focused engine modules (parse → resolve → describe)
 * and centralises the instant-vs-local model so React never has to.
 *
 * Fold/gap selections are inputs, not hidden state: for an ambiguous or
 * nonexistent local time the caller passes which interpretation it means, and the
 * default is always explicit and explained (never a silent coercion).
 */

import { calendarFacts } from './calendar';
import { readInstant } from './core';
import { parseInput } from './parse';
import { rangeInfo } from './range';
import { relativeTime } from './relative';
import { resolveWallTime } from './resolve';
import { epochSecondsDecimal } from './format';
import { isValidZone, systemZone, UTC, zoneOffsetInfo } from './zones';
import { SEVERITY_RANK } from './types';
import type {
  AmbiguityCandidate,
  CalendarFacts,
  Finding,
  Instant,
  InputMode,
  ParseError,
  Recognition,
  RangeInfo,
  RelativeTime,
  Resolution,
  SourceKind,
  UnixUnit,
  ExcelSystem,
  ZonedReading,
  ZoneOffsetInfo,
} from './types';

export type FoldChoice = 'earlier' | 'later';
export type GapChoice = 'before' | 'after';

export interface InterpretOptions {
  mode: InputMode;
  /** The zone to interpret a wall time in (local) or primarily display in (instant). */
  zone: string;
  /** Extra zones for the comparison table (bounded by the UI). */
  comparisonZones?: string[];
  unixUnit?: UnixUnit;
  excelSystem?: ExcelSystem;
  /** Which side of a fall-back fold to select (default `earlier`). */
  foldChoice?: FoldChoice;
  /** Which side of a spring-forward gap to select (default `after`). */
  gapChoice?: GapChoice;
  /** Epoch-ms "now" for relative time; omit/null to skip relative time. */
  nowMs?: number | null;
  /** Override the system zone (tests). Defaults to the browser's zone. */
  systemZone?: string;
}

/** One row of the cross-zone table, with the roles that zone plays. */
export interface ZoneRow {
  reading: ZonedReading;
  roles: ('utc' | 'system' | 'primary' | 'comparison')[];
}

export type Interpretation =
  | { status: 'empty' }
  | { status: 'ambiguous'; message: string; candidates: AmbiguityCandidate[]; hint?: string }
  | { status: 'error'; error: ParseError }
  | {
      status: 'ok';
      recognition: Recognition;
      sourceKind: SourceKind;
      /** Resolution for local inputs; `null` for instant inputs. */
      resolution: Resolution | null;
      /** Which fold/gap side is currently selected, if any. */
      chosen: FoldChoice | GapChoice | null;
      /** The selected instant. */
      instant: Instant;
      /** Exact epoch-seconds as a decimal string (no invented precision). */
      epochSecondsText: string;
      /** The primary interpret/display zone. */
      primaryZone: string;
      /** Facts computed in the primary zone. */
      facts: CalendarFacts;
      /** Offset / DST context in the primary zone. */
      offsetInfo: ZoneOffsetInfo;
      range: RangeInfo;
      /** UTC, system, primary, and comparison zones (deduped, ordered). */
      zones: ZoneRow[];
      /** Relative-to-now phrase, if a `nowMs` was supplied. */
      relative: RelativeTime | null;
      /** Secondary explanations (assumptions, DST, precision, quirks). */
      findings: Finding[];
    };

function buildZoneRows(
  instant: Instant,
  utc: string,
  system: string,
  primary: string,
  comparison: string[],
): ZoneRow[] {
  const wanted: { id: string; role: ZoneRow['roles'][number] }[] = [
    { id: utc, role: 'utc' },
    { id: system, role: 'system' },
    { id: primary, role: 'primary' },
    ...comparison.map((id) => ({ id, role: 'comparison' as const })),
  ];
  const rows = new Map<string, ZoneRow>();
  const order: string[] = [];
  for (const { id, role } of wanted) {
    if (!isValidZone(id)) continue;
    let row = rows.get(id);
    if (!row) {
      row = { reading: readInstant(instant, id).reading, roles: [] };
      rows.set(id, row);
      order.push(id);
    }
    if (!row.roles.includes(role)) row.roles.push(role);
  }
  return order.map((id) => rows.get(id)!);
}

interface FindingContext {
  recognition: Recognition;
  resolution: Resolution | null;
  chosen: FoldChoice | GapChoice | null;
  instant: Instant;
  facts: CalendarFacts;
  sourceKind: SourceKind;
  primaryZone: string;
}

function buildFindings(ctx: FindingContext): Finding[] {
  const findings: Finding[] = [];
  const { recognition, resolution, instant, facts, sourceKind, primaryZone } = ctx;

  // Always clarify the instant-vs-local distinction — the tool's central idea.
  if (sourceKind === 'instant') {
    findings.push({
      id: 'kind-instant',
      severity: 'info',
      category: 'instant-vs-local',
      title: 'This input is an instant',
      detail:
        recognition.sourceOffset !== undefined
          ? `It pins one exact moment on the global timeline (offset ${recognition.sourceOffset}). Changing the zone only changes how that same moment is displayed.`
          : 'It pins one exact moment on the global timeline. Changing the zone only changes how that same moment is displayed.',
    });
  } else {
    findings.push({
      id: 'kind-local',
      severity: 'info',
      category: 'instant-vs-local',
      title: 'This input is a local (wall-clock) time',
      detail: `On its own it is just a clock reading; the time zone decides which instant it is. Interpreted in ${primaryZone}.`,
    });
  }

  // DST fold / gap.
  if (resolution?.kind === 'ambiguous') {
    const other = ctx.chosen === 'later' ? resolution.earlier : resolution.later;
    findings.push({
      id: 'dst-fold',
      severity: 'warning',
      category: 'dst',
      title: 'Ambiguous local time (fall-back)',
      detail: `This wall-clock time occurs twice in ${primaryZone} because clocks fall back ${resolution.shiftMinutes} minutes. The other interpretation is ${other.reading.iso} (offset ${other.reading.offset}).`,
    });
  } else if (resolution?.kind === 'gap') {
    const other = ctx.chosen === 'before' ? resolution.after : resolution.before;
    findings.push({
      id: 'dst-gap',
      severity: 'warning',
      category: 'dst',
      title: 'Nonexistent local time (spring-forward)',
      detail: `This wall-clock time was skipped in ${primaryZone}: clocks jumped ${resolution.gapStartLabel} → ${resolution.gapEndLabel} (${resolution.gapMinutes} minutes). The other nearest reading is ${other.reading.iso} (offset ${other.reading.offset}).`,
    });
  }

  // Recognition assumptions (unit / excel / date-only / zoneless).
  if (recognition.unixUnit && recognition.assumption) {
    findings.push({
      id: 'unit-assumed',
      severity: 'info',
      category: 'unit',
      title: 'Unix unit',
      detail: recognition.assumption,
    });
  } else if (recognition.excelSystem && recognition.assumption) {
    findings.push({
      id: 'excel-note',
      severity: recognition.assumption.includes('shifted') ? 'notice' : 'info',
      category: 'excel',
      title: `Excel ${recognition.excelSystem} date system`,
      detail: recognition.assumption,
    });
  } else if (recognition.assumption) {
    findings.push({
      id: 'assumption',
      severity: 'info',
      category: 'assumption',
      title: 'Assumption made',
      detail: recognition.assumption,
    });
  }

  // Sub-second precision.
  if (instant.hasSubsecond) {
    findings.push({
      id: 'precision',
      severity: 'info',
      category: 'precision',
      title: 'Sub-second precision preserved',
      detail: `This value carries sub-second precision (${epochSecondsDecimal(instant.epochNanoseconds)} s). It is kept exactly and not rounded.`,
    });
  }

  // Unusual year range (still supported, worth noting).
  if (facts.year < 1 || facts.year > 9999) {
    findings.push({
      id: 'range',
      severity: 'notice',
      category: 'range',
      title: 'Outside the usual year range',
      detail: `The year (${facts.year}) is outside the ordinary four-digit range, but still within the supported ±10⁸-day window.`,
    });
  }

  findings.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
  return findings;
}

/** Interpret raw input under the given options into a complete `Interpretation`. */
export function interpret(raw: string, options: InterpretOptions): Interpretation {
  const system =
    options.systemZone && isValidZone(options.systemZone) ? options.systemZone : systemZone();
  const zone = options.zone && isValidZone(options.zone) ? options.zone : system;

  const parse = parseInput(raw, options.mode, {
    unixUnit: options.unixUnit,
    excelSystem: options.excelSystem,
  });

  if (parse.status === 'empty') return { status: 'empty' };
  if (parse.status === 'error') return { status: 'error', error: parse.error };
  if (parse.status === 'ambiguous') {
    return {
      status: 'ambiguous',
      message: parse.message,
      candidates: parse.candidates,
      hint: parse.hint,
    };
  }

  let resolution: Resolution | null = null;
  let instant: Instant;
  let chosen: FoldChoice | GapChoice | null = null;
  const sourceKind: SourceKind = parse.status === 'instant' ? 'instant' : 'local';

  if (parse.status === 'instant') {
    instant = parse.instant;
  } else {
    try {
      resolution = resolveWallTime(parse.wall, zone);
    } catch {
      return {
        status: 'error',
        error: {
          code: 'out-of-range',
          message: 'That wall-clock time is outside the supported date range in this zone.',
        },
      };
    }
    if (resolution.kind === 'unique') {
      instant = resolution.reading.instant;
    } else if (resolution.kind === 'ambiguous') {
      const choice: FoldChoice = options.foldChoice ?? 'earlier';
      instant = (choice === 'later' ? resolution.later : resolution.earlier).instant;
      chosen = choice;
    } else {
      const choice: GapChoice = options.gapChoice ?? 'after';
      instant = (choice === 'before' ? resolution.before : resolution.after).instant;
      chosen = choice;
    }
  }

  const facts = calendarFacts(instant, zone);
  const offsetInfo = zoneOffsetInfo(instant, zone);
  const range = rangeInfo(instant);
  const relative = options.nowMs != null ? relativeTime(instant, options.nowMs) : null;
  const zones = buildZoneRows(instant, UTC, system, zone, options.comparisonZones ?? []);
  const findings = buildFindings({
    recognition: parse.recognition,
    resolution,
    chosen,
    instant,
    facts,
    sourceKind,
    primaryZone: zone,
  });

  return {
    status: 'ok',
    recognition: parse.recognition,
    sourceKind,
    resolution,
    chosen,
    instant,
    epochSecondsText: epochSecondsDecimal(instant.epochNanoseconds),
    primaryZone: zone,
    facts,
    offsetInfo,
    range,
    zones,
    relative,
    findings,
  };
}
