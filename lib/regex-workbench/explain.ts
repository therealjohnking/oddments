/**
 * The deterministic pattern explainer — the flagship.
 *
 * Every line of the explanation is derived from the parsed AST, never from a
 * regex-about-regex guess and never from a language model. Nesting, alternation,
 * quantifiers, groups, assertions, classes, escapes and backreferences are all
 * represented structurally, so a complex expression stays a tree rather than
 * collapsing into misleading prose. When regexpp cannot parse a pattern the
 * engine still accepts (bleeding-edge syntax), the explanation reports itself
 * unavailable rather than inventing structure.
 *
 * Flag-sensitive meanings are annotated honestly: `.` notes whether `s` lets it
 * cross newlines, and `^`/`$` note whether `m` makes them per-line.
 */

import { formatCodePoint } from '@/lib/inspector';
import { parseAst, type AST } from './ast';
import type { ExplainNode, Explanation } from './types';

/** Soft ceiling on explanation nodes, so a pathologically long pattern stays bounded. */
const NODE_BUDGET = 4000;

interface Ctx {
  flags: string;
  groupNumbers: Map<AST.CapturingGroup, number>;
  count: number;
}

export function explainPattern(source: string, flags: string): Explanation {
  if (source === '') {
    return {
      status: 'ok',
      nodes: [
        {
          id: 'empty',
          kind: 'literal',
          source: '',
          start: 0,
          end: 0,
          title: 'Empty pattern',
          detail: 'Matches the empty string at every position.',
        },
      ],
    };
  }

  const parsed = parseAst(source, flags);
  if (!parsed.ok) {
    return {
      status: 'unavailable',
      nodes: [],
      message:
        'The pattern matches, but this syntax is newer than the structural explainer can parse — so no explanation is shown rather than a wrong one.',
    };
  }

  const groupNumbers = new Map<AST.CapturingGroup, number>();
  numberGroups(parsed.ast, groupNumbers);
  const ctx: Ctx = { flags, groupNumbers, count: 0 };
  const nodes = explainAlternatives(parsed.ast.alternatives, ctx);
  return { status: 'ok', nodes };
}

/** Assign group numbers in document (opening-paren) order. */
function numberGroups(ast: AST.Pattern, into: Map<AST.CapturingGroup, number>): void {
  let n = 0;
  const walkAlts = (alts: AST.Alternative[]): void => {
    for (const alt of alts) for (const el of alt.elements) walkEl(el);
  };
  const walkEl = (el: AST.Element): void => {
    switch (el.type) {
      case 'CapturingGroup':
        into.set(el, ++n);
        walkAlts(el.alternatives);
        break;
      case 'Group':
        walkAlts(el.alternatives);
        break;
      case 'Quantifier':
        walkEl(el.element);
        break;
      case 'Assertion':
        if (el.kind === 'lookahead' || el.kind === 'lookbehind') walkAlts(el.alternatives);
        break;
      default:
        break;
    }
  };
  walkAlts(ast.alternatives);
}

function nodeId(node: { start: number; end: number }, kind: string): string {
  return `${node.start}-${node.end}-${kind}`;
}

/**
 * Explain a set of alternatives. A single alternative flattens to its element
 * nodes; two or more become one alternation node whose children are the branches.
 */
function explainAlternatives(alternatives: AST.Alternative[], ctx: Ctx): ExplainNode[] {
  if (alternatives.length === 1) {
    return explainElements(alternatives[0]!.elements, ctx);
  }
  const branches: ExplainNode[] = alternatives.map((alt, i) => {
    const children = explainElements(alt.elements, ctx);
    return {
      id: nodeId(alt, `alt${i}`),
      kind: 'alternative' as const,
      source: alt.raw,
      start: alt.start,
      end: alt.end,
      title: `Option ${i + 1}`,
      detail: alt.elements.length === 0 ? 'empty (matches nothing here)' : undefined,
      children,
    };
  });
  const first = alternatives[0]!;
  const last = alternatives[alternatives.length - 1]!;
  return [
    {
      id: `${first.start}-${last.end}-alternation`,
      kind: 'alternation',
      source: alternatives.map((a) => a.raw).join('|'),
      start: first.start,
      end: last.end,
      title: `Any one of ${alternatives.length} options`,
      children: branches,
    },
  ];
}

