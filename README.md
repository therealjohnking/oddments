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

### Slopometer — `/tools/slopometer`

A deterministic prose-style analyzer. Paste writing and it scores the stylistic tells that make
text read as generic, over-polished, formulaic, or performative — then shows you **exactly which
rules fired and why**.

Its premise is deliberate:

> **Detect writing crimes, not artificial intelligence.**

Slopometer makes **no claim** about whether a human or a machine wrote anything — that is
unreliable and out of scope. It only counts recognizable habits, and it is transparent about the
fact that the score is a playful heuristic, not a measurement, grade, or verdict.

You get an overall **0–100 score** in one of four bands (from _Apparently written by a person_ to
_Executive Thought Leadership Event_), a breakdown of every rule that contributed, occurrence
counts and point contributions per rule, and — where a finding maps to real text — the exact
spans **highlighted in context**, cross-linked to the findings list. Analysis runs live as you
type; there is no submit step.

Fifteen rules span eight categories: canned rhetorical setups, performative audience
instructions, contrast templates (“it’s not X, it’s Y”), corporate jargon, inspirational content
clichés, structural tendencies (one-sentence paragraphs, staccato bursts, rhetorical-question
stacks, bullet/heading density), punctuation & emphasis (em dashes, exclamation marks, ellipses,
emoji, shouting caps — all normalized against length), and repeated sentence openings. The
scoring model and its normalization are documented at the top of `lib/slopometer/score.ts`.

### CSV Autopsy — `/tools/csv-autopsy`

A local-first CSV profiling and diagnostic instrument. Drop in a file (or choose one, or paste the
text) and it examines the dataset and answers one question: **what is actually in this file, and
what looks suspicious?** Its premise is deliberate:

> **Inspect first. Fix deliberately.**

CSV Autopsy diagnoses and explains — it **never** repairs, normalizes, or rewrites your data. There
are no “trim all whitespace”, “fix dates”, or “download cleaned CSV” buttons; the value is _here is
what looks wrong and why_, not _trust me, I fixed it_.

You get a **dataset overview** (rows, columns, detected delimiter, header detection, blank/duplicate
rows, completeness), a **profile for every column** (a conservative inferred type, completeness,
distinctness, candidate-key status, numeric/date statistics, and top values), and a prioritized list
of **findings** — each with a severity, a plain-language explanation, the affected column, a few
exact examples, and a one-sentence _why_. Findings cover structure (malformed rows, unclosed quotes),
headers (duplicate/blank/whitespace names), completeness (empty and mostly-blank columns, null-like
tokens), uniqueness (candidate keys and **duplicated identifiers**), type integrity (values that do
not match a column’s dominant type), consistency (constant columns, capitalization drift, punctuation
variants), whitespace, and exact duplicate rows. Export the whole thing as a Markdown or JSON report.

Type inference is intentionally conservative: unambiguous ISO-style dates are recognized while
locale-ambiguous forms like `03/04/2026` are left as text; a column that is 99% numeric with a few
stragglers keeps its type and reports the stragglers as anomalies rather than being flattened to
“text”. Parsing is handled by [Papa Parse](https://www.papaparse.com/) (used only on in-memory
strings — never the network); every diagnostic on top of it is Oddments’ own. A built-in messy
sample dataset lets you explore the whole tool immediately.

### Diffoscope — `/tools/diffoscope`

A human-oriented text comparison instrument. Paste an original into **A / Before** and a revision
into **B / After** and it shows exactly what changed — and, just as importantly, **the differences
your eyes slide past**. Its premise is deliberate:

> **Show me what changed — even what I can’t see.**

Diffoscope explains differences; it **never** edits your text, and it is emphatically not a merge
editor. Comparison runs live as you type (no _Analyze_ button).

- **Three granularities.** _Word_ (the default, best for prose), _Character_ (Unicode-correct —
  grapheme clusters via `Intl.Segmenter`, so emoji, accents, combining sequences, and ZWJ emoji are
  never split), and _Line_ (for code, config, Markdown, and generated output; LF/CRLF/CR are
  preserved for diagnostics even though lines render normally).
- **A clear result.** A polished **inline** view with semantic `<ins>`/`<del>` markup, plus a
  **split** before/after reading. Insertions and deletions never rely on colour alone — underline
  and strike-through, and `+`/`−` signs in line mode — and they stay legible in monochrome and
  Windows High Contrast.
