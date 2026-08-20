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

### Corporate Phrase Bingo — `/tools/corporate-bingo`

A bingo card for surviving meetings one cliché at a time. Open it and you immediately have a
randomized 5×5 card drawn from a built-in deck of corporate phrases; tap each square as you hear it
said, and win on any row, column, or diagonal. Its premise is deliberate:

> **Turn strategic alignment into a competitive event.**

It is a game rather than a diagnostic instrument — but it is built like the rest of Oddments:
composed, accessible, and entirely local. No account, no network, and _no microphone_ — you tap a
square when somebody says the phrase; that is the game.

- **A card, ready to play.** A first-time visitor never has to click “Generate” — a valid card is
  dealt on load, with a FREE center and no phrase repeated. The default deck holds ~75 phrases people
  plausibly say in real meetings (not company-specific jargon), so two cards look meaningfully
  different. The shuffle is a clean partial Fisher–Yates over an **injectable** random source, so the
  engine is deterministic under test.
- **Winning, honestly.** All twelve standard lines are recognized — five rows, five columns, two
  diagonals — with the FREE center counting as marked. A card can hold **several** completed lines at
  once, and play continues past the first: the tool reports whether you have bingo, how many lines are
  complete, and exactly which squares participate. Mark all 24 and it recognizes a **full card**.
- **Squares that are real controls.** Each square is a large toggle button (a labelled group, not a
  fragile ARIA grid), keyboard-operable with visible focus, its marked state carried by `aria-pressed`.
  Marked, part-of-a-completed-line, and unmarked are always distinguishable **without relying on
  colour** — a check glyph, an inset ring, and fills of different weight — and hold up under Windows
  High Contrast.
- **A restrained bingo moment.** The first line lands a small, composed banner (_“Bingo. Alignment has
  been achieved.”_) — no confetti, no sound, no modal — announced once to a screen reader without
  live-region spam, and suppressed under `prefers-reduced-motion`. The card stays fully usable
  underneath it.
- **Your own phrases.** A plain one-phrase-per-line editor lets you replace the deck. Input is
  trimmed, blank lines are ignored, and duplicates (ignoring case and spacing) are counted once; the
  tool explains the 24-phrase minimum, never discards text you are still editing, and can restore the
  default deck at any time.
- **Reset vs New card.** _Reset marks_ clears your taps but keeps the exact same card (it never
  reshuffles). _New card_ deals a fresh one, asking for a light inline confirmation only when there is
  real progress to lose.
- **Remembered locally.** Your current card, its marks, the deck choice, and any custom phrases are
  saved in `localStorage` and restored on your next visit. Stored data is validated defensively:
  anything corrupt, incompatible, or from a future version is discarded and a fresh card is dealt
  rather than crashing the page.

### Date Goblin — `/tools/date-goblin`

A local-first date/time interpretation and conversion instrument. Paste an ISO timestamp, a Unix
time, a local wall-clock time, or an Excel serial, and it answers the questions a formatter can’t:
**what exact moment is this, and what does this clock reading actually mean in a given zone?** Its
premise is deliberate:

> **Make the temporal nonsense legible — never hide ambiguity behind a convenient guess.**

- **Instant vs. local time, made explicit.** The tool’s central distinction runs through everything.
  An **instant** (a Unix timestamp, or an ISO string carrying `Z`/an explicit offset) already pins one
  moment on the global timeline; a zone only changes how it is _displayed_. A **local wall-clock
  time** (an ISO datetime with no zone, an Excel serial) is just a clock reading until a zone is
  applied — and that application can be ambiguous or impossible. Every interpretation is badged
  `◎ Instant` or `◷ Local wall time` and says what format was recognized and what, if anything, was
  assumed.
- **DST folds and gaps are the flagship, not a footnote.** When a local time falls in an autumn
  **fall-back**, it occurs twice — `2026-11-01 01:30` in `America/New_York` is both `-04:00` (EDT,
  `05:30Z`) and `-05:00` (EST, `06:30Z`) — and the tool shows **both** instants and makes you choose,
  rather than silently picking one. When a local time lands in a spring-forward **gap** —
  `2026-03-08 02:30`, skipped as clocks jump `02:00 → 03:00` — it says the time never happens and
  offers the two nearest real readings. Resolution is delegated to the **Temporal** API’s
  `earlier`/`later` disambiguation and cross-checked by round-trip, so no DST rules are hand-rolled;
  half-hour zones (Lord Howe) and southern-hemisphere zones are handled the same way.