function explainElements(elements: AST.Element[], ctx: Ctx): ExplainNode[] {
  const out: ExplainNode[] = [];
  for (const el of elements) {
    if (ctx.count >= NODE_BUDGET) break;
    ctx.count += 1;
    out.push(explainElement(el, ctx));
  }
  return out;
}

function explainElement(el: AST.Element, ctx: Ctx): ExplainNode {
  switch (el.type) {
    case 'Character':
      return charNode(el);
    case 'CharacterSet':
      return charSetNode(el, ctx);
    case 'CharacterClass':
      return charClassNode(el, ctx);
    case 'ExpressionCharacterClass':
      return expressionClassNode(el, ctx);
    case 'Assertion':
      return assertionNode(el, ctx);
    case 'Quantifier':
      return quantifierNode(el, ctx);
    case 'CapturingGroup':
      return capturingGroupNode(el, ctx);
    case 'Group':
      return groupNode(el, ctx);
    case 'Backreference':
      return backreferenceNode(el);
    default:
      return {
        id: nodeId(el as AST.Node, 'unsupported'),
        kind: 'unsupported',
        source: (el as AST.Node).raw,
        start: (el as AST.Node).start,
        end: (el as AST.Node).end,
        title: 'Unrecognized construct',
      };
  }
}

// ── Characters ───────────────────────────────────────────────────────────────

const CONTROL_NAMES: Record<number, string> = {
  0x09: 'Tab',
  0x0a: 'Line feed (newline)',
  0x0b: 'Vertical tab',
  0x0c: 'Form feed',
  0x0d: 'Carriage return',
  0x20: 'Space',
};

function describeCharacter(cp: number): string {
  if (CONTROL_NAMES[cp]) return CONTROL_NAMES[cp]!;
  if (cp >= 0x21 && cp <= 0x7e) return `“${String.fromCodePoint(cp)}”`;
  return `“${String.fromCodePoint(cp)}” (${formatCodePoint(cp)})`;
}

function charNode(el: AST.Character): ExplainNode {
  return {
    id: nodeId(el, 'char'),
    kind: 'literal',
    source: el.raw,
    start: el.start,
    end: el.end,
    title: `The character ${describeCharacter(el.value)}`,
  };
}

// ── Character sets ───────────────────────────────────────────────────────────

function charSetNode(el: AST.CharacterSet, ctx: Ctx): ExplainNode {
  const base = {
    id: nodeId(el, 'set'),
    source: el.raw,
    start: el.start,
    end: el.end,
    kind: 'char-set' as const,
  };
  switch (el.kind) {
    case 'any': {
      const detail = ctx.flags.includes('s')
        ? 'including line terminators (s flag is set)'
        : 'except line terminators';
      return { ...base, title: 'Any character', detail };
    }
    case 'digit':
      return {
        ...base,
        title: el.negate ? 'Any non-digit' : 'A digit',
        detail: el.negate ? 'anything except 0–9' : '0–9',
      };
    case 'space':
      return {
        ...base,
        title: el.negate ? 'Any non-whitespace' : 'A whitespace character',
        detail: el.negate ? undefined : 'space, tab, newline, and other Unicode spaces',
      };
    case 'word':
      return {
        ...base,
        title: el.negate ? 'A non-word character' : 'A word character',
        detail: el.negate ? 'anything except A–Z, a–z, 0–9, _' : 'A–Z, a–z, 0–9, or _',
      };
    case 'property': {
      // Unicode property escape (\p{…} / \P{…}).
      const propName = el.value ? `${el.key}=${el.value}` : el.key;
      return {
        ...base,
        title: el.negate
          ? `A character without Unicode property ${propName}`
          : `A character with Unicode property ${propName}`,
        detail: el.strings ? 'this property can match multi-character strings' : undefined,
      };
    }
  }
}

// ── Character classes ────────────────────────────────────────────────────────

function charClassNode(el: AST.CharacterClass, ctx: Ctx): ExplainNode {
  const children: ExplainNode[] = [];
  for (const item of el.elements) {
    if (ctx.count >= NODE_BUDGET) break;
    ctx.count += 1;
    children.push(classItemNode(item, ctx));
  }
  return {
    id: nodeId(el, 'class'),
    kind: 'char-class',
    source: el.raw,
    start: el.start,
    end: el.end,
    title: el.negate ? 'Any character except' : 'Any one of',
    children,
  };
}

