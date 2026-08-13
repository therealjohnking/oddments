# Oddments

**Small instruments, finished properly.**

Oddments is a collection of small, unusually polished browser utilities — tools for text,
code, and the web's odder corners. Each one is small enough to open without a manual and
finished enough to bookmark.

Everything runs **locally in your browser**. There is no account, no database, no backend,
and nothing you type is ever uploaded. The whole site builds to static files and can be
hosted anywhere.

---

## Tools

### Invisible Character Inspector — `/tools/invisible-characters`

Paste or type any text and see the characters that are normally impossible to see, plus the
ones that merely _look_ like something they aren't:

- **Whitespace** — ordinary spaces, tabs, non-breaking and other unusual Unicode spaces,
  and the vertical/separator whitespace (vertical tab, form feed, NEL, line/paragraph
  separators).
- **Hidden & control** — zero-width characters (ZWSP, ZWNJ, ZWJ, word joiner, …), the whole
  invisible-format class, soft hyphens, byte-order marks, **bidirectional controls** (the
  basis of the "Trojan Source" attack, CVE-2021-42574), C0/C1 control codes, variation
  selectors, Plane-14 tag characters ("ASCII smuggling"), private-use characters, and
  noncharacters.
- **Confusables** — curly quotes vs straight, apostrophe and prime variants, the
  hyphen/en-dash/em-dash/minus family, and a curated set of homoglyph letters (Cyrillic /
  Greek / full-width look-alikes).

For every finding you get its **name, Unicode code point, and exact line:column position**.
The tool also reports line-ending style (LF / CRLF / CR, and whether they're mixed),
trailing whitespace, a leading BOM, and code-point / grapheme / byte / word / line counts.

A conservative, **opt-in** cleaner can then normalise or remove specific categories. Only two
transforms are on by default (normalise line endings, strip trailing whitespace); everything
else — and especially anything that could change meaningful text, like removing ZWJ from an
emoji sequence — is off until you choose it, shows how many characters it would affect, and
carries a plain-language caution. Copy the cleaned text (or the original, or a findings
report) with one click.

Three views keep it usable and accessible:

- a **visual reveal** where invisible characters become labelled chips inline;
- an **expanded-text** view where each one becomes a readable `[TOKEN]`, ideal for screen
  readers, copying, and verification;
- a **findings list** grouped by category, keyboard-navigable, with jump-to-occurrence.

---

## Running it

Requires a recent Node.js (18.18+; developed on Node 22+).

```bash
npm install      # install dependencies
npm run dev      # start the dev server (http://localhost:3000)
npm run build    # production build → static export in ./out
```

The build is a fully static export (`output: 'export'`), so `./out` can be served by any
static host or opened locally.

## Quality gates

```bash
npm run check         # everything below, in order
```

| Command                 | What it does                                       |
| ----------------------- | -------------------------------------------------- |
| `npm run format:check`  | Prettier formatting check                          |
| `npm run lint`          | ESLint (Next core-web-vitals + TypeScript)         |
| `npm run test`          | Vitest unit tests for the domain engine            |
| `npm run build`         | Production build + static export (also typechecks) |
| `npm run typecheck`     | `tsc --noEmit` (strict)                            |
| `npm run test:watch`    | Vitest in watch mode                               |
| `npm run test:coverage` | Vitest with coverage                               |

> `npm run typecheck` on its own needs generated route types, so run it after a `dev`/`build`
> (or just run `npm run check`, which orders the build first). This is a normal consequence of
> Next.js typed routes.

## Project structure

```
app/                         Next.js App Router
  page.tsx                   landing page
  tools/invisible-characters/ the tool route
  layout.tsx, globals.css    shell, design tokens, theming
components/
  site/                      header, footer, theme toggle
  inspector/                 the tool's React UI (+ its own CSS module)
lib/inspector/               framework-agnostic engine (the tested core)
  categories.ts              the category taxonomy + metadata
  named-characters.ts        curated names / abbreviations / clean-targets
  classify.ts                per-code-point classification
  analyze.ts                 single-pass analyzer (stats, findings, lines)
  clean.ts                   the conservative cleaning transforms
  *.test.ts                  unit tests
```

The transformation and detection logic lives in `lib/inspector` with **no React
dependency**, so it is thoroughly unit-tested in isolation from rendering.

---

## Technical notes & deliberate choices

- **Stack:** Next.js 15 (App Router) + React 19 + TypeScript, static export. No web fonts
  (system font stacks only), so builds work offline and no font is ever fetched at runtime.
  Styling is hand-written CSS with design tokens + CSS Modules — no CSS framework.
- **Detection is property-driven.** Rather than hardcoding thousands of code points,
  classification leans on the JavaScript engine's own Unicode property escapes
  (`\p{Default_Ignorable_Code_Point}`, `\p{Bidi_Control}`, `\p{Noncharacter_Code_Point}`,
  `\p{Cf}`, `\p{Cc}`, …). This tracks the engine's Unicode version instead of drifting out of
  date, and it means the whole `Cf` format class (e.g. Arabic number-sign controls) is caught
  without an explicit list. A small curated table adds friendly names, marker abbreviations,
  and "looks-like" hints on top.
- **Paste fidelity.** Input is a native `<textarea>`; the exact characters you paste are
  preserved and never normalised on the way in. Cleaning is a separate, explicit step.
- **Accessibility.** The visual reveal is treated as a sighted enhancement (`aria-hidden`);
  the findings list, the expanded-text view, and the original textarea are the fully
  equivalent accessible surfaces. Severity is never encoded by colour alone (label + border +
  glyph), results are announced via a live region, findings are keyboard-navigable without
  hundreds of tab stops, and Windows High Contrast / reduced-motion are respected.
- **Large inputs.** Analysis is a single O(n) pass; re-analysis is deferred (`useDeferredValue`)
  so typing stays responsive. The stored findings/line arrays are capped for pathological
  inputs while the summary counts stay exact, and the reveal renders a bounded number of lines.

### Intentionally deferred

- **Confusables are a curated subset,** not the full Unicode UTS #39 database (which is
  thousands of entries). The common Cyrillic/Greek/full-width tricks are covered; a future
  version could load the authoritative confusables data + a mixed-script detector.
- **No off-main-thread analysis (Web Worker).** The current debounce/defer + caps handle
  large-but-reasonable inputs well; a worker would be the next step for very large inputs.
- **No "Zalgo" / combining-mark anomaly detection.** Flagging abnormal combining-mark runs
  (as opposed to legitimate diacritics) needs anomaly heuristics and is out of scope for now.

---

## Philosophy

Local-first. No account. No database. No paid APIs. Privacy-friendly by construction — the
data never leaves the page. Fast, accessible, and cheap to host as static files. New tools
arrive only when they're genuinely finished.
