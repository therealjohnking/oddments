import { PastewrightApp } from '@/components/pastewright/PastewrightApp';
import { pageMetadata } from '@/lib/site/meta';

export const metadata = pageMetadata({
  name: 'Pastewright',
  description:
    'Paste Markdown, choose where it is going, and copy a version adapted for that destination — rich text for email and documents, LinkedIn, Slack, Reddit Markdown, or exceptionally readable plain text. Tables are a first-class problem: they become real HTML tables, aligned columns, or record blocks as the destination needs. Pastewright transforms representation, not your words. Runs entirely in your browser.',
  path: '/tools/pastewright',
});

export default function PastewrightPage() {
  return <PastewrightApp />;
}
