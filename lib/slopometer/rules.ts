/**
 * The Slopometer rule catalogue.
 *
 * Each rule is a small, self-contained detector that inspects the tokenized
 * text and, if it fires, returns a structured result: a count, an explanation,
 * a capped point contribution, and (where the crime maps to real characters)
 * the exact evidence ranges. Rules never touch React or the DOM.
 *
 * Design bias, per Slopometer's premise ("detect writing crimes, not AI"):
 *  - Prefer phrase-level matches over penalizing ordinary single words.
 *  - Normalize punctuation/structure by length so long text isn't punished.
 *  - Cap every rule so one habit can't run away with the score.
 *  - Everything is deterministic and explainable.
 */

import { densityPoints, occurrencePoints, ratioPoints, type CappedPoints } from './score';
import { firstWord, type Line, type Paragraph, type Sentence } from './text';
import type { EvidenceRange, SlopCategoryId, SlopCategoryMeta, TextMetrics } from './types';

export const SLOP_CATEGORIES: Record<SlopCategoryId, SlopCategoryMeta> = {
  'rhetorical-setup': {
    id: 'rhetorical-setup',
    label: 'Canned rhetorical setups',
    blurb: 'Stock phrases that announce a point instead of making one.',
  },
  'audience-instruction': {
    id: 'audience-instruction',
    label: 'Performative audience instructions',
    blurb: 'Lines that direct the reader to react, save, or feel something.',
  },
  'contrast-template': {
    id: 'contrast-template',
    label: 'Contrast templates',
    blurb: 'The "it\'s not X, it\'s Y" construction and its many relatives.',
  },
  'corporate-jargon': {
    id: 'corporate-jargon',
    label: 'Corporate jargon',
    blurb: 'Business vocabulary that has drifted loose from meaning.',
  },
  'content-cliche': {
    id: 'content-cliche',
    label: 'Inspirational content language',
    blurb: 'Motivational-poster phrasing and engagement-bait vocabulary.',
  },
  structure: {
    id: 'structure',
    label: 'Structural tendencies',
    blurb: 'Habits of shape: one-line paragraphs, staccato bursts, bullet walls.',
  },
  punctuation: {
    id: 'punctuation',
    label: 'Punctuation & emphasis',
    blurb: 'Em dashes, exclamation marks, ellipses, emoji, and shouting caps.',
  },
  repetition: {
    id: 'repetition',
    label: 'Repetitive constructions',
    blurb: 'The same sentence opening, again and again and again.',
  },
};

export interface RuleContext {
  /** The original, unmodified input. Offsets everywhere index into this. */
  text: string;
  /** Same string with curly quotes/apostrophes straightened, 1:1 by length. */
  matchText: string;
  metrics: TextMetrics;
  words: number;
  sentences: Sentence[];
  paragraphs: Paragraph[];
  lines: Line[];
}

export interface RuleResult {
  ruleId: string;
  category: SlopCategoryId;
  title: string;
  explanation: string;
  occurrences: number;
  /** Points, already capped to this rule's maximum (pre-rounding). */
  points: number;
  atCap: boolean;
  evidence: EvidenceRange[];
  detail?: string;
  evidenceTruncated: boolean;
}

export interface RuleDef {
  id: string;
  category: SlopCategoryId;
  title: string;
  detect(ctx: RuleContext): RuleResult | null;
}

const MAX_EVIDENCE = 60;

// ── Phrase lists ───────────────────────────────────────────────────────────

/** Category 1 — canned rhetorical setups. */
const CANNED_OPENERS = [
  "here's the thing",
  "here's the deal",
  "here's the kicker",
  "here's the truth",
  "here's what nobody tells you",
  "here's what no one tells you",
  'what nobody tells you',
  "here's why",
  'the truth is',
  'the reality is',
  'the fact of the matter is',
  'the bottom line is',
  "let's be clear",
  'let me be clear',
  "let's be honest",
  "let's be real",
  "let's face it",
  'make no mistake',
  'truth be told',
  'believe it or not',
  'plot twist',
  'spoiler alert',
  'newsflash',
  'news flash',
  'at the end of the day',
  'consider this',
  'think about it',
  'picture this',
  'hot take',
];

