import type { Metadata } from 'next';
import { DiffoscopeApp } from '@/components/diffoscope/DiffoscopeApp';

export const metadata: Metadata = {
  title: 'Diffoscope',
  description:
    'Compare two pieces of text and see exactly what changed — by word, character, or line — including the differences you can’t see: whitespace, invisible characters, look-alike punctuation, and Unicode-normalization quirks. Runs entirely in your browser.',
};

export default function DiffoscopePage() {
  return <DiffoscopeApp />;
}
