import { CsvAutopsyApp } from '@/components/csv-autopsy/CsvAutopsyApp';
import { pageMetadata } from '@/lib/site/meta';

export const metadata = pageMetadata({
  name: 'CSV Autopsy',
  description:
    'A local-first CSV profiler and diagnostic instrument. Drop in a CSV and see its structure, inferred types, candidate keys, and quality problems — duplicates, type anomalies, whitespace, capitalization drift, null-like tokens — each with a plain-language reason. Inspect first, fix deliberately. Runs entirely in your browser; nothing is uploaded, and your data is never modified.',
  path: '/tools/csv-autopsy',
});

export default function CsvAutopsyPage() {
  return <CsvAutopsyApp />;
}
