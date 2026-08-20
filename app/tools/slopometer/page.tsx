import { SlopometerApp } from '@/components/slopometer/SlopometerApp';
import { pageMetadata } from '@/lib/site/meta';

export const metadata = pageMetadata({
  name: 'Slopometer',
  description:
    'A deterministic prose-style analyzer. Paste writing to score its stylistic tics — canned openers, contrast templates, corporate jargon, em-dash habits, and more — with a transparent, explainable breakdown of every rule that fired. Detects writing crimes, not AI. Runs entirely in your browser.',
  path: '/tools/slopometer',
});

export default function SlopometerPage() {
  return <SlopometerApp />;
}