- **The headline verdict.** One sentence on how the two inputs relate: _exactly identical_,
  _identical except for line endings / whitespace / letter case / Unicode form / punctuation /
  invisible characters_, a labelled _cosmetic_ combination of those, or _genuinely different_.
- **“These look identical.”** When two strings look the same but fail an equality check, Diffoscope
  locates the reason in plain language, with line:column positions: non-breaking vs ordinary spaces,
  tabs vs spaces, trailing whitespace, zero-width characters and BOMs, curly vs straight quotes, the
  hyphen/en-dash/em-dash family, the ellipsis character vs three periods, homoglyph letters,
  letter-case slips, CRLF-vs-LF line endings, and NFC-equivalent (precomposed vs combining)
  representations. These findings are derived from the character diff, so they point at real
  correspondences and stay quiet when the inputs genuinely differ.
- **Comparison lenses.** Optionally ignore _case_, ignore _whitespace_, or compare Unicode _NFC_
  forms. A lens reinterprets how the two sides are matched — it never modifies either source, and the
  UI says when a normalized comparison is in effect.
- **Copy / export.** Copy a plain-text comparison summary, or a standard **line-oriented unified
  diff** (headers, `@@` hunks, three lines of context, and a `\ No newline at end of file` marker) —
  clearly labelled A → B. Diffoscope reads and explains; it does not apply patches.
- **Three built-in examples** — a flagship "looks identical" pair that hides seven kinds of
  difference, an ordinary prose revision, and a config change for line mode.

### JSON Crime Scene — `/tools/json-crime-scene`

A local-first instrument for inspecting, understanding, and diagnosing **one JSON document**. Paste
it, drop a `.json` file, or load the sample, and it answers the question a formatter can’t: **what am
I looking at, and is anything about this structure worth investigating?** Its premise is deliberate:

> **Observation before judgment.**

JSON Crime Scene inspects and explains — it **never** repairs, reorders, or rewrites your source.
Unusual JSON is _described_, not condemned: it says _mixed element types_, not _invalid array_.

- **Strict JSON, with useful errors.** The primary format is standard JSON — no comments, trailing
  commas, single quotes, or unquoted keys. Invalid input gets a readable diagnosis with the **line,
  column, and a source snippet with a caret**, and common mistakes are named for what they are
  (“Trailing comma before a closing brace”, “Single quotes are not valid in JSON”, “Unexpected extra
  content after the JSON value”). Validity is decided by the platform’s own `JSON.parse`, so the
  yes/no always matches the specification.
- **A structural profile.** Root type; total values; object / array / string / number / boolean /
  null counts; property count; maximum nesting depth; source size; duplicate-key groups; and a
  severity-tallied finding count. No fake “health score” — the numbers themselves are the point.
- **An explorable tree.** Expand and collapse objects and arrays, with value types differentiated by
  shape (quotes, keyword forms) as well as colour. Large containers render a bounded number of
  children with an explicit “show more”, and the **true child count is always shown** — exact
  statistics never depend on what is currently rendered.
- **A node inspector.** Select any node for its type, a bounded value view, child count / string
  length, depth, source position, and copyable **JSON Pointer** (RFC 6901) and JavaScript-style path
  — the latter using bracket notation for any key that isn’t a safe identifier.
- **Diagnostic findings.** Each carries a severity (info / notice / warning), a plain-language
  explanation and _why_, affected paths, exact counts, and representative examples that jump to the
  node in the tree. The marquee finding is **duplicate object keys** — recovered from the source with
  their positions, because `JSON.parse` silently keeps only the last. Others cover key anomalies
  (leading/trailing whitespace, case-only collisions, empty names, **invisible characters**), mixed
  array element types, empty/deep/large structural hotspots, and frequently-null fields.
- **Array-of-object shape analysis.** For arrays of objects it groups the objects by a normalized
  key-set signature (an O(_n_) pass, not pairwise comparison), reports the **dominant shape** and each
  variant’s missing/extra keys and conformity, and flags **per-field type inconsistency** — e.g.
  “`amount` is a number in 4 of 5 objects but a string at `/orders/4/amount`”.
- **Numeric safety.** Because the exact numeric literal is read straight from the source before any
  coercion, integers beyond JavaScript’s safe range (±2⁵³−1) are flagged with the value they’d
  silently round to — a high-value check a plain parse can’t make.
- **Bounded search.** Search property names and value previews; results show the path and jump to the
  node, capped while still reporting the true match total.
