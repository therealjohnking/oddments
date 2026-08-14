/**
 * Diagnostics — the distinguishing feature.
 *
 * These rules surface structural characteristics that may deserve attention,
 * without claiming that every unusual structure is wrong. The guiding principle
 * is *observation before judgment*: findings describe what is there ("Mixed
 * element types", "`amount` is a number in 2 of 3 objects and a string once")
 * rather than pronouncing a schema invalid. The tool examines evidence; it does
 * not know the user's intended schema.
 *
 * `warning` is reserved for the two genuinely consequential cases — duplicate
 * object keys (a parser silently keeps only one) and integers outside JavaScript's
 * safe range (the value is silently rounded). Everything else is `notice` or
 * `info`. Every finding carries a plain-language reason and, wherever possible,
 * the JSON Pointer(s) it refers to.
 */

import { CATEGORY_META, classify, formatCodePoint } from '@/lib/inspector';
import { formatInt, formatPercent } from './format';
import { inspectNumberLiteral } from './numbers';
import type { LineIndex } from './parse';
import type { RawDuplicateGroup } from './traverse';
import type {
  ArrayShapeReport,
  FindingCategory,
  FindingSeverity,
  JsonFinding,
  JsonFindingExample,
  JsonKind,
  JsonNode,
  StructureStats,
} from './types';

/* ── Thresholds (chosen so ordinary API responses do not look pathological) ─ */
const NOTABLE_DEPTH = 16;
const EXTREME_DEPTH = 32;
const NOTABLE_ARRAY = 1000;
const NOTABLE_OBJECT = 100;
const NOTABLE_STRING = 8192;
const NULL_PREVALENT_SHARE = 0.5;
const NULL_PREVALENT_MIN = 3;
const EMPTY_CONTAINER_MIN = 3;
const EMPTY_STRING_MIN = 5;
const EMPTY_STRING_SHARE = 0.2;
const EXAMPLE_CAP = 10;

const SEVERITY_TIER: Record<FindingSeverity, number> = { warning: 0, notice: 1, info: 2 };
const CATEGORY_BASE: Record<FindingCategory, number> = {
  'duplicate-keys': 0,
  numbers: 1,
  types: 2,
  shape: 3,
  keys: 4,
  structure: 5,
  nullability: 6,
  emptiness: 7,
  strings: 8,
  size: 9,
};

const KIND_PLURAL: Record<JsonKind, string> = {
  object: 'objects',
  array: 'arrays',
  string: 'strings',
  number: 'numbers',
  boolean: 'booleans',
  null: 'nulls',
};

interface FindingSpec {
  id: string;
  severity: FindingSeverity;
  category: FindingCategory;
  title: string;
  detail: string;
  why: string;
  pointer?: string;
  count?: number;
  examples?: JsonFindingExample[];
  examplesTruncated?: boolean;
}

function make(spec: FindingSpec): JsonFinding {
  return {
    id: spec.id,
    severity: spec.severity,
    category: spec.category,
    title: spec.title,
    detail: spec.detail,
    why: spec.why,
    pointer: spec.pointer,
    count: spec.count,
    examples: spec.examples ?? [],
    examplesTruncated: spec.examplesTruncated ?? false,
    priority: SEVERITY_TIER[spec.severity] * 1000 + CATEGORY_BASE[spec.category] * 10,
  };
}

/** A key/value character worth surfacing: genuinely invisible, or deceptive whitespace. */
function firstHiddenChar(value: string): { cp: number; name: string } | null {
  for (const ch of value) {
    const cp = ch.codePointAt(0)!;
    const cls = classify(cp);
    if (!cls) continue;
    const group = CATEGORY_META[cls.category]?.group;
    if (
      group === 'invisible' ||
      cls.category === 'unusual-space' ||
      cls.category === 'vertical-whitespace'
    ) {
      return { cp, name: cls.name };
    }
  }
  return null;
}