/** Category 2 — performative audience instructions. */
const AUDIENCE_COMMANDS = [
  'let that sink in',
  'let that marinate',
  'read that again',
  'read it again',
  'say it louder',
  'say it with me',
  'think about that',
  'sit with that',
  'bookmark this',
  'save this post',
  'save this for later',
  'share this with someone',
  'tag someone who',
  'tag a friend who',
  'drop a comment',
  'comment below',
  'like and share',
  'follow for more',
  'repeat after me',
  'trust me on this',
];

/** Category 4 — corporate jargon (high-confidence phrases; weight 2). */
const JARGON_STRONG = [
  'circle back',
  'double-click on',
  'level-set',
  'move the needle',
  'low-hanging fruit',
  'north star',
  'boil the ocean',
  'operationalize',
  'socialize this',
  'socialize it',
  'action this',
  'action item',
  'strategic alignment',
  'stakeholder alignment',
  'thought leadership',
  'thought leader',
  'value-add',
  'best-in-class',
  'unlock value',
  'unlock potential',
  'scalable solution',
  'paradigm shift',
  'core competency',
  'core competencies',
  'deep dive',
  'take this offline',
  'run it up the flagpole',
  'open the kimono',
  'drink the kool-aid',
  'table stakes',
  'single source of truth',
  'synergy',
  'synergies',
  'synergize',
  'mission-critical',
  'growth hacking',
  'boots on the ground',
  'peel the onion',
  'move fast and break things',
];

/** Category 4 — softer jargon that is *often* but not always slop (weight 1). */
const JARGON_MILD = [
  'leverage',
  'leveraging',
  'leverages',
  'bandwidth',
  'ecosystem',
  'holistic',
  'impactful',
  'actionable',
  'learnings',
  'ideate',
  'ideation',
  'disrupt',
  'disruptive',
  'empower',
  'empowering',
  'streamline',
  'streamlined',
  'frictionless',
  'turnkey',
  'cutting-edge',
  'next-level',
  'right-size',
  'right-sizing',
];

/** Category 5 — inspirational / content clichés. */
const CONTENT_CLICHES = [
  'game changer',
  'this changed everything',
  'changed everything',
  'powerful reminder',
  'gentle reminder',
  'friendly reminder',
  'unlock your potential',
  'your full potential',
  'reach your potential',
  'authentic self',
  'best version of yourself',
  'the best version of you',
  'secret sauce',
  'one simple truth',
  'simple truth',
  'food for thought',
  'mind-blowing',
  "in today's fast-paced world",
  'now more than ever',
  'trust the process',
  'embrace the journey',
  'dream big',
  'stay hungry',
  'rise and grind',
  'work smarter not harder',
  'level up',
  'leveling up',
];

// ── Regex helpers ──────────────────────────────────────────────────────────

const WORD_CLASS = '\\p{L}\\p{N}_';

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Turn a phrase into an alternative that tolerates space/hyphen variation. */
function phraseAlternative(phrase: string): string {
  const tokens = phrase
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean)
    .map(escapeRegExp);
  return tokens.join('[\\s-]+');
}

/** One combined, word-boundary-anchored regex for a list of phrases. */
function buildPhraseRegex(phrases: string[]): RegExp {
  const alts = [...phrases]
    .sort((a, b) => b.length - a.length)
    .map(phraseAlternative)
    .join('|');
  return new RegExp(`(?<![${WORD_CLASS}])(?:${alts})(?![${WORD_CLASS}])`, 'giu');
}