- **Derived views & report.** Optional **pretty / minified / sorted-key** views, emitted from the tree
  so numbers and string escapes are reproduced exactly and **duplicate keys are preserved** (key
  sorting is disabled when duplicates make member order meaningful). Copy paths or values, and export
  a Markdown or JSON **diagnostic report** — which describes the analysis and never embeds the source.
- **A built-in sample** (an orders API response) demonstrates every finding at a glance.

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
app/                          Next.js App Router
  page.tsx                    landing page
  tools/invisible-characters/ the inspector route
  tools/slopometer/           the slopometer route
  tools/csv-autopsy/          the CSV Autopsy route
  tools/diffoscope/           the Diffoscope route
  tools/json-crime-scene/     the JSON Crime Scene route
  layout.tsx, globals.css     shell, design tokens, theming
components/
  site/                       header, footer, theme toggle
  inspector/                  inspector React UI (+ its own CSS module)
  slopometer/                 slopometer React UI (+ its own CSS module)
  csv-autopsy/                CSV Autopsy React UI (+ its own CSS module)
  diffoscope/                 Diffoscope React UI (+ its own CSS module)
  json-crime-scene/           JSON Crime Scene React UI (+ its own CSS module)
lib/inspector/                framework-agnostic engine (the tested core)
  categories.ts               the category taxonomy + metadata
  named-characters.ts         curated names / abbreviations / clean-targets
  classify.ts                 per-code-point classification
  analyze.ts                  single-pass analyzer (stats, findings, lines)
  clean.ts                    the conservative cleaning transforms
lib/slopometer/               framework-agnostic engine (the tested core)
  types.ts                    shared types (findings, bands, analysis)
  text.ts                     offset-preserving tokenizer (words/sentences/…)
  rules.ts                    the 15 detectors + phrase lists + categories
  score.ts                    normalization helpers + score bands
  analyze.ts                  orchestrator: tokenize → run rules → score → band
  *.test.ts                   unit tests
lib/csv-autopsy/              framework-agnostic engine (the tested core)
  types.ts                    shared types (columns, findings, overview)
  parse.ts                    Papa Parse wrapper: header/blank/ragged detection
  infer.ts                    conservative value + column type inference
  stats.ts                    numeric + date statistics
  profile.ts                  one-pass column scan → profiles, overview, preview
  findings.ts                 the diagnostic rules + prioritization
  export.ts                   Markdown / JSON report rendering
  sample-data.ts              the deliberately-messy sample dataset
  index.ts                    public API: analyzeCsv() + re-exports
  *.test.ts                   unit tests
lib/diffoscope/               framework-agnostic engine (the tested core)
  types.ts                    shared types (segments, verdict, findings, lens)
  tokenize.ts                 grapheme / word / line tokenizers (offset-preserving)
  myers.ts                    the Myers shortest-edit-script core (+ brute-force LCS check)
  normalize.ts                comparison lenses + confusable/invisible folding
  positions.ts                UTF-16 offset → line / code-point column
  compare.ts                  ops → renderable inline segments + counts
  diagnostics.ts              the verdict + located "these look identical" findings
  unified-diff.ts             standard line-oriented unified diff (A → B)
  stats.ts                    per-side chars / words / lines / bytes / line endings
  samples.ts                  the three built-in example pairs
  index.ts                    public API: analyzePair() + diffInMode() + re-exports
  *.test.ts                   unit tests
lib/json-crime-scene/         framework-agnostic engine (the tested core)
  types.ts                    shared domain types (nodes, findings, shapes, profile)
  parse.ts                    jsonc strict parse + JSON.parse oracle, LineIndex, error translation
  traverse.ts                 iterative tree build + stats + duplicate-key detection
  paths.ts                    JSON Pointer (RFC 6901) + JavaScript-path builders
  numbers.ts                  safe-integer / overflow inspection from the raw literal
  shapes.ts                   array-of-object shape + field-type + nullability analysis
  diagnostics.ts              the observational finding rules + prioritization
  transform.ts                lossless, duplicate-safe pretty / minify / sort emitter
  search.ts                   bounded key/value search
  report.ts                   Markdown / JSON report rendering (never embeds the source)
  sample-data.ts              the built-in sample (stored as literal JSON source)
  index.ts                    public API: analyzeJson() + re-exports
  *.test.ts                   unit tests
