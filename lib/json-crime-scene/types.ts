/**
 * Shared types for JSON Crime Scene — a local-first instrument for inspecting,
 * understanding, and diagnosing a single JSON document.
 *
 * The engine's job is to *observe and explain*, never to repair or rewrite. It
 * answers "what is actually in this JSON, how is it structured, and what looks
 * suspicious?" — with enough context (paths, counts, examples) to understand why
 * each observation was made.
 *
 * Everything is deterministic and runs entirely in the browser. Offsets, line,
 * and column numbers always refer to the original, unmodified source text. The
 * third-party parser AST is confined to `parse.ts`/`traverse.ts`; nothing in this
 * file (and nothing a React component sees) depends on its shape.
 */

/** The kind of a JSON value. */
export type JsonKind = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

/** Severity is deliberately restrained: reserve `warning` for consequential things. */
export type FindingSeverity = 'info' | 'notice' | 'warning';

/** Numeric ordering so findings sort most-severe first. */
export const SEVERITY_RANK: Record<FindingSeverity, number> = {
  warning: 2,
  notice: 1,
  info: 0,
};

/** Diagnostic families. Each finding belongs to exactly one. */
export type FindingCategory =
  | 'duplicate-keys'
  | 'keys'
  | 'types'
  | 'shape'
  | 'structure'
  | 'size'
  | 'numbers'
  | 'strings'
  | 'emptiness'
  | 'nullability';

/** 1-based line/column into the original source (columns count UTF-16 units). */
export interface SourcePosition {
  offset: number;
  line: number;
  column: number;
}

/**
 * A single value in the document, wrapped for the UI. This is the domain node —
 * plain data, no parser types. Objects expose their members as child *value*
 * nodes carrying `key`; arrays expose element value nodes carrying `index`.
 */
export interface JsonNode {
  /** Stable id, unique within one analysis (derived from the source offset). */
  id: string;
  kind: JsonKind;
  /** JSON Pointer (RFC 6901) to this node; the root node's pointer is ''. */
  pointer: string;
  /** Path segments from the root: object member names and array indexes. */
  path: (string | number)[];
  /** Nesting depth; the root is 0. */
  depth: number;
  /** Property name when this node is an object member's value. */
  key?: string;
  /** Array index when this node is an array element. */
  index?: number;
  /** True when this member's key duplicates an earlier key in the same object. */
  duplicateKey?: boolean;
  /** Start offset into the source. */
  offset: number;
  /** Byte length (UTF-16 units) of this value's source span. */
  length: number;
  /** For containers: number of direct children (exact, never render-bounded). */
  childCount: number;
  /** Child value nodes (objects & arrays only); omitted for scalars. */
  children?: JsonNode[];
  /**
   * A bounded, display-safe preview of a scalar value (decoded for strings, with
   * invisible/control characters made visible). Never the full value for huge
   * strings — see `truncatedPreview` and `stringLength`.
   */
  preview?: string;
  /** True when `preview` was shortened from a longer value. */
  truncatedPreview?: boolean;
  /** For numbers: the exact raw literal from the source (precision-preserving). */
  raw?: string;
  /** For numbers: the value as parsed into a JS double (may lose precision). */
  numberValue?: number;
  /** For booleans: the value. */
  booleanValue?: boolean;
  /** For strings: decoded length in UTF-16 units (exact, even when previewed). */
  stringLength?: number;
  /** Raw source slice of this member's key literal (with quotes/escapes). */
  keyRaw?: string;
}

export interface JsonFindingExample {
  /** JSON Pointer to the example node, for navigation. */
  pointer: string;
  /** Short label — usually a bounded value/key preview. */
  label?: string;
  /** Supporting note (e.g. "string, expected number", "×3", "U+200B"). */
  note?: string;
}

export interface JsonFinding {
  /** Stable id, unique within one analysis. */
  id: string;
  severity: FindingSeverity;
  category: FindingCategory;
  /** Short human title (e.g. "Duplicate object keys"). */
  title: string;
  /** Plain-language description, already interpolated with measured counts. */
  detail: string;
  /** One sentence on *why* this was surfaced — the observation behind it. */
  why: string;
  /** Primary affected JSON Pointer, when the finding is node/container-scoped. */
  pointer?: string;
  /** Magnitude the detail refers to (nodes/keys/objects affected). */
  count?: number;
  /** Representative examples, capped (exact counts live in `count`). */
  examples: JsonFindingExample[];
  /** True when the stored example list was capped for a large input. */
  examplesTruncated: boolean;
  /** Sort key derived from severity + category; lower sorts first. */
  priority: number;
}

/** A structural hotspot: the single largest/longest thing of its kind. */
export interface Hotspot {
  pointer: string;
  /** The magnitude (element count, property count, string length, depth). */
  value: number;
  /** A short preview of what lives there. */
  label?: string;
}

