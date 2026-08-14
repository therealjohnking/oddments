import { formatBytes, formatInt, type StructuralProfile } from '@/lib/json-crime-scene';
import styles from './jcs.module.css';

interface Props {
  profile: StructuralProfile;
}

export function OverviewPanel({ profile }: Props) {
  const metrics: { value: string; label: string; small?: boolean; strong?: boolean }[] = [
    { value: profile.rootKind, label: 'Root type', small: true },
    { value: formatInt(profile.totalNodes), label: 'Values' },
    { value: formatInt(profile.objects), label: 'Objects' },
    { value: formatInt(profile.arrays), label: 'Arrays' },
    { value: formatInt(profile.properties), label: 'Properties' },
    { value: String(profile.maxDepth), label: 'Max depth' },
    { value: formatBytes(profile.sourceBytes), label: 'Size', small: true },
    { value: formatInt(profile.findingCount), label: 'Findings', strong: profile.findingCount > 0 },
  ];

  const bySev = profile.findingCountBySeverity;
  const noteParts: string[] = [
    `${formatInt(profile.strings)} strings · ${formatInt(profile.numbers)} numbers · ${formatInt(profile.booleans)} booleans · ${formatInt(profile.nulls)} nulls`,
  ];
  if (profile.duplicateKeyGroups > 0) {
    noteParts.push(
      `${formatInt(profile.duplicateKeyGroups)} duplicate-key ${profile.duplicateKeyGroups === 1 ? 'group' : 'groups'}`,
    );
  }
  if (profile.findingCount > 0) {
    noteParts.push(`${bySev.warning} warning · ${bySev.notice} notice · ${bySev.info} info`);
  }

  return (
    <section className={styles.panel} aria-label="Structural overview">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Overview</h2>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.metricGrid}>
          {metrics.map((metric) => (
            <div
              className={`${styles.metric} ${metric.strong ? styles.metricStrong : ''}`}
              key={metric.label}
            >
              <span
                className={`${styles.metricValue} ${metric.small ? styles.metricValueSmall : ''}`}
              >
                {metric.value}
              </span>
              <span className={styles.metricLabel}>{metric.label}</span>
            </div>
          ))}
        </div>
        <p className={styles.overviewNote}>{noteParts.join('  ·  ')}</p>
      </div>
    </section>
  );
}