- **Conservative, explicit parsing.** Recognition is strict: extended ISO 8601 only (basic
  separator-free forms are excluded because they collide with Unix), bare numbers as Unix timestamps,
  and no `Date.parse` guesswork. A locale-ambiguous value like `03/04/26` is **refused** — it shows
  both the month/day and day/month readings and asks for an ISO date — rather than guessing from the
  browser’s locale. Explicit modes (ISO, Unix, Local, Excel) are always available when auto-detection
  should not commit.
- **Unix timestamps you can trust.** Seconds, milliseconds, microseconds, and nanoseconds, worked in
  `bigint` nanoseconds so precision is never lost. Auto-detection uses digit count but **cross-checks
  plausibility** and always names the alternative it set aside; when more than one unit lands on a
  plausible date (the classic “is this seconds or milliseconds?” trap) it declines to guess and asks
  for an explicit unit. `0`, negative timestamps, fractional seconds, and out-of-range values are all
  handled honestly.
- **The Excel 1900 leap-year bug, explained.** Excel’s 1900 date system treats 1900 as a leap year,
  inventing a fictitious `1900-02-29` at serial 60 and shifting every serial ≥ 61 by a day. Date
  Goblin models this exactly: serials 1–59 map straight, **serial 60 is reported as the unreal date it
  is** (with its real neighbours, serial 59 = `1900-02-28` and serial 61 = `1900-03-01`), and ≥ 61 is
  shifted back. The 1904 system is offered as an explicit alternative; the tool never guesses which
  system a number came from.
- **Representations and comparison.** Canonical ISO 8601 (UTC and the selected zone’s offset), Unix
  seconds/milliseconds, epoch nanoseconds, and whether the value fits a JavaScript `Date` — each
  copyable, plus a one-click diagnostic summary. A compact, bounded zone table shows the moment in
  **UTC, your system zone, the source/selected zone, and a few comparison zones** you add through a
  native searchable picker (real IANA identifiers, never abbreviations like “EST”).
- **Calendar facts, precisely.** Weekday, day-of-year, **ISO week and ISO week-year** (correctly
  distinct near New Year — `2027-01-01` is week 53 of **2026**), quarter, leap-year status, and days in
  month — all computed deterministically from fixed English tables, never the machine’s locale.
- **Local, and forgetful by design.** Your preferred mode, last-used zone, comparison zones, and
  Excel/Unix preferences are remembered in `localStorage`; the **entered date/time is never saved** —
  it may be sensitive operational data. Nothing is uploaded, there is no location lookup, and relative
  time (“3 hours ago”) is computed against a shared minute-level clock with no per-second work.

---

### Regex Workbench — `/tools/regex-workbench`

A local-first instrument for understanding, testing, and refining **JavaScript / ECMAScript**
regular expressions — and only that engine. Enter a pattern and it answers the three questions a
plain highlighter can’t: **what matched, why it matched, and what the engine actually interpreted.**
Its premise is deliberate:

> **Expose the engine, don’t hide it — when `RegExp` does something surprising, show the surprise.**

- **JavaScript regex only, and it says so.** No PCRE/Python/.NET/Java flavor switching, no pretence
  that JS syntax is universal. The engine is labelled everywhere, because regex semantics vary by
  engine and that difference matters.
- **Matching runs off the main thread.** User-supplied regex over user-supplied text is genuinely
  dangerous — catastrophic backtracking is synchronous and uninterruptible on the main thread — so
  matching runs in a **Web Worker with a time budget**. If a run exceeds it, the worker is
  terminated and recreated and the tool reports _“matching took too long and was stopped”_ (never
  _“this regex is vulnerable”_ — that is not something structure can prove). The worker is built
  from a **Blob URL** with the executor embedded verbatim, so the static export stays portable and
  there is exactly one, unit-tested match implementation. Results are bounded (first 1,000 matches),
  and stale worker replies can never overwrite newer input.
- **Capture groups, done properly.** Every match shows group 0, each numbered group, and each named
  group with its value and exact range — and it distinguishes an **unmatched group** (`null`, did
  not participate) from a group that **captured the empty string** (`""`). Repeated captures show
  the last participating iteration, exactly as JavaScript keeps them. Positions come from the
  engine’s own match indices (the `d` flag, used internally).