const RE_CANNED = buildPhraseRegex(CANNED_OPENERS);
const RE_AUDIENCE = buildPhraseRegex(AUDIENCE_COMMANDS);
const RE_JARGON_STRONG = buildPhraseRegex(JARGON_STRONG);
const RE_JARGON_MILD = buildPhraseRegex(JARGON_MILD);
const RE_CLICHE = buildPhraseRegex(CONTENT_CLICHES);

// Contrast templates. R1: "not X, but Y". R2: "it's not X … it's Y".
const RE_CONTRAST_NOT_BUT = /\bnot\s+[^,.!?\n]{1,50}?,?\s+but\s+[^.!?\n]{1,50}/giu;
const RE_CONTRAST_ITS_NOT =
  /\b(?:it'?s|this\s+is|that'?s|they'?re|you'?re|we'?re|there'?s)\s+not\s+[^.!?\n]{1,70}?[.!?…,—–]+\s*(?:it'?s|this\s+is|that'?s|they'?re|you'?re|we'?re|there'?s)\b/giu;

// Punctuation.
const RE_EM_DASH = /[—―]|(?<=\s)–(?=\s)/g;
const RE_EXCLAMATION = /!(?![=\p{L}\p{N}])/gu;
const RE_ELLIPSIS = /(?:…|\.{3,})(?![\p{L}\p{N}_])/gu;
const RE_EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}]/gu;
const RE_ALL_CAPS = /(?<![\p{L}\p{N}_])\p{Lu}{2,}(?![\p{L}\p{N}_])/gu;

const CAPS_ALLOWLIST = new Set([
  'OK',
  'TV',
  'CEO',
  'CTO',
  'CFO',
  'COO',
  'CMO',
  'VP',
  'HR',
  'PR',
  'AI',
  'ML',
  'API',
  'APIS',
  'URL',
  'URLS',
  'USA',
  'US',
  'UK',
  'EU',
  'UN',
  'UX',
  'UI',
  'ID',
  'IDS',
  'IT',
  'PM',
  'AM',
  'FAQ',
  'FAQS',
  'PDF',
  'HTML',
  'CSS',
  'JS',
  'SQL',
  'HTTP',
  'HTTPS',
  'USB',
  'GPU',
  'CPU',
  'RAM',
  'SDK',
  'CLI',
  'B2B',
  'B2C',
  'KPI',
  'KPIS',
  'ROI',
  'SEO',
  'NASA',
  'FBI',
  'CIA',
  'NATO',
  'GDP',
  'ATM',
  'PIN',
  'GPS',
  'DIY',
  'FYI',
  'ASAP',
  'AKA',
  'RSVP',
  'ETA',
  'EOD',
  'WFH',
  'OOO',
  'NDA',
  'MVP',
  'SLA',
  'QA',
  'PDFS',
  'Q1',
  'Q2',
  'Q3',
  'Q4',
  'H1',
  'H2',
]);

// ── Scan primitives ────────────────────────────────────────────────────────

interface ScanResult {
  count: number;
  evidence: EvidenceRange[];
  truncated: boolean;
}

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Run a regex over `haystack`, collecting a bounded set of evidence ranges. The
 * offsets index into `ctx.text` (haystack must be the same length as ctx.text —
 * either ctx.text itself or its 1:1 match-normalized twin). `note` is derived
 * from `noteFor`, or the collapsed match when omitted.
 */
function scan(
  ctx: RuleContext,
  haystack: string,
  re: RegExp,
  ruleId: string,
  options: { pad?: number; noteFor?: (match: string) => string } = {},
): ScanResult {
  const pad = options.pad ?? 0;
  const evidence: EvidenceRange[] = [];
  let count = 0;
  let truncated = false;
  re.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(haystack)) !== null) {
    if (match[0].length === 0) {
      re.lastIndex += 1;
      continue;
    }
    count += 1;
    const start = match.index;
    const end = start + match[0].length;
    if (evidence.length < MAX_EVIDENCE) {
      const exFrom = Math.max(0, start - pad);
      const exTo = Math.min(ctx.text.length, end + pad);
      const raw = ctx.text.slice(exFrom, exTo);
      evidence.push({
        id: `${ruleId}-${start}`,
        start,
        end,
        excerpt: pad > 0 ? collapse(raw) : raw,
        note: options.noteFor
          ? options.noteFor(collapse(match[0]))
          : collapse(match[0]).toLowerCase(),
      });
    } else {
      truncated = true;
    }
  }
  return { count, evidence, truncated };
}

