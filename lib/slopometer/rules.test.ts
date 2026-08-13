import { describe, expect, it } from 'vitest';
import { analyzeText } from './analyze';
import type { Finding } from './types';

/** Analyze `text` and return the finding for `ruleId`, if it fired. */
function rule(text: string, ruleId: string): Finding | undefined {
  return analyzeText(text).findings.find((f) => f.ruleId === ruleId);
}

/** Build filler prose of roughly `words` plain words. */
function filler(words: number): string {
  return Array.from({ length: words }, (_, i) => `word${i % 7}`).join(' ');
}

describe('canned rhetorical openers', () => {
  it('fires case-insensitively and preserves the exact evidence range', () => {
    const f = rule("HERE'S THE THING. Cats are great. Dogs too.", 'canned-openers')!;
    expect(f.occurrences).toBe(1);
    const ev = f.evidence[0]!;
    expect("HERE'S THE THING. Cats are great. Dogs too.".slice(ev.start, ev.end)).toBe(
      "HERE'S THE THING",
    );
  });

  it('matches through curly apostrophes, mapping offsets back to the original', () => {
    const input = 'I said “here’s the thing” to them today, honestly.';
    const f = rule(input, 'canned-openers')!;
    const ev = f.evidence[0]!;
    const matched = input.slice(ev.start, ev.end);
    expect(matched.toLowerCase()).toContain('here');
    expect(matched).toContain('’'); // the curly apostrophe survived intact
  });

  it('scores 3 points per occurrence', () => {
    const f = rule("The truth is this. Here's the thing about that.", 'canned-openers')!;
    expect(f.occurrences).toBe(2);
    expect(f.contribution).toBe(6);
  });
});

describe('audience instructions', () => {
  it('fires on performative commands', () => {
    expect(rule('Read that again. Then move on.', 'audience-commands')).toBeDefined();
  });

  it('does not fire on the ordinary verb "save this <thing>"', () => {
    expect(
      rule('Please save this file before you close the editor window.', 'audience-commands'),
    ).toBeUndefined();
  });
});

describe('contrast templates', () => {
  it('detects "it\'s not X. it\'s Y."', () => {
    const f = rule("It's not about the money. It's about impact.", 'contrast-template')!;
    expect(f.occurrences).toBe(1);
  });

  it('detects "not X, but Y"', () => {
    expect(rule('This is not a job, but a calling.', 'contrast-template')).toBeDefined();
  });

  it('does not fire on ordinary sentences', () => {
    expect(
      rule('I went to the store and bought some milk today.', 'contrast-template'),
    ).toBeUndefined();
  });
});

describe('corporate jargon', () => {
  it('weights strong phrases at 2 and softer words at 1', () => {
    // Two strong phrases (circle back, boil the ocean) → 4 points.
    const strong = rule("Let's circle back and boil the ocean tomorrow.", 'corporate-jargon')!;
    expect(strong.occurrences).toBe(2);
    expect(strong.contribution).toBe(4);

    // One soft word (bandwidth) → 1 point.
    const mild = rule('We simply do not have the bandwidth right now.', 'corporate-jargon')!;
    expect(mild.occurrences).toBe(1);
    expect(mild.contribution).toBe(1);
  });

  it('requires a real word boundary (no "north star" inside "northstar")', () => {
    expect(
      rule('Our northstar metric is retention across the platform.', 'corporate-jargon'),
    ).toBeUndefined();
  });

  it('caps so a jargon avalanche cannot dominate', () => {
    const text =
      'circle back, boil the ocean, north star, low-hanging fruit, thought leadership, ' +
      'paradigm shift, deep dive, synergy, operationalize, table stakes.';
    const f = rule(text, 'corporate-jargon')!;
    expect(f.atCap).toBe(true);
    expect(f.contribution).toBe(16);
  });
});

describe('inspirational clichés', () => {
  it('fires on motivational phrasing', () => {
    expect(rule('This is a real game changer for us.', 'content-cliches')).toBeDefined();
  });
});

describe('punctuation — normalization by length', () => {
  it('scores em dashes densely in short text but not sparsely in long text', () => {
    const dense = rule('a — b — c', 'em-dash');
    expect(dense).toBeDefined();
    expect(dense!.contribution).toBeGreaterThan(0);

    const sparse = rule(`${filler(320)} a — b — c`, 'em-dash');
    expect(sparse).toBeUndefined();
  });

  it('ignores an en dash used as a numeric range', () => {
    expect(rule('The years 2013–2014 were quiet.', 'em-dash')).toBeUndefined();
  });
});