- **Zero-width matches made visible.** Anchors, word boundaries, lookarounds and empty-capable
  patterns produce matches _between_ characters; the workbench renders them as carets rather than
  faking a one-character highlight, and its iteration advances one **code point** past each empty
  match under `u`/`v` (never splitting an astral pair) so `/^/gm` or `//g` terminate instead of
  looping forever.
- **A deterministic, structural explanation.** The flagship. The pattern is parsed with a mature
  ECMAScript AST parser (`@eslint-community/regexpp`) and rendered as a nesting-preserving tree —
  quantifiers, groups, named groups, alternation, character classes, ranges, shorthand and
  `\p{…}` property escapes, assertions, lookaround, backreferences, and `v`-mode set operations.
  **No LLM, no regex-about-regex guessing.** Flag-sensitive meanings are annotated honestly (`.`
  notes whether `s` lets it cross newlines; `^`/`$` note whether `m` makes them per-line). When the
  parser meets syntax it can’t yet handle, the explanation degrades to “unavailable” rather than
  inventing structure.
- **Honest positions.** Match and group offsets are **UTF-16 code units** — the only kind `RegExp`
  produces — and are labelled as such; line/column are derived separately in 1-based lines and
  **code-point** columns and never conflated with the raw offset.
- **Replacement with real semantics.** A replacement preview built on `String.prototype.replace`,
  so `$&`, `$1`, `$<name>`, `` $` ``, `$'` and `$$` behave exactly as JavaScript defines them —
  including that flags decide scope (without `g`, only the first match is replaced). A compact token
  explainer marks an out-of-range `$7` or unknown `$<name>` as inert, exactly where JS leaves it
  literal.
- **Restrained diagnostics.** It flags genuinely surprising shapes — a pattern that can match empty
  text, a global pattern that will emit zero-width matches, and the classic **nested-quantifier**
  backtracking shape (`(a+)+`, `(.*)*`, `(?:a?)*`) — each backed by a clear structural rule, and
  never claims a proof it doesn’t have. An ordinary `.*` or an unanchored pattern is never flagged.
- **A bounded test-case bench.** Add short “should this match?” rows and see pass/fail against the
  current pattern as you edit — a lightweight way to pin down intent. No suites, no persistence, no
  ceremony.
- **Copy & export.** A safe `/pattern/flags` literal (with `/` correctly escaped and empty rendered
  as `(?:)`), a `new RegExp("…", "…")` constructor form, the pattern body, selected-match details,
  and a plain-text diagnostic summary.
- **Local, and forgetful by design.** Only your **selected flags** are remembered; the pattern, the
  test text, and the replacement string are **never saved** — any of them may be proprietary.
  Nothing is uploaded, and there is no telemetry, analytics, or external regex API.

---

### Pastewright — `/tools/pastewright`

Markdown is great until you need to put it somewhere that isn’t. Pastewright takes Markdown you’ve
copied from an LLM, a README, or your notes, and adapts it for a destination you choose — email and
documents, LinkedIn, Slack, Reddit, or plain text — then shows you exactly what it changed. Its
premise is deliberate:

> **Write once. Paste where it belongs — transform representation, not authorship.**

- **It never rewrites your words.** No summarising, paraphrasing, shortening, tone-shifting, hashtag
  or emoji insertion, and no LLM. It changes only _structural representation_ — a heading becomes a
  plain-text section label, a link becomes label + URL, a table becomes a readable record list —
  while every word, and their order, come through faithfully. There are tests that assert the
  author’s prose survives each destination unchanged.
- **A real Markdown parser, not regexes.** The source is parsed with **micromark** (a CommonMark
  state machine) via `mdast-util-from-markdown` plus the **GFM** extension, producing a proper
  `mdast` tree — headings, emphasis, strong, strikethrough, ordered/unordered/nested/task lists,
  blockquotes, links, autolinks, images, inline and fenced code (with language), thematic rules,
  tables with alignment, escaped punctuation. Everything downstream walks that tree.
