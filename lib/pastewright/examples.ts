/**
 * Built-in examples — realistic, synthetic Markdown that shows *why* Pastewright
 * exists. The table-heavy one is the flagship: switching destinations changes its
 * result dramatically. Nothing here is sensitive; it's all generic material.
 */

export interface PastewrightExample {
  id: string;
  label: string;
  blurb: string;
  markdown: string;
}

const llmResponse = [
  '## Getting started with the API',
  '',
  "Thanks for the question! Here's a quick rundown of how authentication works.",
  '',
  "You'll need an **API key**, which you generate from your dashboard. Keep it secret — treat it like a password. Every request must include it in the `Authorization` header.",
  '',
  'The basics:',
  '',
  '- Create a project in the console',
  '- Generate a key under **Settings → API keys**',
  '- Add the key to your environment as `API_KEY`',
  '- Make your first request to the `/v1/ping` endpoint',
  '',
  'For the full reference, see the [developer documentation](https://example.com/docs).',
].join('\n');

const vendorComparison = [
  '## Vendor comparison',
  '',
  'We evaluated four analytics vendors against the criteria that matter most for a small team.',
  '',
  '| Vendor | Setup | Monthly | Best for | Main limitation |',
  '|---|---:|---:|---|---|',
  '| Atlas | $0 | $29 | Small teams getting started | Limited data export |',
  '| Beacon | $199 | $49 | Scheduled reporting | Slower initial setup |',
  '| Cedar | $99 | $39 | Real-time collaboration | Fewer third-party integrations |',
  '| Delta | $0 | $79 | High-volume event tracking | Sampling above 5M events |',
  '',
  'Every option covers the basics; the differences show up at scale.',
].join('\n');

const codeDoc = [
  '### Parsing a config file',
  '',
  'Use `loadConfig()` to read and validate settings. It throws on malformed input, so wrap it in a try/catch.',
  '',
  '```ts',
  "import { loadConfig } from './config';",
  '',
  "const config = loadConfig('./app.config.json');",
  'console.log(config.port); // 3000',
  '```',
  '',
  'Validation happens in two passes:',
  '',
  '1. Structural checks',
  '   - Required keys are present',
  '   - No unknown keys remain',
  '2. Semantic checks',
  '   - Ports are in range',
  '   - Paths resolve on disk',
  '',
  'See the [schema reference](https://example.com/schema) for the full list.',
].join('\n');

const mixedDocument = [
  '# Project update',
  '',
  'A short status note before the weekend.',
  '',
  '## Progress',
  '',
  '> "Ship the smallest thing that is genuinely finished." — our north star',
  '',
  'Done and in flight:',
  '',
  '- [x] Draft the API spec',
  '- [x] Wire up the parser',
  '- [ ] Write the migration guide',
  '- [ ] Announce the beta',
  '',
  '## Rollout window',
  '',
  '| Region | Date | Owner |',
  '|---|---|---|',
  '| US | Mon | Priya |',
  '| EU | Wed | Tomas |',
  '| APAC | Fri | Mei |',
  '',
  'Questions? Reply in the thread.',
].join('\n');

export const EXAMPLES: PastewrightExample[] = [
  {
    id: 'llm-response',
    label: 'LLM response',
    blurb: 'A typical assistant reply: heading, prose, bold, a bullet list and a link.',
    markdown: llmResponse,
  },
  {
    id: 'vendor-comparison',
    label: 'Comparison table',
    blurb: 'The flagship: one wide table, five ways. Switch destinations and watch it change.',
    markdown: vendorComparison,
  },
  {
    id: 'code-doc',
    label: 'Code & docs',
    blurb: 'Fenced code, inline code, a nested list and a link.',
    markdown: codeDoc,
  },
  {
    id: 'mixed-document',
    label: 'Mixed document',
    blurb: 'A quote, a task list, a table and a heading hierarchy together.',
    markdown: mixedDocument,
  },
];
