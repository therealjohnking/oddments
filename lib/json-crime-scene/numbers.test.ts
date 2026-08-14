import { describe, expect, it } from 'vitest';
import { inspectNumberLiteral } from './numbers';

describe('inspectNumberLiteral', () => {
  it('accepts the maximum safe integer', () => {
    expect(inspectNumberLiteral('9007199254740991', 9007199254740991)).toBeNull();
  });

  it('flags an integer just past the safe range and reports the rounded value', () => {
    const issue = inspectNumberLiteral('9007199254740993', 9007199254740993);
    expect(issue?.kind).toBe('unsafe-integer');
    // 9007199254740993 is not representable; JS rounds it to ...992.
    expect(issue?.parsedText).toBe('9007199254740992');
  });

  it('flags a very large 64-bit integer', () => {
    const issue = inspectNumberLiteral('9223372036854775807', 9223372036854775807);
    expect(issue?.kind).toBe('unsafe-integer');
    expect(issue?.raw).toBe('9223372036854775807');
  });

  it('flags a large negative integer', () => {
    const issue = inspectNumberLiteral('-9223372036854775808', -9223372036854775808);
    expect(issue?.kind).toBe('unsafe-integer');
  });

  it('flags overflow to Infinity', () => {
    const issue = inspectNumberLiteral('1e400', Number('1e400'));
    expect(issue?.kind).toBe('overflow');
    expect(issue?.parsedText).toBe('Infinity');
  });

  it('does not flag ordinary decimals', () => {
    expect(inspectNumberLiteral('0.1', 0.1)).toBeNull();
    expect(inspectNumberLiteral('-42.5', -42.5)).toBeNull();
    expect(inspectNumberLiteral('1.5e10', 1.5e10)).toBeNull();
  });

  it('does not flag ordinary small integers', () => {
    expect(inspectNumberLiteral('0', 0)).toBeNull();
    expect(inspectNumberLiteral('-7', -7)).toBeNull();
    expect(inspectNumberLiteral('1000000', 1000000)).toBeNull();
  });
});