- **Tables are a first-class problem, not an edge case.** LLMs love tables that look perfect in
  Markdown and turn to mush anywhere else. Pastewright understands a table structurally and degrades
  it deliberately: **real `<table>`** for rich text, a **Markdown pipe table** for Reddit, and for
  plain-text destinations either a **bordered aligned table** or a **record layout** (one labelled
  block per row). The aligned table is genuinely robust: it draws restrained `|` column separators
  and a header rule, targets a **bounded width** rather than trusting the destination to wrap, and
  **wraps cell contents to their column** — so a logical row can span several physical lines with
  continuation text kept under the correct cell, its height set by the tallest cell, and long
  unbroken tokens (URLs) hard-broken instead of blowing up the layout. A deterministic three-tier
  **Auto** strategy chooses **aligned** for compact tables, **wrapped aligned** for moderately wide
  ones, and **records** when there are too many columns for columns to read well — from the table’s
  shape and the destination, never from viewport width, so the copied result is stable. A restrained
  **Auto / Aligned / Records** override is offered where it makes sense, and choosing **Aligned**
  explicitly always uses the wrapping renderer rather than demoting a wide table to records. Every
  header and every cell is preserved; escaped pipes, empty cells, inline formatting inside cells,
  Unicode, and ragged rows are all handled, and column widths are measured by **display width**
  (grapheme-aware, CJK-wide), not UTF-16 length.
