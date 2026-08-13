import type { Metadata } from 'next';
import { InspectorApp } from '@/components/inspector/InspectorApp';

export const metadata: Metadata = {
  title: 'Invisible Character Inspector',
  description:
    'Reveal invisible and unusual characters in any text — zero-width spaces, non-breaking spaces, curly quotes, homoglyphs, control codes, and bidirectional tricks — with exact positions and code points. Runs entirely in your browser.',
};

export default function InvisibleCharactersPage() {
  return <InspectorApp />;
}
