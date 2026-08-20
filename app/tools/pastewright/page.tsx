import type { Metadata } from 'next';
import { PastewrightApp } from '@/components/pastewright/PastewrightApp';

export const metadata: Metadata = {
  title: 'Pastewright',
  description:
    'Paste Markdown, choose where it is going, and copy a version adapted for that destination — rich text for email and documents, LinkedIn, Slack, Reddit Markdown, or exceptionally readable plain text. Tables are a first-class problem: they become real HTML tables, aligned columns, or record blocks as the destination needs. Pastewright transforms representation, not your words. Runs entirely in your browser.',
};

export default function PastewrightPage() {
  return <PastewrightApp />;
}
