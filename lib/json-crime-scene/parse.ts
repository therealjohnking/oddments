/**
 * Parsing — the correctness-critical front door.
 *
 * Two parsers cooperate:
 *
 *   • `jsonc-parser` (VS Code's scanner, run in *strict* JSON mode) builds a
 *     source-faithful syntax tree that preserves what `JSON.parse` discards:
 *     duplicate object keys, exact source offsets, and the raw literal text of
 *     every number (so a value's precision can be judged before it is coerced to
 *     a JavaScript double). It also reports errors as structured codes, which
 *     translate into readable messages far more reliably than parsing English.
 *
 *   • the platform's `JSON.parse` is the *authority* on validity. Standard JSON
 *     is exactly what `JSON.parse` accepts, so a document is valid iff it parses.
 *     jsonc supplies the rich structure and error detail; `JSON.parse` supplies
 *     the yes/no. In practice the two always agree on the verdict; treating
 *     `JSON.parse` as final removes any risk of the tree parser being fractionally
 *     stricter or looser than the specification.
 *
 * Deeply nested input can exhaust the call stack inside either recursive parser.
 * Both are wrapped so an overflow becomes an honest "too complex" outcome rather
 * than a crashed tab.
 */

import { type Node, parseTree, printParseErrorCode } from 'jsonc-parser';
import type { JsonParseError, SourcePosition } from './types';

/** Strict standard-JSON mode: no comments, no trailing commas. */
const STRICT_OPTIONS = {
  disallowComments: true,
  allowTrailingComma: false,
} as const;

/** Windowed length for the source-context snippet around a parse error. */
const CONTEXT_WINDOW = 80;

/** Maps a source offset to a 1-based line/column and exposes each line's text. */
export class LineIndex {
  private readonly lineStarts: number[];

  constructor(private readonly source: string) {
    const starts = [0];
    for (let i = 0; i < source.length; i++) {
      const code = source.charCodeAt(i);
      if (code === 0x0a) {
        starts.push(i + 1);
      } else if (code === 0x0d) {
        // Treat CRLF as one break; a lone CR still starts a new line.
        if (source.charCodeAt(i + 1) === 0x0a) i++;
        starts.push(i + 1);
      }
    }
    this.lineStarts = starts;
  }

  get lineCount(): number {
    return this.lineStarts.length;
  }

  /** Locate an offset. Offsets past the end clamp to the final position. */
  locate(offset: number): SourcePosition {
    const clamped = Math.max(0, Math.min(offset, this.source.length));
    // Binary search for the last line start <= clamped.
    let lo = 0;
    let hi = this.lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.lineStarts[mid]! <= clamped) lo = mid;
      else hi = mid - 1;
    }
    return { offset: clamped, line: lo + 1, column: clamped - this.lineStarts[lo]! + 1 };
  }

  /** The text of a 1-based line, excluding its terminator. */
  lineText(line: number): string {
    const start = this.lineStarts[line - 1];
    if (start === undefined) return '';
    const nextStart = this.lineStarts[line] ?? this.source.length + 1;
    return this.source.slice(start, nextStart - 1).replace(/\r$/, '');
  }
}

export type ParseOutcome =
  | { kind: 'valid'; tree: Node; lineIndex: LineIndex }
  | { kind: 'invalid'; error: JsonParseError }
  | { kind: 'too-complex'; reason: string };

function isRangeError(err: unknown): boolean {
  return err instanceof RangeError || (err instanceof Error && /call stack/i.test(err.message));
}

/**
 * Parse a non-empty source string. The caller is responsible for treating
 * blank/whitespace-only input as "empty" before calling here.
 */
export function parseDocument(source: string): ParseOutcome {
  const lineIndex = new LineIndex(source);

  // 1. Build the strict syntax tree (may overflow on pathological nesting).
  let tree: Node | undefined;
  const errors: { error: number; offset: number; length: number }[] = [];
  try {
    tree = parseTree(source, errors, STRICT_OPTIONS);
  } catch (err) {
    if (isRangeError(err)) {
      return { kind: 'too-complex', reason: 'nesting' };
    }
    return { kind: 'too-complex', reason: 'engine' };
  }

  // 2. Ask the platform parser for the authoritative verdict.
  let jsonValid = true;
  try {
    JSON.parse(source);
  } catch (err) {
    if (isRangeError(err)) {
      return { kind: 'too-complex', reason: 'nesting' };
    }
    jsonValid = false;
  }

  if (jsonValid) {
    if (!tree) {
      // JSON.parse accepted it but the tree parser produced nothing — treat as a
      // safe degrade rather than pretend we can inspect it.
      return { kind: 'too-complex', reason: 'engine' };
    }
    return { kind: 'valid', tree, lineIndex };
  }

  // 3. Invalid: translate the earliest structured error for a useful message.
  return { kind: 'invalid', error: buildParseError(source, errors, lineIndex) };
}

/** Build a readable, positioned error from jsonc's structured error list. */
function buildParseError(
  source: string,
  errors: { error: number; offset: number; length: number }[],
  lineIndex: LineIndex,
): JsonParseError {
  const sorted = [...errors].sort((a, b) => a.offset - b.offset);
  const primary = sorted[0];

  if (!primary) {
    // JSON.parse rejected but jsonc found nothing to report (not observed in
    // practice). Fall back to an honest generic message at the end of input.
    const position = lineIndex.locate(source.length);
    return {
      code: 'Unknown',
      message: 'This is not valid JSON, but the exact problem could not be localized.',
      position,
      context: buildContext(lineIndex, position),
      additionalErrors: 0,
    };
  }

  const position = lineIndex.locate(primary.offset);
  const codeName = printParseErrorCode(primary.error);
  // Any error whose preceding text is *itself* a complete JSON value is really
  // "unexpected trailing content", whatever specific token the scanner tripped on.
  const message =
    codeName !== 'EndOfFileExpected' && isTrailingContent(source, primary.offset)
      ? 'Unexpected extra content after the JSON value. A JSON document must contain exactly one value.'
      : describeError(codeName, source, primary.offset);

  return {
    code: codeName,
    message,
    position,
    context: buildContext(lineIndex, position),
    additionalErrors: Math.max(0, sorted.length - 1),
  };
}

