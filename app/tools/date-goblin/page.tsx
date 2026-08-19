import type { Metadata } from 'next';
import { DateGoblinApp } from '@/components/date-goblin/DateGoblinApp';

export const metadata: Metadata = {
  title: 'Date Goblin',
  description:
    'A local-first date/time interpretation and conversion instrument. Paste an ISO timestamp, Unix time, local wall-clock time, or Excel serial and see what it means — instant vs. local time, UTC and zone offsets, DST folds and gaps, Unix seconds/milliseconds, ISO week, and Excel’s 1900 leap-year quirk. Runs entirely in your browser.',
};

export default function DateGoblinPage() {
  return <DateGoblinApp />;
}