- **Honest destinations, verified — not assumed.** Slack’s composer does **not** reliably convert
  pasted Markdown, so the Slack profile emits plain text, drops emphasis it can’t honour, and rides
  compact tables **inside a ` ``` ` code block** so their columns actually line up. LinkedIn gets
  clean plain text with **no pseudo-bold Unicode letters** — and because it renders posts in a
  **proportional font** that re-wraps text, aligned columns can’t survive there, so LinkedIn tables
  are **always the record layout** (the aligned option isn’t even offered), headings are plain section
  labels rather than box-drawing underlines, and a horizontal rule becomes a single restrained em dash
  instead of a long solid-looking bar. Reddit keeps Markdown (tables and fenced code included) and
  adapts only what Reddit can’t show — images become links, task checkboxes become box glyphs. Plain
  text stays deliberately formatted, not merely stripped.
- **Standards-based rich clipboard.** The rich-text destination writes both **`text/html`** and
  **`text/plain`** via `ClipboardItem`, so the receiving app can choose, and the plain-text fallback
  stays useful on its own. When rich writing is unavailable, unsupported, denied, or needs a secure
  context, it **degrades gracefully** — copies plain text and says what happened — rather than
  breaking.
- **No XSS path, by construction.** Raw HTML in the source is treated as **literal text and escaped**
  — never rendered. The rich output is built from a small controlled node tree (the single source of
  truth for both the clipboard HTML _and_ the React preview, so they can’t drift); all text is escaped
  at serialisation, `href`s are scheme-checked (`javascript:` and friends become inert text), images
  become labelled links rather than fetched or embedded, and nothing reaches the DOM through
  `dangerouslySetInnerHTML`.
- **Show the transformation, don’t hide it.** A **Destination adjustments** report says, in plain
  language, what happened — “one 5-column table became four record blocks”, “3 links shown as label +
  URL”, “bold and italic can’t be shown here; text kept without emphasis” — aggregated sensibly (one
  note per class of construct, never one per bold word). A compact status — **Preserved**,
  **Adapted**, or **Formatting compromises** — is derived from the findings, and ordinary destination
  adaptation is described as an adjustment, never an error.
- **Local, and forgetful by design.** Only your **last destination** and **table-layout preference**
  are remembered; the Markdown source and every generated output are **never saved**. Nothing is
  uploaded, and there is no telemetry, analytics, external conversion API, or account.

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
  tools/corporate-bingo/      the Corporate Phrase Bingo route
  tools/date-goblin/          the Date Goblin route
  tools/regex-workbench/      the Regex Workbench route
  tools/pastewright/          the Pastewright route
  layout.tsx, globals.css     shell, design tokens, theming
components/
  site/                       header, footer, theme toggle
  inspector/                  inspector React UI (+ its own CSS module)
  slopometer/                 slopometer React UI (+ its own CSS module)
  csv-autopsy/                CSV Autopsy React UI (+ its own CSS module)
  diffoscope/                 Diffoscope React UI (+ its own CSS module)
  json-crime-scene/           JSON Crime Scene React UI (+ its own CSS module)
  corporate-bingo/            Corporate Phrase Bingo React UI (+ its own CSS module)
  date-goblin/                Date Goblin React UI (+ its own CSS module)
  regex-workbench/            Regex Workbench React UI + the Blob-worker executor (+ CSS module)
  pastewright/                Pastewright React UI + rich-clipboard + RichNode preview (+ CSS module)
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
lib/corporate-bingo/          framework-agnostic engine (the tested core)
  types.ts                    shared types + geometry constants (5×5, FREE center)
  default-phrases.ts          the built-in corporate-phrase deck
  deck.ts                     phrase normalization + deck validation
  generate.ts                 injectable-RNG shuffle/sample + card generation
  bingo.ts                    the twelve win-lines + pure win detection
  game.ts                     pure state transitions (deal / toggle / reset / deck)
  format.ts                   pluralization, line-list + announcement copy, card serial
  persistence.ts              defensive save / load / validate / migrate
  index.ts                    public API + re-exports
  *.test.ts                   unit tests
lib/date-goblin/              framework-agnostic engine (the tested core)
  types.ts                    plain domain types (Instant, WallDateTime, Resolution, …)
  temporal.ts                 the Temporal adapter (native-preferring, polyfill fallback)
  core.ts                     Temporal → plain-domain converters (the library membrane)
  parse.ts                    strict ISO / auto-detection / ambiguity (no Date.parse)
  resolve.ts                  wall-time → instant with DST fold/gap classification
  unix.ts                     Unix seconds/ms/µs/ns in bigint, unit disambiguation
  excel.ts                    Excel 1900/1904 serials + the serial-60 phantom
  calendar.ts                 weekday / day-of-year / ISO week + week-year facts
  zones.ts                    IANA list, system zone, validation, offset/DST context
  relative.ts                 deterministic relative-time phrasing (Intl.RelativeTimeFormat)
  format.ts                   offsets, epoch-seconds decimals, fixed English name tables
  range.ts                    the shared ±10⁸-day supported range
  interpret.ts                orchestrator: parse → resolve → describe → findings
  report.ts                   copyable diagnostic summary
  persistence.ts              defensive settings save/load (never the entered value)
  examples.ts                 the built-in demonstration set
  index.ts                    public API: interpret() + re-exports
  *.test.ts                   unit tests
lib/regex-workbench/          framework-agnostic engine (the tested core)
  types.ts                    plain domain types (compile / match / explain / replace)
  flags.ts                    flag metadata + runtime feature-detection + canonicalization
  ast.ts                      the sole seam onto @eslint-community/regexpp (+ nullability)
  compile.ts                  RegExp validation, group metadata, execFlags, literal import
  execute.ts                  the self-contained match iterator (embedded in the worker)
  matches.ts                  raw matches → positions / groups / zero-width enrichment
  positions.ts                UTF-16 offset → 1-based line / code-point column
  explain.ts                  AST → deterministic, nesting-preserving explanation tree
  diagnostics.ts              restrained, structural hazard findings (no fake ReDoS prover)
  replace.ts                  JS-exact replacement preview + token explainer
  export.ts                   safe /pattern/flags literal + constructor forms
  testcases.ts                the bounded "should this match?" bench
  examples.ts                 the built-in demonstration set
  report.ts                   copyable diagnostic summary
  limits.ts                   match cap, worker timeout, render caps
  persistence.ts              defensive settings save/load (flags only, never content)
  index.ts                    public API: compile/execute/enrich/explain/diagnose/replace
  *.test.ts                   unit tests
lib/pastewright/              framework-agnostic engine (the tested core)
  types.ts                    plain domain types (destination, findings, RichNode, stats)
  parse.ts                    the micromark + GFM → mdast seam
  width.ts                    grapheme-aware display-width measurement (CJK/emoji)
  inline.ts                   inline phrasing → plain text (links/images/emphasis)
  tables.ts                   table model + aligned / record rendering + Auto heuristic
  plain-text.ts               policy-driven block renderer (LinkedIn / Slack / Plain)
  rich-text.ts                mdast → controlled RichNode tree → safe HTML + preview
  reddit.ts                   mdast → Reddit Markdown (to-markdown) + honest adaptations
  profiles.ts                 the five destination profiles + plain-text policies
  transform.ts                orchestrator: parse → render → report
  report.ts                   aggregated findings + status classification
  util.ts                     HTML escaping, URL scheme-check, definitions, block joining
  examples.ts                 the built-in demonstration set
  persistence.ts              defensive settings save/load (preferences only, never content)
  index.ts                    public API: transform() + re-exports
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
- **Corporate Phrase Bingo adds no dependency, and isolates its randomness.** A bingo game needs a
  shuffle, which is the one place Oddments is non-deterministic — so the randomness is a _parameter_,
  not a hidden dependency. The card is dealt by a small partial Fisher–Yates over the deck that takes
  an injectable random source (the browser’s `Math.random` in the app, a seeded generator in tests),
  and win detection is a pure function of the marks array. Card generation and `localStorage` are
  client-only, so a `useSyncExternalStore` snapshot keeps the first render identical on server and
  client and the real card is dealt right after hydration — no mismatch, and no “Generate” button.
  Stored state is treated as untrusted: the card is structurally validated and lesser fields are
  coerced, so incompatible or corrupt data degrades to a fresh card instead of a broken page.
- **Date Goblin’s one dependency is a standards-based date engine.** Correct DST fold/gap resolution,
  ISO week-years, and nanosecond-faithful timestamps are exactly the kind of temporal logic that
  should _not_ be hand-rolled — so Date Goblin sits on the **Temporal** API (a Stage-4 TC39
  proposal). Because Temporal is not yet everywhere (Safari, and the Node/jsdom test runtime lack it),
  a single focused module (`temporal.ts`) **prefers the host’s native `Temporal` when present and
  falls back to [`temporal-polyfill`](https://github.com/fullcalendar/temporal-polyfill)** (MIT,
  no `jsbi`/legacy transitive deps; it delegates zone data to the host `Intl`, so both paths read the
  same current IANA database). That module is the only place the library is touched: every value the
  engine returns is plain, serialisable domain data (`bigint` epoch-nanoseconds, numbers, strings), so
  no Temporal object ever reaches React and swapping the engine would change one file. DST is resolved
  via Temporal’s own `earlier`/`later` disambiguation and verified by round-trip; no zone rules are
  written by hand.
- **Date Goblin is forgetful on purpose, and hydration-safe.** The entered date/time is **never**
  persisted (only settings are), because it may be sensitive; a reload starts blank. The system zone,
  `localStorage`, and the clock are all environment reads, so — like Corporate Bingo — a
  `useSyncExternalStore` snapshot and an adjust-state-during-render initialization keep the first
  render identical on server and client, and relative time is driven by a shared minute-granularity
  clock store rather than a per-component timer.
- **Regex Workbench’s one dependency is a real ECMAScript AST parser, and its one novel piece of
  infrastructure is a Web Worker — both earned.** The structural explanation and the AST-based
  diagnostics must reflect what JavaScript’s `RegExp` _actually_ parses, so they sit on
  [`@eslint-community/regexpp`](https://github.com/eslint-community/regexpp) (MIT, **zero
  transitive dependencies**, the parser behind ESLint’s regexp rules — already present transitively,
  now a direct dependency), targeting the latest ECMAScript grammar it knows. It is wrapped in one
  module (`ast.ts`); regexpp AST nodes never reach React, and when it can’t parse syntax the native
  engine still accepts, the explanation degrades rather than guessing. The worker is the first in
  Oddments and, unlike the deferred cases below, is _load-bearing_: running a user regex over user
  text can backtrack catastrophically, and that is synchronous and uninterruptible on the main
  thread. So matching runs in a **Blob-URL Web Worker with a hard time budget** — the same
  self-contained `executeRegex` that unit tests exercise on the main thread is embedded verbatim via
  `toString()`, so the static export needs no bundler worker-emission and there is one implementation,
  not two. The manager rejects stale replies by request id, terminates and recreates the worker on
  timeout (recovering cleanly for the next run), and keeps only the latest queued request. `regexpp`
  itself is a _linear_ parser, so it stays on the main thread safely; only execution is offloaded.
- **Regex Workbench refuses to over-claim.** It is JavaScript-only and says so everywhere; it never
  labels a pattern “vulnerable” (backtracking cost is input-dependent and not decidable from
  structure — the timeout is the real safety net); it never mislabels a UTF-16 offset as a
  “character position”; and it distinguishes an unmatched capture from an empty one. Only the flags
  are persisted — the pattern, test text, and replacement are treated as potentially sensitive and
  never saved.
- **Pastewright’s dependencies are a real Markdown parser stack, and they’re earned.** Correct
  CommonMark + GFM parsing — nested lists, task-list state, tables with per-column alignment,
  escaped pipes inside cells, fenced-code language labels, raw HTML as distinct nodes — is a genuine
  state machine, not something to approximate with regexes. So parsing sits on **micromark** via
  [`mdast-util-from-markdown`](https://github.com/syntax-tree/mdast-util-from-markdown) +
  [`micromark-extension-gfm`](https://github.com/micromark/micromark-extension-gfm) /
  [`mdast-util-gfm`](https://github.com/syntax-tree/mdast-util-gfm), and the Reddit destination
  re-serialises with [`mdast-util-to-markdown`](https://github.com/syntax-tree/mdast-util-to-markdown)
  rather than a hand-rolled Markdown writer (all MIT, pure ESM, browser/static-export safe, `npm