```

Each tool's detection logic lives in its `lib/` engine with **no React dependency**, so it is
thoroughly unit-tested in isolation from rendering.

---

## Technical notes & deliberate choices

- **Stack:** Next.js 16 (App Router) + React 19 + TypeScript, static export. No web fonts
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
- **One deliberate runtime dependency.** CSV Autopsy uses [Papa Parse](https://www.papaparse.com/)
  for tokenization — correct CSV parsing (quoted fields with embedded commas and newlines,
  doubled-quote escaping, mixed line endings, delimiter auto-detection) is a genuine state machine,
  and a mature, zero-dependency, MIT-licensed library is the right tool. It is used only on
  in-memory strings, never given a URL or a worker, so it makes no network requests. Everything
  above tokenization — header detection, blank/ragged-row accounting, type inference, and every
  diagnostic — is the engine’s own, computed from the raw rows Papa returns.
- **JSON Crime Scene’s one dependency is a source-preserving parser.** Correct duplicate-key
  detection is impossible after `JSON.parse` (which keeps only the last value), and safe-integer
  detection is impossible after a number is coerced to a double. Both need a parser that preserves the
  source: [`jsonc-parser`](https://github.com/microsoft/node-jsonc-parser) (VS Code’s scanner,
  zero-dependency, MIT), run in **strict** mode (`disallowComments`, no trailing commas). It supplies
  a syntax tree with exact offsets — so every number’s raw literal and every duplicate key is
  recoverable — and structured error codes that translate cleanly into readable messages. The
  platform’s `JSON.parse` is kept as the **authority on validity**, so the yes/no can never drift from
  the specification, and both recursive parsers are wrapped so pathologically deep input degrades to an
  honest “too complex” notice instead of crashing the tab. Everything above the parse — the domain
  tree, statistics, shape analysis, and every diagnostic — is the engine’s own, and the same
  `classify()` that powers the Invisible Character Inspector names the invisible characters found in
  keys and string values.
- **Diffoscope adds no dependency.** Its diff is the standard **Myers O(ND)** shortest-edit-script
  over token arrays — a small, deterministic, well-understood algorithm (checked in tests against a
  brute-force LCS), not a novel one. A general diff library was considered and declined: the common
  ones split characters on **UTF-16 code units**, which mangles surrogate pairs and combining
  sequences — exactly what Diffoscope must not do — so grapheme-cluster tokenization is required
  regardless, at which point a library would only supply the array-diff core. Comparison units are
  grapheme clusters (via `Intl.Segmenter`, with a code-point fallback), word/whitespace/punctuation
  runs, or lines. The same `classify()` that powers the Invisible Character Inspector names the code
  points a difference involves, so the two tools never keep contradictory Unicode knowledge.
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
- **CSV Autopsy is an inspection instrument, not a cleaner.** No transforms, no “download cleaned
  CSV”, no schema enforcement — deliberately. Its similar-value detection is limited to exact
  case/whitespace/punctuation normalization; **fuzzy typo-distance matching** (e.g. `Finance` vs
  `Finanace`) is left out on purpose, because responsible thresholds and performance need more care
  than a first cut allows. Analysis is synchronous (no Web Worker) with example caps and a row
  ceiling; that keeps large-but-reasonable files responsive, and a worker would be the next step for
  very large ones.
- **Diffoscope is a comparison instrument, not a merge editor.** No three-way merge, no patch
  application, no directory/binary/PDF/image comparison, and no semantic/AST/LLM diffing —
  deliberately. Character comparison (the expensive grapheme-level path) is gated behind a one-click
  confirmation for very large inputs; rendered segments are capped and pathologically-different
  inputs fall back to an approximate block diff, with the summary counts kept exact — a Web Worker
  would be the next step. Subtle-difference findings are derived from the character diff and
  suppressed when the two inputs differ substantially, so they stay signal rather than noise.
- **JSON Crime Scene inspects one document — nothing more.** No JSON5 / YAML / TOML / NDJSON, no
  JSON Schema generation or validation, no fetching or diffing, and no editing through the tree —
  deliberately. It reads one JSON value and profiles it unusually well. Analysis is a set of near-O(_n_)
  passes with capped examples and bounded, lazily-rendered tree output; a Web Worker would be the next
  step for very large documents. Value-preview search matches the first ~200 characters of long
  strings rather than re-scanning megabytes on every keystroke, and shape analysis groups objects by
  normalized key set instead of comparing them pairwise.

---

## Philosophy

Local-first. No account. No database. No paid APIs. Privacy-friendly by construction — the
data never leaves the page. Fast, accessible, and cheap to host as static files. New tools
arrive only when they're genuinely finished.