/** True when everything up to `offset` is already a complete, valid JSON value. */
function isTrailingContent(source: string, offset: number): boolean {
  if (offset <= 0) return false;
  const head = source.slice(0, offset);
  if (head.trim() === '') return false;
  try {
    JSON.parse(head);
    return true;
  } catch {
    return false;
  }
}

/** True when the next non-whitespace source character is a closing bracket. */
function nextIsClose(source: string, offset: number): boolean {
  for (let i = offset; i < source.length; i++) {
    const ch = source[i]!;
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') continue;
    return ch === '}' || ch === ']';
  }
  return false;
}

/** True when the previous non-whitespace source character is a comma. */
function prevIsComma(source: string, offset: number): boolean {
  for (let i = offset - 1; i >= 0; i--) {
    const ch = source[i]!;
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') continue;
    return ch === ',';
  }
  return false;
}

/**
 * Turn a jsonc parse-error code *name* into an Oddments-language explanation,
 * refining a few recognizable non-JSON constructs (trailing commas, comments,
 * single quotes, unquoted keys) into messages that name the actual mistake.
 * Switching on the name (from `printParseErrorCode`) rather than the numeric enum
 * keeps this compatible with `isolatedModules`, which forbids referencing the
 * library's ambient const enum directly.
 */
function describeError(codeName: string, source: string, offset: number): string {
  const trailingComma = prevIsComma(source, offset) && nextIsClose(source, offset);

  switch (codeName) {
    case 'PropertyNameExpected':
      if (trailingComma) {
        return 'Trailing comma before a closing brace. Standard JSON does not allow a comma after the last property.';
      }
      return 'Expected a property name in double quotes here.';
    case 'ValueExpected':
      if (trailingComma) {
        return 'Trailing comma before a closing bracket. Standard JSON does not allow a comma after the last element.';
      }
      return 'Expected a value here — a string, number, object, array, true, false, or null.';
    case 'ColonExpected':
      return 'Expected a colon (":") between the property name and its value.';
    case 'CommaExpected':
      return 'Expected a comma (",") between items. A separator is missing.';
    case 'CloseBraceExpected':
      return 'Expected a closing brace ("}"). An object was opened but never closed.';
    case 'CloseBracketExpected':
      return 'Expected a closing bracket ("]"). An array was opened but never closed.';
    case 'EndOfFileExpected':
      return 'Unexpected extra content after the JSON value. A JSON document must contain exactly one value.';
    case 'UnexpectedEndOfString':
      return 'A string is missing its closing quote (or contains an unescaped line break).';
    case 'UnexpectedEndOfNumber':
      return 'A number ends unexpectedly — for example, a trailing decimal point with no digits.';
    case 'UnexpectedEndOfComment':
      return 'A comment was left unclosed — and standard JSON does not allow comments at all.';
    case 'InvalidNumberFormat':
      return 'This number is not written in a valid JSON format.';
    case 'InvalidUnicode':
      return 'Invalid "\\u" escape — a Unicode escape needs exactly four hexadecimal digits.';
    case 'InvalidEscapeCharacter':
      return 'Invalid string escape. JSON allows \\" \\\\ \\/ \\b \\f \\n \\r \\t and \\uXXXX.';
    case 'InvalidCharacter':
      return 'A string contains a raw control character. Control characters must be written as escapes.';
    case 'InvalidCommentToken':
      return 'Comments are not allowed in standard JSON.';
    case 'InvalidSymbol': {
      const ch = source[offset];
      if (ch === "'") {
        return 'Single quotes are not valid in JSON — strings and property names must use double quotes.';
      }
      if (ch && /[A-Za-z_]/.test(ch)) {
        return 'Unexpected bare word. Property names must be double-quoted, and only true, false, and null are bare literals.';
      }
      return 'Unexpected token here.';
    }
    default:
      return 'This is not valid JSON.';
  }
}

/** A short, windowed source snippet with a caret under the failing column. */
function buildContext(lineIndex: LineIndex, position: SourcePosition): string {
  const full = lineIndex.lineText(position.line);
  const col = position.column;

  // Window very long lines so we never dump a megabyte into the message.
  let text = full;
  let caretCol = col;
  let prefixEllipsis = false;
  if (full.length > CONTEXT_WINDOW * 2) {
    const start = Math.max(0, col - 1 - CONTEXT_WINDOW);
    text = full.slice(start, col - 1 + CONTEXT_WINDOW);
    caretCol = col - start;
    prefixEllipsis = start > 0;
    if (prefixEllipsis) {
      text = '…' + text;
      caretCol += 1;
    }
    if (col - 1 + CONTEXT_WINDOW < full.length) text = text + '…';
  }

  const gutter = String(position.line);
  const pad = ' '.repeat(gutter.length);
  // Build the caret's leading pad from the actual snippet characters so a tab in
  // the source expands to the same width in the caret line as in the text line
  // (both render inside the same <pre>); every other character maps to one space.
  const caretPad = [...text.slice(0, Math.max(0, caretCol - 1))]
    .map((ch) => (ch === '\t' ? '\t' : ' '))
    .join('');
  return `${gutter} | ${text}\n${pad} | ${caretPad}^`;
}
