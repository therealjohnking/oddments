/**
 * Public API for the Date Goblin engine — a local-first date/time interpretation
 * and conversion instrument.
 *
 * The pipeline is deliberately inspectable and side-effect-free:
 *   1. parse    — raw text → instant | local wall time | ambiguous | error
 *   2. resolve  — a wall time + zone → an instant, surfacing DST folds & gaps
 *   3. describe — instant → representations, zone table, calendar facts, findings
 *
 * `interpret()` composes all three. No network, no clock reads inside the pure
 * functions (relative time takes an explicit `nowMs`), and no Temporal object ever
 * crosses this boundary — every return value is plain, serialisable domain data.
 * The concrete temporal implementation lives behind `./temporal` and is prefered
 * native when the host provides it, else the `temporal-polyfill`.
 */

export { interpret } from './interpret';
export type { Interpretation, InterpretOptions, ZoneRow, FoldChoice, GapChoice } from './interpret';

export { parseInput } from './parse';
export type { ParseOptions } from './parse';
export { resolveWallTime } from './resolve';
export { parseUnix } from './unix';
export { parseExcel } from './excel';
export { calendarFacts, isoWeek } from './calendar';
export { relativeTime } from './relative';
export { toDiagnosticSummary } from './report';

export { allZones, systemZone, isValidZone, zoneOffsetInfo, COMMON_ZONES, UTC } from './zones';

export {
  MAX_EPOCH_MS,
  MIN_EPOCH_MS,
  MAX_EPOCH_NS,
  MIN_EPOCH_NS,
  nsInRange,
  msInRange,
  rangeInfo,
} from './range';

export {
  formatOffset,
  formatOffsetShort,
  epochSecondsDecimal,
  formatInt,
  WEEKDAY_NAMES,
  MONTH_NAMES,
} from './format';

export { usingNativeTemporal } from './temporal';

export { EXAMPLES } from './examples';
export type { DateGoblinExample } from './examples';

export {
  loadSettings,
  saveSettings,
  defaultSettings,
  deserializeSettings,
  serializeSettings,
  STORAGE_KEY,
  STORAGE_VERSION,
  MAX_COMPARISON_ZONES,
} from './persistence';
export type { Settings } from './persistence';

export { SEVERITY_RANK } from './types';
export type {
  InputMode,
  SourceKind,
  UnixUnit,
  ExcelSystem,
  Instant,
  WallDateTime,
  ZonedReading,
  InstantReading,
  ZoneOffsetInfo,
  Resolution,
  Recognition,
  ParseError,
  ParseResult,
  AmbiguityCandidate,
  Finding,
  FindingSeverity,
  FindingCategory,
  CalendarFacts,
  RangeInfo,
  RelativeTime,
} from './types';