function classItemNode(item: AST.CharacterClassElement, ctx: Ctx): ExplainNode {
  switch (item.type) {
    case 'Character':
      return charNode(item);
    case 'CharacterClassRange':
      return {
        id: nodeId(item, 'range'),
        kind: 'class-range',
        source: item.raw,
        start: item.start,
        end: item.end,
        title: `Range ${describeCharacter(item.min.value)} to ${describeCharacter(item.max.value)}`,
      };
    case 'CharacterSet':
      return charSetNode(item, ctx);
    case 'CharacterClass':
      return charClassNode(item, ctx);
    case 'ExpressionCharacterClass':
      return expressionClassNode(item, ctx);
    case 'ClassStringDisjunction':
      return {
        id: nodeId(item, 'strings'),
        kind: 'class-op',
        source: item.raw,
        start: item.start,
        end: item.end,
        title: `Any of ${item.alternatives.length} strings`,
        detail: item.alternatives.map((a) => `“${a.raw}”`).join(', '),
      };
    default:
      return {
        id: nodeId(item as AST.Node, 'classitem'),
        kind: 'unsupported',
        source: (item as AST.Node).raw,
        start: (item as AST.Node).start,
        end: (item as AST.Node).end,
        title: 'Class member',
      };
  }
}

function expressionClassNode(el: AST.ExpressionCharacterClass, ctx: Ctx): ExplainNode {
  const opNode = classSetExpression(el.expression, ctx);
  return {
    id: nodeId(el, 'exprclass'),
    kind: 'char-class',
    source: el.raw,
    start: el.start,
    end: el.end,
    title: el.negate ? 'Any character except (set)' : 'A set of characters',
    children: [opNode],
  };
}

function classSetExpression(
  node: AST.ClassIntersection | AST.ClassSubtraction,
  ctx: Ctx,
): ExplainNode {
  const isIntersection = node.type === 'ClassIntersection';
  const operands: ExplainNode[] = [];
  const pushOperand = (
    operand: AST.ClassSetOperand | AST.ClassIntersection | AST.ClassSubtraction,
  ) => {
    if (operand.type === 'ClassIntersection' || operand.type === 'ClassSubtraction') {
      operands.push(classSetExpression(operand, ctx));
    } else {
      operands.push(classItemNode(operand as AST.CharacterClassElement, ctx));
    }
  };
  pushOperand(node.left);
  pushOperand(node.right);
  return {
    id: nodeId(node, 'setop'),
    kind: 'class-op',
    source: node.raw,
    start: node.start,
    end: node.end,
    title: isIntersection
      ? 'In both sets (intersection &&)'
      : 'In the first but not the second (subtraction --)',
    children: operands,
  };
}

// ── Assertions ───────────────────────────────────────────────────────────────

function assertionNode(el: AST.Assertion, ctx: Ctx): ExplainNode {
  const base = { id: nodeId(el, 'assert'), source: el.raw, start: el.start, end: el.end };
  const multiline = ctx.flags.includes('m');
  switch (el.kind) {
    case 'start':
      return {
        ...base,
        kind: 'assertion',
        title: multiline ? 'Start of a line' : 'Start of the input',
        detail: multiline
          ? 'at the very start, or just after a line break (m flag)'
          : 'the very start of the string',
      };
    case 'end':
      return {
        ...base,
        kind: 'assertion',
        title: multiline ? 'End of a line' : 'End of the input',
        detail: multiline
          ? 'at the very end, or just before a line break (m flag)'
          : 'the very end of the string',
      };
    case 'word':
      return {
        ...base,
        kind: 'assertion',
        title: el.negate ? 'Not a word boundary' : 'A word boundary',
        detail: el.negate
          ? 'between two word characters, or two non-word characters'
          : 'between a word character and a non-word character (zero-width)',
      };
    case 'lookahead':
      return {
        ...base,
        kind: 'lookaround',
        title: el.negate ? 'Not followed by' : 'Followed by',
        detail: 'zero-width — the text ahead must match but is not consumed',
        children: explainAlternatives(el.alternatives, ctx),
      };
    case 'lookbehind':
      return {
        ...base,
        kind: 'lookaround',
        title: el.negate ? 'Not preceded by' : 'Preceded by',
        detail: 'zero-width — the text behind must match but is not consumed',
        children: explainAlternatives(el.alternatives, ctx),
      };
  }
}

