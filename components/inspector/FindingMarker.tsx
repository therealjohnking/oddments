import { CATEGORY_META, formatCodePoint, type Finding } from '@/lib/inspector';
import styles from './inspector.module.css';

interface Props {
  finding: Finding;
  focused: boolean;
  onSelect: (id: string) => void;
}

/**
 * A single reveal marker. Rendered inside the (aria-hidden) visual reveal, so
 * it is a real, clickable button but kept out of the tab order (tabIndex -1):
 * keyboard and screen-reader users navigate via the findings list instead.
 */
export function FindingMarker({ finding, focused, onSelect }: Props) {
  const meta = CATEGORY_META[finding.category];
  const looks = finding.looksLike ? `, looks like "${finding.looksLike}"` : '';
  const title = `${finding.name} (${formatCodePoint(finding.codePoint)})${looks} — line ${finding.line}, column ${finding.column}`;
  const base = meta.render === 'annotate' ? styles.mark : styles.chip;
  const className = `${base}${focused ? ` ${styles.focused}` : ''}`;
  const content =
    meta.render === 'annotate' ? finding.char : finding.category === 'tab' ? '→' : finding.abbr;

  return (
    <button
      type="button"
      id={`reveal-${finding.id}`}
      tabIndex={-1}
      className={className}
      data-sev={meta.severity}
      title={title}
      onClick={() => onSelect(finding.id)}
    >
      {content}
    </button>
  );
}
