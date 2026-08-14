/**
 * Array-of-object shape analysis.
 *
 * For every array that holds enough objects, we describe the objects' shapes by
 * grouping them on a normalized key-set signature — an O(total-members) pass, not
 * an O(n²) pairwise comparison. The dominant shape is simply the most common
 * signature; every other signature is reported as a variant with its missing and
 * extra keys relative to the dominant one. A second pass tallies, per field, how
 * the value's *type* varies across the objects and how often it is null or
 * absent. This is observational profiling — it never infers or enforces a schema.
 */

import type {
  ArrayShapeReport,
  FieldNullability,
  FieldTypeVariance,
  JsonKind,
  JsonNode,
  ShapeVariant,
} from './types';

/** An array needs at least this many object elements to be shape-profiled. */
export const MIN_OBJECTS_FOR_SHAPE = 3;

/** Cap on representative example pointers stored per variant/offender. */
const EXAMPLE_CAP = 8;

interface ObjSummary {
  node: JsonNode;
  /** Unique member names in first-seen order. */
  keys: string[];
  /** Last-wins value node per member name (matches JSON.parse's effective value). */
  memberByKey: Map<string, JsonNode>;
}

/** Find and profile every array-of-objects in the tree. */
export function analyzeShapes(tree: JsonNode): ArrayShapeReport[] {
  const reports: ArrayShapeReport[] = [];
  const stack: JsonNode[] = [tree];

  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.children) for (const child of node.children) stack.push(child);
    if (node.kind === 'array' && node.children) {
      const objects = node.children.filter((c) => c.kind === 'object');
      if (objects.length >= MIN_OBJECTS_FOR_SHAPE) {
        reports.push(buildReport(node, objects));
      }
    }
  }

  reports.sort((a, b) => a.pointer.localeCompare(b.pointer));
  return reports;
}

function summarize(objects: JsonNode[]): ObjSummary[] {
  return objects.map((obj) => {
    const keys: string[] = [];
    const memberByKey = new Map<string, JsonNode>();
    for (const member of obj.children ?? []) {
      const key = member.key ?? '';
      if (!memberByKey.has(key)) keys.push(key);
      memberByKey.set(key, member);
    }
    return { node: obj, keys, memberByKey };
  });
}

function buildReport(arrayNode: JsonNode, objects: JsonNode[]): ArrayShapeReport {
  const summaries = summarize(objects);

  // ── Group by normalized (sorted) key-set signature ──────────────────────
  interface Group {
    signature: string;
    keys: string[];
    count: number;
    examples: string[];
  }
  const groups = new Map<string, Group>();
  for (const summary of summaries) {
    const signature = JSON.stringify([...summary.keys].sort());
    let group = groups.get(signature);
    if (!group) {
      group = { signature, keys: summary.keys, count: 0, examples: [] };
      groups.set(signature, group);
    }
    group.count++;
    if (group.examples.length < EXAMPLE_CAP) group.examples.push(summary.node.pointer);
  }

  const ordered = [...groups.values()].sort(
    (a, b) => b.count - a.count || a.signature.localeCompare(b.signature),
  );
  const dominantGroup = ordered[0]!;
  const dominantKeys = new Set(dominantGroup.keys);

  const variants: ShapeVariant[] = ordered.map((group) => {
    const keySet = new Set(group.keys);
    const isDominant = group === dominantGroup;
    return {
      keys: group.keys,
      count: group.count,
      dominant: isDominant,
      examples: group.examples,
      missing: isDominant ? [] : [...dominantKeys].filter((k) => !keySet.has(k)),
      extra: isDominant ? [] : group.keys.filter((k) => !dominantKeys.has(k)),
    };
  });

  // ── Per-field type + nullability aggregation ────────────────────────────
  interface FieldAgg {
    present: number;
    nulls: number;
    kinds: Map<JsonKind, { count: number; pointer: string }>;
  }
  const agg = new Map<string, FieldAgg>();
  for (const summary of summaries) {
    for (const key of summary.keys) {
      const member = summary.memberByKey.get(key)!;
      let entry = agg.get(key);
      if (!entry) {
        entry = { present: 0, nulls: 0, kinds: new Map() };
        agg.set(key, entry);
      }
      entry.present++;
      if (member.kind === 'null') entry.nulls++;
      const kindEntry = entry.kinds.get(member.kind);
      if (kindEntry) kindEntry.count++;
      else entry.kinds.set(member.kind, { count: 1, pointer: member.pointer });
    }
  }

  const typeVariances: FieldTypeVariance[] = [];
  const nullability: FieldNullability[] = [];
  for (const [key, entry] of agg) {
    // Type variance considers non-null kinds only; null is a nullability signal,
    // not a type conflict (a field that is number-or-null is nullable, not mixed).
    const nonNull = [...entry.kinds.entries()].filter(([k]) => k !== 'null');
    if (nonNull.length >= 2) {
      nonNull.sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]));
      const [dominantKind, dominantInfo] = nonNull[0]!;
      const offenders = nonNull
        .slice(1)
        .map(([kind, info]) => ({ kind, pointer: info.pointer, count: info.count }));
      typeVariances.push({
        key,
        dominantKind,
        dominantCount: dominantInfo.count,
        present: entry.present,
        offenders,
      });
    }

    const missing = objects.length - entry.present;
    if (entry.nulls > 0 || missing > 0) {
      nullability.push({ key, present: entry.present, nulls: entry.nulls, missing });
    }
  }

  typeVariances.sort((a, b) => a.key.localeCompare(b.key));
  nullability.sort(
    (a, b) => b.nulls + b.missing - (a.nulls + a.missing) || a.key.localeCompare(b.key),
  );

  return {
    pointer: arrayNode.pointer,
    elements: arrayNode.childCount,
    objectCount: objects.length,
    variants,
    conformity: dominantGroup.count / objects.length,
    typeVariances,
    nullability,
  };
}
