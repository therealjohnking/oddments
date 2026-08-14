/**
 * Numeric-safety inspection. Standard JSON numbers have unlimited precision, but
 * JavaScript (and therefore `JSON.parse`) represents every one as a 64-bit float.
 * Integers beyond ±(2^53 − 1) are silently rounded, so the value your code reads
 * differs from the digits in the source. Because the raw literal is read straight
 * from the source text — before any coercion — the exact discrepancy can be shown.
 */

/** The largest/smallest integer a JS Number can represent without rounding. */
export const SAFE_MIN = BigInt(Number.MIN_SAFE_INTEGER);
export const SAFE_MAX = BigInt(Number.MAX_SAFE_INTEGER);

export interface NumberIssue {
  kind: 'unsafe-integer' | 'overflow';
  /** The exact source literal. */
  raw: string;
  /** How JavaScript actually represents it (the rounded / infinite value). */
  parsedText: string;
}

// Only plain integer literals are precision-checked. Integers written in
// exponent form (e.g. `9007199254740993e0`) are intentionally not flagged:
// distinguishing a lossy integer-in-exponent-form from ordinary, legitimate
// scientific notation (`1e21`, common and not a mistake) reliably would require
// far more than a regex, and would risk noisy false positives. Real JSON writes
// integer ids as plain digits, which is exactly the high-value case caught here.
const INTEGER_LITERAL = /^-?\d+$/;

/**
 * Inspect one number literal (its exact source text plus the value JS parsed it
 * to). Returns an issue only for genuinely lossy cases:
 *
 *   • an integer literal whose magnitude exceeds the safe range (digits change);
 *   • any literal that overflows the double range to ±Infinity.
 *
 * Ordinary decimals are *not* flagged: every finite decimal is an approximation
 * in binary floating point, so flagging them would be noise rather than signal.
 */
export function inspectNumberLiteral(raw: string, parsed: number): NumberIssue | null {
  if (!Number.isFinite(parsed)) {
    return { kind: 'overflow', raw, parsedText: parsed > 0 ? 'Infinity' : '-Infinity' };
  }
  if (INTEGER_LITERAL.test(raw)) {
    let big: bigint;
    try {
      big = BigInt(raw);
    } catch {
      return null;
    }
    if (big > SAFE_MAX || big < SAFE_MIN) {
      return { kind: 'unsafe-integer', raw, parsedText: String(parsed) };
    }
  }
  return null;
}