/** Distinct evidence notes, first `k`, quoted, for use in explanations. */
function sampleNotes(evidence: EvidenceRange[], k: number): string {
  const seen: string[] = [];
  for (const e of evidence) {
    const note = e.note ?? e.excerpt;
    if (note && !seen.includes(note)) seen.push(note);
    if (seen.length >= k) break;
  }
  const quoted = seen.map((s) => `"${s}"`).join(', ');
  return quoted;
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/** Merge overlapping/adjacent ranges, keeping the widest span. */
function mergeRanges(ranges: EvidenceRange[], ruleId: string): EvidenceRange[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: EvidenceRange[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.start < last.end) {
      if (range.end > last.end) last.end = range.end;
    } else {
      merged.push({ ...range, id: `${ruleId}-${range.start}` });
    }
  }
  return merged;
}

// ── Detectors ──────────────────────────────────────────────────────────────

function phraseResult(
  ctx: RuleContext,
  def: { id: string; category: SlopCategoryId; title: string },
  re: RegExp,
  perOccurrence: number,
  cap: number,
  describe: (count: number, sample: string) => string,
): RuleResult | null {
  const { count, evidence, truncated } = scan(ctx, ctx.matchText, re, def.id);
  if (count === 0) return null;
  const { points, atCap } = occurrencePoints(count, perOccurrence, cap);
  return {
    ruleId: def.id,
    category: def.category,
    title: def.title,
    occurrences: count,
    points,
    atCap,
    evidence,
    evidenceTruncated: truncated,
    explanation: describe(count, sampleNotes(evidence, 3)),
  };
}

const ruleCanned: RuleDef = {
  id: 'canned-openers',
  category: 'rhetorical-setup',
  title: 'Canned rhetorical openers',
  detect: (ctx) =>
    phraseResult(
      ctx,
      { id: 'canned-openers', category: 'rhetorical-setup', title: 'Canned rhetorical openers' },
      RE_CANNED,
      3,
      12,
      (n, sample) =>
        `${n} stock ${plural(n, 'setup', 'setups')} that announce a point instead of making one (e.g. ${sample}).`,
    ),
};

const ruleAudience: RuleDef = {
  id: 'audience-commands',
  category: 'audience-instruction',
  title: 'Audience instructions',
  detect: (ctx) =>
    phraseResult(
      ctx,
      { id: 'audience-commands', category: 'audience-instruction', title: 'Audience instructions' },
      RE_AUDIENCE,
      3.5,
      14,
      (n, sample) =>
        `${n} performative ${plural(n, 'instruction', 'instructions')} telling the reader how to react (e.g. ${sample}).`,
    ),
};

const ruleCliche: RuleDef = {
  id: 'content-cliches',
  category: 'content-cliche',
  title: 'Inspirational clichés',
  detect: (ctx) =>
    phraseResult(
      ctx,
      { id: 'content-cliches', category: 'content-cliche', title: 'Inspirational clichés' },
      RE_CLICHE,
      2,
      14,
      (n, sample) =>
        `${n} motivational-content ${plural(n, 'cliché', 'clichés')} (e.g. ${sample}).`,
    ),
};