audit` clean). The `mdast` tree is exactly the shape the transform needs; every renderer walks it,
  and nothing downstream re-parses source. The engine keeps that tree behind its own domain
  functions, so it has no React dependency and could be extracted later.
- **Pastewright transforms representation, not authorship, and has no XSS path by construction.**
  It never rewrites, summarises, or “improves” prose — there are tests asserting the author’s words
  survive each destination — it only re-represents structure. Raw HTML in the source is treated as
  **literal text and escaped**, never rendered; the rich-text output is built from a small controlled
  node tree that is the single source of truth for both the `text/html` clipboard payload _and_ the
  React preview (so they can’t drift), with all text escaped at serialisation, `href`s scheme-checked
  (`javascript:` becomes inert text), images rendered as labelled links rather than fetched, and no
  `dangerouslySetInnerHTML` of source anywhere. The rich clipboard uses `ClipboardItem` with both
  `text/html` and `text/plain` and **degrades honestly** (plain-text copy + a plain explanation) when
  rich writing is unsupported, denied, or needs a secure context. Slack’s paste behaviour was
  **verified rather than assumed** — its composer doesn’t reliably convert pasted Markdown, so that
  profile drops emphasis it can’t honour and rides compact tables inside a code block. Only the last
  destination and the table-layout preference are persisted; the Markdown source and every output are
  never saved.

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
- **Corporate Phrase Bingo is one bingo card — nothing more.** No multiplayer, no shared or live
  games, no accounts, and no scores, points, streaks, or achievements — deliberately; it is a game,
  not a gamification dashboard. **Shareable cards** were considered and deferred: a self-contained
  share URL would have to carry all 24 phrases (custom decks aren’t on the recipient’s device), and a
  seed-only link would only work for the default deck — neither is cleanly bounded, so it is left out
  rather than half-built. And of course nothing here listens: the phrases are marked by a human tap,
  never by a microphone or transcription.
- **Date Goblin interprets and converts — it is not a calendar or scheduler.** No event creation,
  reminders, recurrence, cron, business-day or holiday calculations, sunrise/sunset, NTP checks, or
  geolocation — deliberately; it answers “what moment is this?”, unusually well. It leans on
  **explicit, conservative parsing**: no natural-language dates (“next Tuesday”), no `Date.parse`
  fallback, and genuinely ambiguous input is surfaced rather than guessed. Zone abbreviations (`EDT`,
  `GMT+5:30`) are shown as _display only_ — the IANA identifier and numeric offset stay authoritative,
  because an abbreviation is never a reliable zone. The comparison-zone table is intentionally capped
  (this is an instrument, not a world-clock dashboard), and there is no analog clock, globe, or
  calendar grid.
- **Pastewright prepares content for the clipboard — you paste it yourself.** No direct posting and
  no Gmail / Outlook / LinkedIn / Slack / Reddit / Docs integrations, no OAuth, no DOCX or PDF export,
  no file uploads, and — emphatically — **no AI rewriting**: no summarising, tone-shifting,
  hashtag/emoji generation, character-limit trimming, or “engagement” optimisation. It ships a
  deliberately bounded set of five destinations rather than a plugin marketplace, and does not try to
  infer where you’re pasting from clipboard history or browser state — you choose. Aligned-table
  display width is a documented approximation (grapheme- and CJK-aware, but exotic emoji ZWJ sequences
  may be a column off, so perfect terminal-cell alignment is not claimed for all Unicode); reference-style
  link definitions are resolved but footnotes are rendered as a plain marker. One document-level table
  strategy is offered, not per-table configuration.

---

## Philosophy

Local-first. No account. No database. No paid APIs. Privacy-friendly by construction — the
data never leaves the page. Fast, accessible, and cheap to host as static files. New tools
arrive only when they're genuinely finished.