// ── Quantifiers ──────────────────────────────────────────────────────────────

function quantifierTitle(min: number, max: number): string {
  if (min === 0 && max === 1) return 'Optional — 0 or 1 of';
  if (min === 0 && max === Infinity) return 'Zero or more of';
  if (min === 1 && max === Infinity) return 'One or more of';
  if (min === max) return `Exactly ${min} of`;
  if (max === Infinity) return `${min} or more of`;
  return `Between ${min} and ${max} of`;
}

function quantifierNode(el: AST.Quantifier, ctx: Ctx): ExplainNode {
  const child = explainElement(el.element, ctx);
  return {
    id: nodeId(el, 'quant'),
    kind: 'quantifier',
    source: el.raw,
    start: el.start,
    end: el.end,
    title: quantifierTitle(el.min, el.max),
    detail: el.greedy
      ? 'greedy — matches as many as possible'
      : 'lazy — matches as few as possible',
    children: [child],
  };
}

// ── Groups ───────────────────────────────────────────────────────────────────

function modifierNote(group: AST.Group): string | undefined {
  if (!group.modifiers) return undefined;
  const add = describeModifierFlags(group.modifiers.add);
  const remove = group.modifiers.remove ? describeModifierFlags(group.modifiers.remove) : '';
  const parts: string[] = [];
  if (add) parts.push(`enables ${add}`);
  if (remove) parts.push(`disables ${remove}`);
  return parts.length ? `inline modifiers: ${parts.join(', ')}` : undefined;
}

function describeModifierFlags(flags: AST.ModifierFlags): string {
  const names: string[] = [];
  if (flags.ignoreCase) names.push('ignore-case (i)');
  if (flags.multiline) names.push('multiline (m)');
  if (flags.dotAll) names.push('dotAll (s)');
  return names.join(', ');
}

/** Effective flags for a modifier group's body: `(?ims-ims:…)` adds/removes i/m/s. */
function applyModifiers(flags: string, modifiers: AST.Modifiers): string {
  const active = new Set(flags.split(''));
  const add = modifiers.add;
  if (add.ignoreCase) active.add('i');
  if (add.multiline) active.add('m');
  if (add.dotAll) active.add('s');
  const remove = modifiers.remove;
  if (remove) {
    if (remove.ignoreCase) active.delete('i');
    if (remove.multiline) active.delete('m');
    if (remove.dotAll) active.delete('s');
  }
  return [...active].join('');
}

function groupNode(el: AST.Group, ctx: Ctx): ExplainNode {
  // Inline modifiers change the flags in force for this group's body, so `.`
  // (dotAll) and `^`/`$` (multiline) are annotated against the effective flags.
  // Mutate-and-restore keeps the shared node budget while scoping the change.
  const savedFlags = ctx.flags;
  if (el.modifiers) ctx.flags = applyModifiers(savedFlags, el.modifiers);
  const children = explainAlternatives(el.alternatives, ctx);
  ctx.flags = savedFlags;
  return {
    id: nodeId(el, 'group'),
    kind: 'group',
    source: el.raw,
    start: el.start,
    end: el.end,
    title: 'Group (non-capturing)',
    detail: modifierNote(el) ?? 'groups without creating a numbered capture',
    children,
  };
}

function capturingGroupNode(el: AST.CapturingGroup, ctx: Ctx): ExplainNode {
  const number = ctx.groupNumbers.get(el) ?? 0;
  return {
    id: nodeId(el, 'capture'),
    kind: el.name ? 'named-capture' : 'capture',
    source: el.raw,
    start: el.start,
    end: el.end,
    title: el.name ? `Capture group ${number} — “${el.name}”` : `Capture group ${number}`,
    children: explainAlternatives(el.alternatives, ctx),
  };
}

// ── Backreferences ───────────────────────────────────────────────────────────

function backreferenceNode(el: AST.Backreference): ExplainNode {
  const target = typeof el.ref === 'number' ? `group ${el.ref}` : `group “${el.ref}”`;
  return {
    id: nodeId(el, 'backref'),
    kind: 'backreference',
    source: el.raw,
    start: el.start,
    end: el.end,
    title: `Backreference to ${target}`,
    detail: 'matches the same text that group captured',
  };
}