const ruleJargon: RuleDef = {
  id: 'corporate-jargon',
  category: 'corporate-jargon',
  title: 'Corporate jargon',
  detect: (ctx) => {
    const strong = scan(ctx, ctx.matchText, RE_JARGON_STRONG, 'corporate-jargon');
    const mild = scan(ctx, ctx.matchText, RE_JARGON_MILD, 'corporate-jargon');
    const count = strong.count + mild.count;
    if (count === 0) return null;
    const cap = 16;
    const raw = strong.count * 2 + mild.count * 1;
    const points = Math.min(raw, cap);
    const evidence = [...strong.evidence, ...mild.evidence].slice(0, MAX_EVIDENCE);
    return {
      ruleId: 'corporate-jargon',
      category: 'corporate-jargon',
      title: 'Corporate jargon',
      occurrences: count,
      points,
      atCap: raw >= cap,
      evidence,
      evidenceTruncated: strong.truncated || mild.truncated || evidence.length < count,
      explanation: `${count} jargon ${plural(count, 'term', 'terms')} doing the work meaning should (e.g. ${sampleNotes(evidence, 3)}).`,
    };
  },
};

const ruleContrast: RuleDef = {
  id: 'contrast-template',
  category: 'contrast-template',
  title: 'Contrast templates',
  detect: (ctx) => {
    const a = scan(ctx, ctx.matchText, RE_CONTRAST_NOT_BUT, 'contrast-template', {
      pad: 0,
      noteFor: () => 'not X, but Y',
    });
    const b = scan(ctx, ctx.matchText, RE_CONTRAST_ITS_NOT, 'contrast-template', {
      pad: 0,
      noteFor: () => "it's not X, it's Y",
    });
    const merged = mergeRanges([...a.evidence, ...b.evidence], 'contrast-template');
    // Re-derive excerpts/notes from the merged spans.
    const evidence = merged.map((range) => ({
      ...range,
      excerpt: collapse(ctx.text.slice(range.start, range.end)),
      note: 'not-X / but-Y construction',
    }));
    const count = evidence.length;
    if (count === 0) return null;
    const { points, atCap } = occurrencePoints(count, 4, 14);
    return {
      ruleId: 'contrast-template',
      category: 'contrast-template',
      title: 'Contrast templates',
      occurrences: count,
      points,
      atCap,
      evidence: evidence.slice(0, MAX_EVIDENCE),
      evidenceTruncated: count > MAX_EVIDENCE,
      explanation: `${count} "it's not X, it's Y"-style ${plural(count, 'construction', 'constructions')}. One is a flourish; several are a formula.`,
    };
  },
};

// ── Punctuation / emphasis ─────────────────────────────────────────────────

function densityResult(
  ctx: RuleContext,
  def: { id: string; category: SlopCategoryId; title: string },
  re: RegExp,
  params: { freeEvery: number; perExcess: number; cap: number; note: string },
  describe: (count: number, words: number) => string,
): RuleResult | null {
  const { count, evidence, truncated } = scan(ctx, ctx.text, re, def.id, {
    pad: 22,
    noteFor: () => params.note,
  });
  if (count === 0) return null;
  const { points, atCap }: CappedPoints = densityPoints(
    count,
    ctx.words,
    params.freeEvery,
    params.perExcess,
    params.cap,
  );
  if (points <= 0) return null;
  return {
    ruleId: def.id,
    category: def.category,
    title: def.title,
    occurrences: count,
    points,
    atCap,
    evidence,
    evidenceTruncated: truncated,
    explanation: describe(count, ctx.words),
    detail: `${count} across ${ctx.words} words.`,
  };
}

const ruleEmDash: RuleDef = {
  id: 'em-dash',
  category: 'punctuation',
  title: 'Em-dash enthusiasm',
  detect: (ctx) =>
    densityResult(
      ctx,
      { id: 'em-dash', category: 'punctuation', title: 'Em-dash enthusiasm' },
      RE_EM_DASH,
      { freeEvery: 140, perExcess: 1, cap: 8, note: 'em dash' },
      (n, w) =>
        `${n} em ${plural(n, 'dash', 'dashes')} across ${w} words.${n >= 8 ? ' This is becoming a lifestyle.' : ''}`,
    ),
};

