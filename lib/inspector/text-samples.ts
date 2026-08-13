/**
 * A single, deliberately loaded example that exercises most of the detector.
 *
 * Every non-ASCII and invisible character is written as an explicit \u escape
 * so the source stays fully reviewable — you can see exactly which character is
 * where (a literal Cyrillic homoglyph, for instance, would be indistinguishable
 * from its Latin lookalike right here in the file).
 *
 * It contains: a leading BOM, a zero-width space inside a word, an em dash,
 * curly quotes, a right-single-quote apostrophe, a non-breaking hyphen, a
 * no-break space and a narrow no-break space, trailing spaces, a tab, a
 * Cyrillic homoglyph, a right-to-left override ("Trojan Source" style), a soft
 * hyphen, a legitimate zero-width joiner inside a family emoji, and a mix of
 * CRLF and LF line endings.
 */
export const EXAMPLE_TEXT: string =
  '\uFEFFHello\u200Bworld \u2014 welcome to Oddments.\r\n' +
  'Smart quotes: \u2018single\u2019 and \u201Cdouble\u201D, and it\u2019s an apostrophe.\n' +
  'A non\u2011breaking hyphen, a no\u00A0break space, and 10\u00A0kg.  \n' +
  '\tIndented with a tab, then a narrow\u202Fspace.\n' +
  'Homoglyph link: p\u0430ypal.com \u2014 that \u201C\u0430\u201D is Cyrillic, not Latin.\n' +
  'Bidi trick: \u202Egpj.eciov\u202C, plus a soft\u00ADhyphen hiding in this word.\n' +
  'Legit zero-width joiner (family emoji): \u{1F468}\u200D\u{1F469}\u200D\u{1F467}.';