function pointerLabel(pointer: string): string {
  return pointer === '' ? '(root)' : pointer;
}

export interface DiagnoseInput {
  tree: JsonNode;
  source: string;
  stats: StructureStats;
  duplicateGroups: RawDuplicateGroup[];
  shapes: ArrayShapeReport[];
  lineIndex: LineIndex;
}

export function diagnose(input: DiagnoseInput): JsonFinding[] {
  const { tree, source, stats, duplicateGroups, shapes, lineIndex } = input;
  const findings: JsonFinding[] = [];

  // ── Single structural walk: collect the nodes each rule needs ────────────
  const objects: JsonNode[] = [];
  const arrays: JsonNode[] = [];
  const numbers: JsonNode[] = [];
  const strings: JsonNode[] = [];
  let emptyObjects = 0;
  let emptyArrays = 0;
  let emptyStrings = 0;
  const emptyObjectPtrs: string[] = [];
  const emptyArrayPtrs: string[] = [];

  const stack: JsonNode[] = [tree];
  while (stack.length > 0) {
    const node = stack.pop()!;
    switch (node.kind) {
      case 'object':
        objects.push(node);
        if (node.childCount === 0) {
          emptyObjects++;
          if (emptyObjectPtrs.length < EXAMPLE_CAP) emptyObjectPtrs.push(node.pointer);
        }
        break;
      case 'array':
        arrays.push(node);
        if (node.childCount === 0) {
          emptyArrays++;
          if (emptyArrayPtrs.length < EXAMPLE_CAP) emptyArrayPtrs.push(node.pointer);
        }
        break;
      case 'string':
        strings.push(node);
        if (node.stringLength === 0) emptyStrings++;
        break;
      case 'number':
        numbers.push(node);
        break;
    }
    // Push children reversed so pre-order pop yields document order, keeping the
    // chosen examples deterministic and top-to-bottom.
    if (node.children)
      for (let i = node.children.length - 1; i >= 0; i--) stack.push(node.children[i]!);
  }

  // ── Duplicate object keys (the marquee diagnostic) ──────────────────────
  if (duplicateGroups.length > 0) {
    const totalExtra = duplicateGroups.reduce((sum, g) => sum + (g.count - 1), 0);
    const examples: JsonFindingExample[] = duplicateGroups.slice(0, EXAMPLE_CAP).map((group) => {
      // Duplicates on the same physical line would repeat the number, so report
      // distinct lines only.
      const distinctLines = [...new Set(group.keyOffsets.map((o) => lineIndex.locate(o).line))];
      const shownLines = distinctLines.slice(0, 5);
      const lineWord = distinctLines.length === 1 ? 'line' : 'lines';
      const more = distinctLines.length > shownLines.length ? ', …' : '';
      return {
        pointer: group.objectPointer,
        label: JSON.stringify(group.key),
        note: `×${group.count} · ${lineWord} ${shownLines.join(', ')}${more} · in ${pointerLabel(group.objectPointer)}`,
      };
    });
    findings.push(
      make({
        id: 'dup-keys',
        severity: 'warning',
        category: 'duplicate-keys',
        title: 'Duplicate object keys',
        detail: `${duplicateGroups.length} object ${duplicateGroups.length === 1 ? 'key appears' : 'keys appear'} more than once within the same object (${totalExtra} shadowed ${totalExtra === 1 ? 'value' : 'values'}).`,
        why: 'Most JSON parsers — including JavaScript’s JSON.parse — keep only the last value for a repeated key and silently discard the earlier ones, so the value your code reads may not be the first one you see.',
        pointer: duplicateGroups[0]!.objectPointer,
        count: duplicateGroups.length,
        examples,
        examplesTruncated: duplicateGroups.length > EXAMPLE_CAP,
      }),
    );
  }

  // ── Key diagnostics (whitespace, case collisions, empty, hidden chars) ──
  const whitespaceKeys: JsonFindingExample[] = [];
  const emptyKeyPtrs: JsonFindingExample[] = [];
  const hiddenKeyExamples: JsonFindingExample[] = [];
  const caseCollisions: JsonFindingExample[] = [];
  let whitespaceKeyCount = 0;
  let emptyKeyCount = 0;
  let hiddenKeyCount = 0;
  let caseCollisionCount = 0;

  for (const obj of objects) {
    const byLower = new Map<string, Set<string>>();
    for (const member of obj.children ?? []) {
      const key = member.key ?? '';

      if (key === '') {
        emptyKeyCount++;
        if (emptyKeyExamplesRoom(emptyKeyPtrs)) {
          emptyKeyPtrs.push({
            pointer: member.pointer,
            note: `empty key in ${pointerLabel(obj.pointer)}`,
          });
        }
      } else if (key !== key.trim()) {
        whitespaceKeyCount++;
        if (whitespaceKeys.length < EXAMPLE_CAP) {
          whitespaceKeys.push({
            pointer: member.pointer,
            label: JSON.stringify(key),
            note: 'surrounding whitespace',
          });
        }
      }

      const hidden = firstHiddenChar(key);
      if (hidden) {
        hiddenKeyCount++;
        if (hiddenKeyExamples.length < EXAMPLE_CAP) {
          hiddenKeyExamples.push({
            pointer: member.pointer,
            label: JSON.stringify(key),
            note: `${formatCodePoint(hidden.cp)} ${hidden.name}`,
          });
        }
      }

      if (key !== '') {
        const lower = key.toLowerCase();
        const set = byLower.get(lower) ?? new Set<string>();
        set.add(key);
        byLower.set(lower, set);
      }
    }
    for (const [, variants] of byLower) {
      if (variants.size > 1) {
        caseCollisionCount++;
        if (caseCollisions.length < EXAMPLE_CAP) {
          caseCollisions.push({
            pointer: obj.pointer,
            label: [...variants].map((v) => JSON.stringify(v)).join(' vs '),
            note: `in ${pointerLabel(obj.pointer)}`,
          });
        }
      }
    }
  }

  if (whitespaceKeyCount > 0) {
    findings.push(
      make({
        id: 'keys-whitespace',
        severity: 'notice',
        category: 'keys',
        title: 'Whitespace in property names',
        detail: `${whitespaceKeyCount} property ${whitespaceKeyCount === 1 ? 'name has' : 'names have'} leading or trailing whitespace.`,
        why: 'A key with surrounding whitespace looks identical to the trimmed key but is a different property — exact-key lookups will quietly miss it.',
        count: whitespaceKeyCount,
        examples: whitespaceKeys,
        examplesTruncated: whitespaceKeyCount > whitespaceKeys.length,
      }),
    );
  }
  if (caseCollisionCount > 0) {
    findings.push(
      make({
        id: 'keys-case',
        severity: 'notice',
        category: 'keys',
        title: 'Keys that differ only in capitalization',
        detail: `${caseCollisionCount} ${caseCollisionCount === 1 ? 'object has sibling keys' : 'objects have sibling keys'} that differ only by letter case.`,
        why: 'These are distinct keys in JSON, but case-insensitive systems (or a later normalization step) may conflate them.',
        count: caseCollisionCount,
        examples: caseCollisions,
        examplesTruncated: caseCollisionCount > caseCollisions.length,
      }),
    );
  }
  if (hiddenKeyCount > 0) {
    findings.push(
      make({
        id: 'keys-hidden',
        severity: 'notice',
        category: 'keys',
        title: 'Unusual characters in property names',
        detail: `${hiddenKeyCount} property ${hiddenKeyCount === 1 ? 'name contains' : 'names contain'} an invisible or unusual character.`,
        why: 'Invisible characters (zero-width spaces, non-breaking spaces, bidirectional controls) make two keys look identical while being different properties — a classic source of silent mismatches.',
        count: hiddenKeyCount,
        examples: hiddenKeyExamples,
        examplesTruncated: hiddenKeyCount > hiddenKeyExamples.length,
      }),
    );
  }
  if (emptyKeyCount > 0) {
    findings.push(
      make({
        id: 'keys-empty',
        severity: 'info',
        category: 'keys',
        title: 'Empty property name',
        detail: `${emptyKeyCount} ${emptyKeyCount === 1 ? 'property uses' : 'properties use'} an empty string ("") as its name.`,
        why: 'An empty string is a valid JSON property name, but it is unusual and easy to overlook — worth confirming it is intentional.',
        count: emptyKeyCount,
        examples: emptyKeyPtrs,
        examplesTruncated: emptyKeyCount > emptyKeyPtrs.length,
      }),
    );
  }

  // ── Mixed array element types ───────────────────────────────────────────
  const mixedExamples: JsonFindingExample[] = [];
  let mixedArrays = 0;
  for (const arr of arrays) {
    const kinds = new Map<JsonKind, { count: number; pointer: string }>();
    for (const child of arr.children ?? []) {
      const entry = kinds.get(child.kind);
      if (entry) entry.count++;
      else kinds.set(child.kind, { count: 1, pointer: child.pointer });
    }
    const nonNull = [...kinds.entries()].filter(([k]) => k !== 'null');
    if (nonNull.length >= 2) {
      mixedArrays++;
      if (mixedExamples.length < EXAMPLE_CAP) {
        const breakdown = [...kinds.entries()]
          .sort((a, b) => b[1].count - a[1].count)
          .map(([k, v]) => `${v.count} ${v.count === 1 ? singular(k) : KIND_PLURAL[k]}`)
          .join(', ');
        mixedExamples.push({
          pointer: arr.pointer,
          note: `${breakdown} · in ${pointerLabel(arr.pointer)}`,
        });
      }
    }
  }
  if (mixedArrays > 0) {
    findings.push(
      make({
        id: 'types-mixed-array',
        severity: 'notice',
        category: 'types',
        title: 'Mixed element types',
        detail: `${mixedArrays} ${mixedArrays === 1 ? 'array mixes' : 'arrays mix'} elements of different types.`,
        why: 'An array whose elements are not all the same type may be intentional, but it often means a value was recorded in the wrong shape; it is shown so you can decide.',
        pointer: mixedExamples[0]?.pointer,
        count: mixedArrays,
        examples: mixedExamples,
        examplesTruncated: mixedArrays > mixedExamples.length,
      }),
    );
  }

  // ── Array-of-object shape variants & field-type inconsistency ───────────
  for (const report of shapes) {
    if (report.variants.length > 1) {
      const dominant = report.variants.find((v) => v.dominant)!;
      const examples: JsonFindingExample[] = report.variants
        .filter((v) => !v.dominant)
        .slice(0, EXAMPLE_CAP)
        .map((v) => {
          const parts: string[] = [];
          if (v.missing.length > 0)
            parts.push(`missing ${v.missing.map((k) => JSON.stringify(k)).join(', ')}`);
          if (v.extra.length > 0)
            parts.push(`extra ${v.extra.map((k) => JSON.stringify(k)).join(', ')}`);
          return {
            pointer: v.examples[0] ?? report.pointer,
            note: `×${v.count} · ${parts.join('; ') || 'different shape'}`,
          };
        });
      findings.push(
        make({
          id: `shape-${report.pointer || 'root'}`,
          severity: 'notice',
          category: 'shape',
          title: 'Inconsistent object shapes',
          detail: `The ${report.objectCount} objects in the array at ${pointerLabel(report.pointer)} have ${report.variants.length} different shapes; ${dominant.count} (${formatPercent(report.conformity)}) share the most common one.`,
          why: 'Objects in the same array usually share a set of keys; ones that differ may be missing a field, carry an extra field, or have come from a different source.',
          pointer: report.pointer,
          count: report.variants.length - 1,
          examples,
          examplesTruncated: report.variants.length - 1 > examples.length,
        }),
      );
    }

    if (report.typeVariances.length > 0) {
      const examples: JsonFindingExample[] = report.typeVariances
        .slice(0, EXAMPLE_CAP)
        .map((tv) => {
          const offender = tv.offenders[0]!;
          return {
            pointer: offender.pointer,
            label: JSON.stringify(tv.key),
            note: `${tv.dominantKind} in ${tv.dominantCount}/${tv.present}, ${offender.kind} at ${offender.pointer}`,
          };
        });
      const detail =
        report.typeVariances.length === 1
          ? single_type_variance_detail(report)
          : `${report.typeVariances.length} fields in the array at ${pointerLabel(report.pointer)} have values of more than one type across its objects.`;
      findings.push(
        make({
          id: `types-field-${report.pointer || 'root'}`,
          severity: 'notice',
          category: 'types',
          title: 'Inconsistent field types',
          detail,
          why: 'When the same field is one type in most objects and a different type in a few, the odd ones out are often data-entry mistakes or values from a different version of the schema.',
          pointer: report.pointer,
          count: report.typeVariances.length,
          examples,
          examplesTruncated: report.typeVariances.length > examples.length,
        }),
      );
    }

    // Frequently-null fields within this array.
    const nullFields = report.nullability.filter(
      (n) => n.present >= NULL_PREVALENT_MIN && n.nulls / n.present >= NULL_PREVALENT_SHARE,
    );
    if (nullFields.length > 0) {
      const examples: JsonFindingExample[] = nullFields.slice(0, EXAMPLE_CAP).map((n) => ({
        pointer: report.pointer,
        label: JSON.stringify(n.key),
        note: `null in ${n.nulls}/${n.present} (${formatPercent(n.nulls / n.present)})`,
      }));
      findings.push(
        make({
          id: `null-${report.pointer || 'root'}`,
          severity: 'info',
          category: 'nullability',
          title: 'Frequently-null fields',
          detail: `${nullFields.length} ${nullFields.length === 1 ? 'field is' : 'fields are'} null in most objects of the array at ${pointerLabel(report.pointer)}.`,
          why: 'A field that is null in most records may be optional, deprecated, or not yet populated — neutral information, not necessarily a problem.',
          pointer: report.pointer,
          count: nullFields.length,
          examples,
        }),
      );
    }
  }

  // ── Numeric safety ──────────────────────────────────────────────────────
  const unsafeExamples: JsonFindingExample[] = [];
  let unsafeCount = 0;
  for (const num of numbers) {
    if (num.raw === undefined || num.numberValue === undefined) continue;
    const issue = inspectNumberLiteral(num.raw, num.numberValue);
    if (!issue) continue;
    unsafeCount++;
    if (unsafeExamples.length < EXAMPLE_CAP) {
      // Not every integer past the safe boundary actually rounds — some (even
      // ones, powers of two) are still representable. Say which case it is rather
      // than printing "parses as <identical digits>".
      const note =
        issue.kind === 'overflow'
          ? `overflows to ${issue.parsedText}`
          : issue.parsedText === num.raw
            ? 'beyond the safe range (exact here, but arithmetic near it is not)'
            : `rounds to ${issue.parsedText}`;
      unsafeExamples.push({
        pointer: num.pointer,
        label: num.raw.length > 40 ? num.raw.slice(0, 40) + '…' : num.raw,
        note,
      });
    }
  }
  if (unsafeCount > 0) {
    findings.push(
      make({
        id: 'numbers-unsafe',
        severity: 'warning',
        category: 'numbers',
        title: 'Numbers outside JavaScript’s safe range',
        detail: `${unsafeCount} ${unsafeCount === 1 ? 'number is' : 'numbers are'} outside JavaScript’s safe integer range (±9,007,199,254,740,991), where not every integer is representable.`,
        why: 'JavaScript (and JSON.parse) stores every number as a 64-bit float, so integers beyond ±2^53−1 are not all representable and may be rounded to a different value. JSON Crime Scene reads the exact digits from the source, before any rounding happens.',
        pointer: unsafeExamples[0]?.pointer,
        count: unsafeCount,
        examples: unsafeExamples,
        examplesTruncated: unsafeCount > unsafeExamples.length,
      }),
    );
  }

  // ── Unusual characters in string values ─────────────────────────────────
  const hiddenStringExamples: JsonFindingExample[] = [];
  let hiddenStringCount = 0;
  for (const str of strings) {
    if (str.stringLength === 0) continue;
    let value: string;
    try {
      value = JSON.parse(source.slice(str.offset, str.offset + str.length)) as string;
    } catch {
      continue;
    }
    if (typeof value !== 'string') continue;
    const hidden = firstHiddenChar(value);
    if (!hidden) continue;
    hiddenStringCount++;
    if (hiddenStringExamples.length < EXAMPLE_CAP) {
      hiddenStringExamples.push({
        pointer: str.pointer,
        label: str.preview,
        note: `${formatCodePoint(hidden.cp)} ${hidden.name}`,
      });
    }
  }
  if (hiddenStringCount > 0) {
    findings.push(
      make({
        id: 'strings-hidden',
        severity: 'notice',
        category: 'strings',
        title: 'Unusual characters in string values',
        detail: `${hiddenStringCount} string ${hiddenStringCount === 1 ? 'value contains' : 'values contain'} an invisible or unusual character.`,
        why: 'Zero-width spaces, non-breaking spaces, and bidirectional controls are invisible but real — they change comparisons, lengths, and display without being seen.',
        count: hiddenStringCount,
        examples: hiddenStringExamples,
        examplesTruncated: hiddenStringCount > hiddenStringExamples.length,
      }),
    );
  }

  // ── Structural hotspots (all informational) ─────────────────────────────
  if (stats.maxDepth >= NOTABLE_DEPTH && stats.deepest) {
    const extreme = stats.maxDepth >= EXTREME_DEPTH;
    findings.push(
      make({
        id: 'structure-depth',
        severity: 'info',
        category: 'structure',
        title: extreme ? 'Very deep nesting' : 'Deep nesting',
        detail: `Maximum nesting depth is ${stats.maxDepth}, reached at ${pointerLabel(stats.deepest.pointer)}.`,
        why: 'Deeply nested JSON is harder to read and can strain code that walks it recursively. This is informational — depth alone is not a defect.',
        pointer: stats.deepest.pointer,
        count: stats.maxDepth,
        examples: [{ pointer: stats.deepest.pointer, note: `depth ${stats.maxDepth}` }],
      }),
    );
  }
  if (stats.largestArray && stats.largestArray.value >= NOTABLE_ARRAY) {
    findings.push(
      make({
        id: 'size-array',
        severity: 'info',
        category: 'size',
        title: 'Large array',
        detail: `The largest array has ${formatInt(stats.largestArray.value)} elements, at ${pointerLabel(stats.largestArray.pointer)}.`,
        why: 'Large arrays are common and fine; this is a heads-up about where the bulk of the document lives.',
        pointer: stats.largestArray.pointer,
        count: stats.largestArray.value,
        examples: [
          {
            pointer: stats.largestArray.pointer,
            note: `${formatInt(stats.largestArray.value)} elements`,
          },
        ],
      }),
    );
  }
  if (stats.largestObject && stats.largestObject.value >= NOTABLE_OBJECT) {
    findings.push(
      make({
        id: 'size-object',
        severity: 'info',
        category: 'size',
        title: 'Object with many properties',
        detail: `The largest object has ${formatInt(stats.largestObject.value)} properties, at ${pointerLabel(stats.largestObject.pointer)}.`,
        why: 'A very wide object is sometimes a map that would be easier to reason about as an array of entries — informational only.',
        pointer: stats.largestObject.pointer,
        count: stats.largestObject.value,
        examples: [
          {
            pointer: stats.largestObject.pointer,
            note: `${formatInt(stats.largestObject.value)} properties`,
          },
        ],
      }),
    );
  }
  if (stats.longestString && stats.longestString.value >= NOTABLE_STRING) {
    findings.push(
      make({
        id: 'size-string',
        severity: 'info',
        category: 'size',
        title: 'Very long string',
        detail: `The longest string is ${formatInt(stats.longestString.value)} characters, at ${pointerLabel(stats.longestString.pointer)}.`,
        why: 'A very long string is often encoded/embedded data (base64, HTML, another JSON document) travelling inside this one.',
        pointer: stats.longestString.pointer,
        count: stats.longestString.value,
        examples: [
          {
            pointer: stats.longestString.pointer,
            note: `${formatInt(stats.longestString.value)} chars`,
          },
        ],
      }),
    );
  }

  // ── Emptiness (neutral, only when it forms a pattern) ───────────────────
  if (emptyArrays >= EMPTY_CONTAINER_MIN) {
    findings.push(
      make({
        id: 'empty-arrays',
        severity: 'info',
        category: 'emptiness',
        title: 'Empty arrays',
        detail: `${formatInt(emptyArrays)} arrays are empty ([]).`,
        why: 'Empty arrays are usually legitimate (nothing to list yet); shown as a neutral statistic.',
        count: emptyArrays,
        examples: emptyArrayPtrs.map((p) => ({ pointer: p, note: pointerLabel(p) })),
        examplesTruncated: emptyArrays > emptyArrayPtrs.length,
      }),
    );
  }
  if (emptyObjects >= EMPTY_CONTAINER_MIN) {
    findings.push(
      make({
        id: 'empty-objects',
        severity: 'info',
        category: 'emptiness',
        title: 'Empty objects',
        detail: `${formatInt(emptyObjects)} objects are empty ({}).`,
        why: 'Empty objects are usually legitimate placeholders; shown as a neutral statistic.',
        count: emptyObjects,
        examples: emptyObjectPtrs.map((p) => ({ pointer: p, note: pointerLabel(p) })),
        examplesTruncated: emptyObjects > emptyObjectPtrs.length,
      }),
    );
  }
  if (
    emptyStrings >= EMPTY_STRING_MIN &&
    stats.strings > 0 &&
    emptyStrings / stats.strings >= EMPTY_STRING_SHARE
  ) {
    findings.push(
      make({
        id: 'empty-strings',
        severity: 'info',
        category: 'emptiness',
        title: 'Many empty strings',
        detail: `${formatInt(emptyStrings)} of ${formatInt(stats.strings)} strings are empty ("").`,
        why: 'Empty strings are often stand-ins for missing values; when they dominate it is worth knowing whether they mean "blank" or "unknown".',
        count: emptyStrings,
      }),
    );
  }

  // Sort most-severe first, then by category, then by title for stability.
  findings.sort(
    (a, b) => a.priority - b.priority || a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
  );
  return findings;
}

function single_type_variance_detail(report: ArrayShapeReport): string {
  const tv = report.typeVariances[0]!;
  const offender = tv.offenders[0]!;
  const others = tv.offenders.length > 1 ? ` and ${tv.offenders.length - 1} other type(s)` : '';
  return `In the array at ${pointerLabel(report.pointer)}, field ${JSON.stringify(tv.key)} is ${tv.dominantKind} in ${tv.dominantCount} of ${tv.present} objects but ${offender.kind} at ${offender.pointer}${others}.`;
}

function singular(kind: JsonKind): string {
  return kind;
}

function emptyKeyExamplesRoom(list: JsonFindingExample[]): boolean {
  return list.length < EXAMPLE_CAP;
}