const ruleExclamation: RuleDef = {
  id: 'exclamation',
  category: 'punctuation',
  title: 'Exclamation marks',
  detect: (ctx) =>
    densityResult(
      ctx,
      { id: 'exclamation', category: 'punctuation', title: 'Exclamation marks' },
      RE_EXCLAMATION,
      { freeEvery: 180, perExcess: 1.3, cap: 9, note: 'exclamation mark' },
      (n, w) =>
        `${n} exclamation ${plural(n, 'mark', 'marks')} across ${w} words. The enthusiasm is noted.`,
    ),
};

const ruleEllipsis: RuleDef = {
  id: 'ellipsis',
  category: 'punctuation',
  title: 'Trailing ellipses',
  detect: (ctx) =>
    densityResult(
      ctx,
      { id: 'ellipsis', category: 'punctuation', title: 'Trailing ellipses' },
      RE_ELLIPSIS,
      { freeEvery: 220, perExcess: 1.4, cap: 6, note: 'ellipsis' },
      (n, w) =>
        `${n} ${plural(n, 'ellipsis', 'ellipses')} across ${w} words, each leaving a sentence to trail off…`,
    ),
};

const ruleEmoji: RuleDef = {
  id: 'emoji',
  category: 'punctuation',
  title: 'Emoji in the prose',
  detect: (ctx) =>
    densityResult(
      ctx,
      { id: 'emoji', category: 'punctuation', title: 'Emoji in the prose' },
      RE_EMOJI,
      { freeEvery: 600, perExcess: 2, cap: 8, note: 'emoji' },
      (n, w) => `${n} ${plural(n, 'emoji', 'emoji')} threaded through ${w} words of prose.`,
    ),
};

const ruleAllCaps: RuleDef = {
  id: 'all-caps',
  category: 'punctuation',
  title: 'Shouting in capitals',
  detect: (ctx) => {
    RE_ALL_CAPS.lastIndex = 0;
    const evidence: EvidenceRange[] = [];
    let count = 0;
    let truncated = false;
    let match: RegExpExecArray | null;
    while ((match = RE_ALL_CAPS.exec(ctx.text)) !== null) {
      const word = match[0];
      if (word.length > 24) continue;
      if (CAPS_ALLOWLIST.has(word.toUpperCase())) continue;
      count += 1;
      if (evidence.length < MAX_EVIDENCE) {
        evidence.push({
          id: `all-caps-${match.index}`,
          start: match.index,
          end: match.index + word.length,
          excerpt: word,
          note: word,
        });
      } else {
        truncated = true;
      }
    }
    if (count === 0) return null;
    const { points, atCap } = occurrencePoints(count, 2, 8);
    return {
      ruleId: 'all-caps',
      category: 'punctuation',
      title: 'Shouting in capitals',
      occurrences: count,
      points,
      atCap,
      evidence,
      evidenceTruncated: truncated,
      explanation: `${count} all-caps ${plural(count, 'word', 'words')} used for emphasis (${sampleNotes(evidence, 3)}).`,
    };
  },
};

// ── Structure ──────────────────────────────────────────────────────────────

