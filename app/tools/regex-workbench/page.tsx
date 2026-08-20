import { RegexWorkbenchApp } from '@/components/regex-workbench/RegexWorkbenchApp';
import { pageMetadata } from '@/lib/site/meta';

export const metadata = pageMetadata({
  name: 'Regex Workbench',
  description:
    'A local-first instrument for understanding, testing, and refining JavaScript / ECMAScript regular expressions. See what matched, why it matched, and what the engine actually interpreted — capture groups, named groups, exact positions, zero-width behaviour, a deterministic pattern explanation, and a replacement preview. Matching runs off the main thread with a safety timeout. Runs entirely in your browser.',
  path: '/tools/regex-workbench',
});

export default function RegexWorkbenchPage() {
  return <RegexWorkbenchApp />;
}
