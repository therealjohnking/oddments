import { CorporateBingoApp } from '@/components/corporate-bingo/CorporateBingoApp';
import { pageMetadata } from '@/lib/site/meta';

export const metadata = pageMetadata({
  name: 'Corporate Phrase Bingo',
  description:
    'A bingo card for surviving meetings one cliché at a time. Deal a randomized 5×5 card of corporate phrases, tap them as you hear them, and win on rows, columns, or diagonals. Customize the deck, keep your card between sessions — all in your browser, no account, no microphone.',
  path: '/tools/corporate-bingo',
});

export default function CorporateBingoPage() {
  return <CorporateBingoApp />;
}