/** Per-kind value tallies and the headline structural metrics. */
export interface StructureStats {
  rootKind: JsonKind;
  /** Total values (every scalar and container, including the root). */
  totalNodes: number;
  objects: number;
  arrays: number;
  strings: number;
  numbers: number;
  booleans: number;
  nulls: number;
  /** Total object members across the document (duplicates counted). */
  properties: number;
  /** Deepest nesting level reached (root = 0). */
  maxDepth: number;
  deepest: Hotspot | null;
  longestString: Hotspot | null;
  largestArray: Hotspot | null;
  largestObject: Hotspot | null;
  /** Source size in UTF-8 bytes. */
  sourceBytes: number;
  /** Number of duplicate-key groups (a key repeated within one object). */
  duplicateKeyGroups: number;
}

/** The compact overview shown above the tree. */
export interface StructuralProfile extends StructureStats {
  findingCount: number;
  findingCountBySeverity: Record<FindingSeverity, number>;
}

/** A single search hit. */
export interface SearchHit {
  /** Node id of the hit (for navigation/expansion). */
  nodeId: string;
  pointer: string;
  /** Where the match occurred. */
  where: 'key' | 'value';
  kind: JsonKind;
  /** A bounded preview of the matched key or value. */
  preview: string;
}

export interface SearchResult {
  query: string;
  hits: SearchHit[];
  /** Total matches found before the result cap. */
  total: number;
  /** True when `hits` was capped below `total`. */
  capped: boolean;
}

/** A translated, human-readable parse failure. */
export interface JsonParseError {
  /** The parser's error-code name, kept for reference (e.g. "CommaExpected"). */
  code: string;
  /** Oddments-language explanation of what went wrong. */
  message: string;
  position: SourcePosition;
  /** A few source lines around the failure, with a caret under the column. */
  context: string;
  /** Count of additional problems found after the first (0 when only one). */
  additionalErrors: number;
}

export interface AnalysisMeta {
  fileName: string | null;
  fileSize: number | null;
  /** True when the source is large enough that analysis may be slow. */
  large: boolean;
}

/**
 * The result of analyzing one document. Discriminated by `status` so the UI can
 * render exactly one experience: nothing, a parse error, a too-complex notice,
 * or the full inspection.
 */
export type JsonAnalysis =
  | { status: 'empty'; meta: AnalysisMeta }
  | { status: 'error'; error: JsonParseError; source: string; meta: AnalysisMeta }
  | { status: 'too-complex'; reason: string; source: string; meta: AnalysisMeta }
  | {
      status: 'ok';
      source: string;
      meta: AnalysisMeta;
      tree: JsonNode;
      profile: StructuralProfile;
      findings: JsonFinding[];
      shapes: ArrayShapeReport[];
      /** True when duplicate keys make key-sorting transforms unsafe. */
      hasDuplicateKeys: boolean;
    };

/* ── Array-of-object shape analysis ──────────────────────────────────────── */

/** One distinct object shape (a normalized key-set signature) within an array. */
export interface ShapeVariant {
  /** The member names that define this shape, in first-seen order. */
  keys: string[];
  /** Number of objects with exactly this key set. */
  count: number;
  /** True when this is the dominant (most common) shape. */
  dominant: boolean;
  /** Pointers to a few representative objects with this shape (capped). */
  examples: string[];
  /** Keys this shape is missing relative to the dominant shape. */
  missing: string[];
  /** Keys this shape has that the dominant shape does not. */
  extra: string[];
}

/** How one member's value type varies across an array's objects. */
export interface FieldTypeVariance {
  key: string;
  /** The most common value kind for this field. */
  dominantKind: JsonKind;
  /** Count of objects whose value for this field is the dominant kind. */
  dominantCount: number;
  /** Total objects that have this field (non-missing). */
  present: number;
  /** Minority kinds with a representative pointer. */
  offenders: { kind: JsonKind; pointer: string; count: number }[];
}

/** How often a member is null / missing across an array's objects. */
export interface FieldNullability {
  key: string;
  /** Objects where the field is present. */
  present: number;
  /** Objects where the field's value is null. */
  nulls: number;
  /** Objects (of the array total) that omit the field entirely. */
  missing: number;
}

/** The result of profiling one array whose elements are (mostly) objects. */
export interface ArrayShapeReport {
  pointer: string;
  /** Total elements in the array. */
  elements: number;
  /** How many elements are objects. */
  objectCount: number;
  /** Distinct shapes, dominant first. */
  variants: ShapeVariant[];
  /** Fraction of objects matching the dominant shape (0..1). */
  conformity: number;
  /** Per-field type inconsistencies worth noting. */
  typeVariances: FieldTypeVariance[];
  /** Per-field null/missing statistics worth noting. */
  nullability: FieldNullability[];
}
