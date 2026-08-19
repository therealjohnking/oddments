/**
 * Built-in examples — a compact set that demonstrates *why* Date Goblin exists,
 * rather than a wall of instructional text. Each one loads a raw value plus the
 * mode/zone that makes its point, and flows through the ordinary pipeline (no
 * special-casing).
 */

import type { ExcelSystem, InputMode, UnixUnit } from './types';

export interface DateGoblinExample {
  id: string;
  label: string;
  blurb: string;
  raw: string;
  mode: InputMode;
  unixUnit?: UnixUnit;
  excelSystem?: ExcelSystem;
  /** Sets the interpret/display zone; omitted examples keep the current zone. */
  zone?: string;
}

export const EXAMPLES: DateGoblinExample[] = [
  {
    id: 'iso-offset',
    label: 'ISO with offset',
    blurb: 'An ordinary timestamp carrying an explicit −04:00 offset.',
    raw: '2026-08-17T16:24:00-04:00',
    mode: 'auto',
  },
  {
    id: 'unix-seconds',
    label: 'Unix seconds',
    blurb: 'A ten-digit epoch value, auto-detected as seconds.',
    raw: '1786998240',
    mode: 'auto',
  },
  {
    id: 'unix-millis',
    label: 'Unix milliseconds',
    blurb: 'The same moment as a thirteen-digit millisecond value.',
    raw: '1786998240000',
    mode: 'auto',
  },
  {
    id: 'dst-fold',
    label: 'DST fall-back',
    blurb: '01:30 happens twice in New York on this night — which one?',
    raw: '2026-11-01 01:30',
    mode: 'local',
    zone: 'America/New_York',
  },
  {
    id: 'dst-gap',
    label: 'DST spring-forward',
    blurb: '02:30 never happens in New York on this morning.',
    raw: '2026-03-08 02:30',
    mode: 'local',
    zone: 'America/New_York',
  },
  {
    id: 'excel-60',
    label: 'Excel serial 60',
    blurb: 'The fictitious 1900-02-29 from Excel’s leap-year bug.',
    raw: '60',
    mode: 'excel',
    excelSystem: '1900',
  },
];