describe('punctuation — exclamation marks', () => {
  it('counts shouting but not the "!=" operator', () => {
    expect(rule('Wow! Amazing! Incredible!', 'exclamation')).toBeDefined();
    expect(rule('if (a != b) return a != c;', 'exclamation')).toBeUndefined();
  });
});

describe('punctuation — ellipses', () => {
  it('counts trailing ellipses but not a spread operator', () => {
    expect(rule('Well... I guess... maybe...', 'ellipsis')).toBeDefined();
    expect(rule('const x = [...arr, ...more, ...rest];', 'ellipsis')).toBeUndefined();
  });
});

describe('punctuation — emoji', () => {
  it('counts pictographic emoji', () => {
    expect(rule('Great work team 🚀🔥💡', 'emoji')).toBeDefined();
  });

  it('does not count arrows or the copyright sign as emoji', () => {
    expect(rule('a → b → c → d and © 2024 Corp.', 'emoji')).toBeUndefined();
  });
});

describe('punctuation — all caps', () => {
  it('flags shouting words but allowlists common acronyms', () => {
    const f = rule('This is HUGE and honestly IMPORTANT news.', 'all-caps')!;
    expect(f.occurrences).toBe(2);
    const ev = f.evidence[0]!;
    expect('This is HUGE and honestly IMPORTANT news.'.slice(ev.start, ev.end)).toBe('HUGE');

    expect(rule('The CEO used the API and shipped the HTML and PDF.', 'all-caps')).toBeUndefined();
  });
});

describe('structure — rhetorical questions', () => {
  it('needs a real stack: 6+ sentences and 3+ questions', () => {
    const stacked = 'Ready? Sure? Really? It matters. It works. It ships.';
    expect(rule(stacked, 'rhetorical-questions')).toBeDefined();

    // Only three sentences, even if all questions — below the sample-size gate.
    expect(rule('Ready? Sure? Really?', 'rhetorical-questions')).toBeUndefined();
  });
});

describe('structure — one-sentence paragraphs', () => {
  it('fires when most paragraphs are a single sentence', () => {
    const text = ['One.', 'Two.', 'Three.', 'Four.', 'Five.', 'Six.'].join('\n\n');
    expect(rule(text, 'one-sentence-paragraphs')).toBeDefined();
  });

  it('does not fire on ordinary multi-sentence paragraphs', () => {
    const text =
      'A first paragraph with two sentences. It keeps going.\n\n' +
      'A second paragraph, also with more than one sentence. Still going here.';
    expect(rule(text, 'one-sentence-paragraphs')).toBeUndefined();
  });
});

describe('structure — staccato fragments', () => {
  it('flags a run of very short sentences', () => {
    const text =
      'This is a normal opening sentence here. It continues for a little while. ' +
      'Work hard. Stay humble. Keep shipping. And we go on normally now.';
    const f = rule(text, 'staccato-fragments')!;
    expect(f.contribution).toBeGreaterThan(0);
  });

  it('does not fire on ordinary prose', () => {
    const text =
      'The meeting ran long but we covered everything on the agenda. ' +
      'Afterwards we grabbed lunch and talked through the roadmap in detail. ' +
      'It was a productive afternoon overall and everyone left satisfied.';
    expect(rule(text, 'staccato-fragments')).toBeUndefined();
  });
});

describe('structure — list & heading density', () => {
  it('fires when the text is mostly bullets', () => {
    const text = [
      '- first point',
      '- second point',
      '- third point',
      '- fourth point',
      '- fifth point',
      '- sixth point',
    ].join('\n');
    expect(rule(text, 'list-heading-density')).toBeDefined();
  });
});

describe('repetition — repeated sentence openings', () => {
  it('flags the same opener used across many sentences', () => {
    const text =
      'This is one thing. This is another thing. This is a third thing. ' +
      'This is a fourth. Something else entirely here. And a final different close.';
    const f = rule(text, 'repeated-openings')!;
    expect(f.detail).toContain('this');
    expect(f.contribution).toBeGreaterThan(0);
  });

  it('does not fire when openings vary', () => {
    const text =
      'The sky is blue today. Rain arrived by noon. Later the clouds cleared. ' +
      'Birds returned to the yard. Evening came quietly. Everyone slept well.';
    expect(rule(text, 'repeated-openings')).toBeUndefined();
  });
});