function endsWithQuestion(sentence: Sentence): boolean {
  return /\?["'’”)\]]*$/.test(sentence.text);
}

const ruleRhetoricalQuestions: RuleDef = {
  id: 'rhetorical-questions',
  category: 'structure',
  title: 'Rhetorical question stack',
  detect: (ctx) => {
    const total = ctx.sentences.length;
    if (total < 6) return null;
    const questions = ctx.sentences.filter(endsWithQuestion);
    if (questions.length < 3) return null;
    const ratio = questions.length / total;
    const { points, atCap } = ratioPoints(ratio, 0.15, 20, 8);
    if (points <= 0) return null;
    const evidence: EvidenceRange[] = questions.slice(0, MAX_EVIDENCE).map((s) => ({
      id: `rhetorical-questions-${s.start}`,
      start: s.start,
      end: s.end,
      excerpt: collapse(s.text),
      note: 'rhetorical question',
    }));
    return {
      ruleId: 'rhetorical-questions',
      category: 'structure',
      title: 'Rhetorical question stack',
      occurrences: questions.length,
      points,
      atCap,
      evidence,
      evidenceTruncated: questions.length > MAX_EVIDENCE,
      detail: `${questions.length} of ${total} sentences are questions (${Math.round(ratio * 100)}%).`,
      explanation: `${questions.length} of ${total} sentences are rhetorical questions. Who talks like this? (This does.)`,
    };
  },
};

const ruleOneSentenceParagraphs: RuleDef = {
  id: 'one-sentence-paragraphs',
  category: 'structure',
  title: 'One-sentence paragraphs',
  detect: (ctx) => {
    const total = ctx.paragraphs.length;
    if (total < 5) return null;
    const shortParas = ctx.paragraphs.filter((p) => p.sentenceCount <= 1);
    if (shortParas.length < 3) return null;
    const ratio = shortParas.length / total;
    const { points, atCap } = ratioPoints(ratio, 0.35, 20, 12);
    if (points <= 0) return null;
    return {
      ruleId: 'one-sentence-paragraphs',
      category: 'structure',
      title: 'One-sentence paragraphs',
      occurrences: shortParas.length,
      points,
      atCap,
      evidence: [],
      evidenceTruncated: false,
      detail: `${shortParas.length} of ${total} paragraphs are a single sentence.`,
      explanation: `${shortParas.length} of ${total} paragraphs stand alone as one line. The whitespace is doing a lot of emoting.`,
    };
  },
};

const ruleStaccato: RuleDef = {
  id: 'staccato-fragments',
  category: 'structure',
  title: 'Staccato fragments',
  detect: (ctx) => {
    if (ctx.sentences.length < 6) return null;
    const runs: { start: number; end: number; length: number }[] = [];
    let runStart = -1;
    let runCount = 0;
    let shortTotal = 0;
    const flush = (endIndex: number) => {
      if (runCount >= 3) {
        const first = ctx.sentences[runStart]!;
        const last = ctx.sentences[endIndex]!;
        runs.push({ start: first.start, end: last.end, length: runCount });
        shortTotal += runCount;
      }
    };
    for (let i = 0; i < ctx.sentences.length; i++) {
      const s = ctx.sentences[i]!;
      const isShort = s.wordCount >= 1 && s.wordCount <= 4;
      if (isShort) {
        if (runStart === -1) runStart = i;
        runCount += 1;
      } else {
        flush(i - 1);
        runStart = -1;
        runCount = 0;
      }
    }
    flush(ctx.sentences.length - 1);
    if (runs.length === 0) return null;
    const { points, atCap } = occurrencePoints(runs.length, 5, 10);
    const evidence: EvidenceRange[] = runs.slice(0, MAX_EVIDENCE).map((r) => ({
      id: `staccato-fragments-${r.start}`,
      start: r.start,
      end: r.end,
      excerpt: collapse(ctx.text.slice(r.start, r.end)),
      note: 'staccato run',
    }));
    return {
      ruleId: 'staccato-fragments',
      category: 'structure',
      title: 'Staccato fragments',
      occurrences: shortTotal,
      points,
      atCap,
      evidence,
      evidenceTruncated: runs.length > MAX_EVIDENCE,
      detail: `${runs.length} ${plural(runs.length, 'run', 'runs')} of 3+ very short sentences.`,
      explanation: `${shortTotal} very short sentences land in a row. Punchy. Dramatic. A little much.`,
    };
  },
};

const RE_BULLET = /^\s*(?:[-*+•‣◦·▪]|\d+[.)])\s+\S/u;
const RE_HEADING = /^\s*(?:#{1,6}\s+\S|\*\*[^*]+\*\*\s*$)/u;

const ruleListDensity: RuleDef = {
  id: 'list-heading-density',
  category: 'structure',
  title: 'List & heading density',
  detect: (ctx) => {
    const nonEmpty = ctx.lines.filter((l) => l.text.trim() !== '');
    if (nonEmpty.length < 6) return null;
    const bulletLines = nonEmpty.filter((l) => RE_BULLET.test(l.text)).length;
    const headingLines = nonEmpty.filter((l) => RE_HEADING.test(l.text)).length;
    const bulletRatio = bulletLines / nonEmpty.length;
    const base = ratioPoints(bulletRatio, 0.4, 12, 6).points;
    const headingBonus = headingLines >= 3 ? Math.min(3, headingLines - 2) : 0;
    const raw = base + headingBonus;
    if (raw <= 0) return null;
    const cap = 8;
    const points = Math.min(raw, cap);
    const parts: string[] = [];
    if (bulletLines > 0) parts.push(`${bulletLines} of ${nonEmpty.length} lines are bullets`);
    if (headingLines > 0)
      parts.push(`${headingLines} ${plural(headingLines, 'heading', 'headings')}`);
    return {
      ruleId: 'list-heading-density',
      category: 'structure',
      title: 'List & heading density',
      occurrences: bulletLines + headingLines,
      points,
      atCap: raw >= cap,
      evidence: [],
      evidenceTruncated: false,
      detail: parts.join(' · '),
      explanation: `Structured within an inch of its life: ${parts.join(' and ')}. It reads like a slide, not a sentence.`,
    };
  },
};

// ── Repetition ─────────────────────────────────────────────────────────────

const ruleRepeatedOpenings: RuleDef = {
  id: 'repeated-openings',
  category: 'repetition',
  title: 'Repeated sentence openings',
  detect: (ctx) => {
    const total = ctx.sentences.length;
    if (total < 6) return null;
    const byOpener = new Map<string, Sentence[]>();
    for (const s of ctx.sentences) {
      const opener = firstWord(s.text);
      if (!opener) continue;
      const list = byOpener.get(opener);
      if (list) list.push(s);
      else byOpener.set(opener, [s]);
    }
    const minShare = 0.12;
    let excess = 0;
    let topOpener = '';
    let topCount = 0;
    const evidenceSentences: Sentence[] = [];
    for (const [opener, list] of byOpener) {
      if (list.length >= 3 && list.length / total >= minShare) {
        excess += list.length - 2;
        evidenceSentences.push(...list);
        if (list.length > topCount) {
          topCount = list.length;
          topOpener = opener;
        }
      }
    }
    if (excess <= 0) return null;
    const raw = excess * 1.5;
    const cap = 8;
    const points = Math.min(raw, cap);
    evidenceSentences.sort((a, b) => a.start - b.start);
    const evidence: EvidenceRange[] = evidenceSentences.slice(0, MAX_EVIDENCE).map((s) => ({
      id: `repeated-openings-${s.start}`,
      start: s.start,
      end: s.end,
      excerpt: collapse(s.text),
      note: `opens with "${firstWord(s.text)}"`,
    }));
    return {
      ruleId: 'repeated-openings',
      category: 'repetition',
      title: 'Repeated sentence openings',
      occurrences: evidenceSentences.length,
      points,
      atCap: raw >= cap,
      evidence,
      evidenceTruncated: evidenceSentences.length > MAX_EVIDENCE,
      detail: `"${topOpener}" opens ${topCount} sentences.`,
      explanation: `Several sentences begin the same way — "${topOpener}" alone opens ${topCount}. The rhythm gives it away.`,
    };
  },
};

/** Every rule, in a stable order. Scoring is order-independent. */
export const RULES: RuleDef[] = [
  ruleCanned,
  ruleAudience,
  ruleContrast,
  ruleJargon,
  ruleCliche,
  ruleOneSentenceParagraphs,
  ruleStaccato,
  ruleRhetoricalQuestions,
  ruleListDensity,
  ruleRepeatedOpenings,
  ruleEmDash,
  ruleExclamation,
  ruleEllipsis,
  ruleEmoji,
  ruleAllCaps,
];
