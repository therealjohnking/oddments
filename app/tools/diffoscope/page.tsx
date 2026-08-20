import { DiffoscopeApp } from '@/components/diffoscope/DiffoscopeApp';
import { pageMetadata } from '@/lib/site/meta';

export const metadata = pageMetadata({
  name: 'Diffoscope',
  description:
    'Compare two pieces of text and see exactly what changed — by word, character, or line — including the differences you can’t see: whitespace, invisible characters, look-alike punctuation, and Unicode-normalization quirks. Runs entirely in your browser.',
  path: '/tools/diffoscope',
});

export default function DiffoscopePage() {
  return <DiffoscopeApp />;
}
