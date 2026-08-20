import { InspectorApp } from '@/components/inspector/InspectorApp';
import { pageMetadata } from '@/lib/site/meta';

export const metadata = pageMetadata({
  name: 'Invisible Character Inspector',
  description:
    'Reveal invisible and unusual characters in any text — zero-width spaces, non-breaking spaces, curly quotes, homoglyphs, control codes, and bidirectional tricks — with exact positions and code points. Runs entirely in your browser.',
  path: '/tools/invisible-characters',
});

export default function InvisibleCharactersPage() {
  return <InspectorApp />;
}
