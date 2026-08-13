import type { Metadata } from 'next';
import { SlopometerApp } from '@/components/slopometer/SlopometerApp';

export const metadata: Metadata = {
  title: 'Slopometer',
  description:
    'A deterministic prose-style analyzer. Paste writing to score its stylistic tics — canned openers, contrast templates, corporate jargon, em-dash habits, and more — with a transparent, explainable breakdown of every rule that fired. Detects writing crimes, not AI. Runs entirely in your browser.',
};

export default function SlopometerPage() {
  return <SlopometerApp />;
}
