import {
  formatNumber,
  formatPercent,
  type ColumnProfile,
  type ColumnType,
  type CsvFinding,
  type FindingSeverity,
} from '@/lib/csv-autopsy';
import styles from './csv-autopsy.module.css';

const TYPE_LABEL: Record<ColumnType, string> = {
  integer: 'Integer',
  decimal: 'Number',
  boolean: 'Boolean',
  date: 'Date',
  datetime: 'Datetime',
  text: 'Text',
  mixed: 'Mixed',
  empty: 'Empty',
};

const SEV_GLYPH: Record<FindingSeverity, string> = { warning: '▲', notice: '◆', info: '●' };
const SEV_RANK: Record<FindingSeverity, number> = { warning: 2, notice: 1, info: 0 };

function maxSeverity(findings: CsvFinding[]): FindingSeverity {
  let worst: FindingSeverity = 'info';
  for (const finding of findings) {
    if (SEV_RANK[finding.severity] > SEV_RANK[worst]) worst = finding.severity;
  }
  return worst;
}

interface Props {
  columns: ColumnProfile[];
  findings: CsvFinding[];
  openColumns: Set<number>;
  onToggleColumn: (index: number, open: boolean) => void;
}

/**
 * Render a value for display. Surrounding whitespace is made visible with quotes
 * so that a padded value (a genuinely distinct string) does not look identical to
 * its clean twin in the top-values / sample lists.
 */
function displayValue(value: string): string {
  if (value === '') return '(empty)';
  if (value !== value.trim()) return `"${value}"`;
  return value;
}

function DetailStat({ value, label }: { value: string; label: string }) {
  return (
    <div className={styles.detailStat}>
      <span className={styles.detailStatValue}>{value}</span>
      <span className={styles.detailStatLabel}>{label}</span>
    </div>
  );
}

function ColumnDetail({ col, findings }: { col: ColumnProfile; findings: CsvFinding[] }) {
  const stats: { value: string; label: string }[] = [
    { value: TYPE_LABEL[col.dominantType], label: 'Type' },
    { value: formatPercent(col.completeness), label: 'Complete' },
    {
      value: `${formatNumber(col.distinct)}${col.distinctExact ? '' : '+'}`,
      label: 'Distinct',
    },
    { value: formatPercent(col.uniqueness), label: 'Unique' },
  ];
  if (col.anomalyCount > 0) {
    stats.push({ value: formatPercent(col.typeConformity), label: 'Conformity' });
  }

  const numeric = col.numeric;
  const dates = col.dates;
  const maxTop = col.topValues.length > 0 ? Math.max(...col.topValues.map((v) => v.count)) : 1;

  return (
    <div className={styles.columnDetail}>
      <div className={styles.detailStats}>
        {stats.map((stat) => (
          <DetailStat key={stat.label} value={stat.value} label={stat.label} />
        ))}
        <DetailStat value={formatNumber(col.populated)} label="Populated" />
        <DetailStat value={formatNumber(col.blank)} label="Blank" />
      </div>

      {col.candidateKey !== 'none' && (
        <p className={styles.findingWhy} style={{ margin: 0 }}>
          <strong>
            {col.candidateKey === 'strong' ? 'Likely identifier.' : 'Possible identifier.'}
          </strong>{' '}
          {col.candidateKeyReason}
        </p>
      )}

      {numeric && (
        <div>
          <p className={styles.detailSectionTitle}>Numeric summary</p>
          <div className={styles.detailStats}>
            <DetailStat value={formatNumber(numeric.min)} label="Min" />
            <DetailStat value={formatNumber(numeric.max)} label="Max" />
            <DetailStat value={formatNumber(numeric.mean)} label="Mean" />
            <DetailStat value={formatNumber(numeric.median)} label="Median" />
            {numeric.zeros > 0 && <DetailStat value={formatNumber(numeric.zeros)} label="Zeros" />}
            {numeric.negatives > 0 && (
              <DetailStat value={formatNumber(numeric.negatives)} label="Negatives" />
            )}
          </div>
          {numeric.formatted > 0 && (
            <p className={styles.exampleMore} style={{ padding: '0.3rem 0 0' }}>
              {formatNumber(numeric.formatted)} value{numeric.formatted === 1 ? '' : 's'} accepted
              after removing currency, grouping, or percent signs.
            </p>
          )}
        </div>
      )}

      {dates && (
        <div>
          <p className={styles.detailSectionTitle}>Date range</p>
          <div className={styles.detailStats}>
            <DetailStat value={dates.earliest} label="Earliest" />
            <DetailStat value={dates.latest} label="Latest" />
            <DetailStat value={formatPercent(dates.parseRate)} label="Parsed" />
          </div>
        </div>
      )}

      {col.categorical && col.topValues.length > 0 && (
        <div>
          <p className={styles.detailSectionTitle}>Top values</p>
          <div className={styles.valueBars}>
            {col.topValues.slice(0, 8).map((entry) => (
              <div className={styles.valueBar} key={entry.value}>
                <span className={styles.valueBarLabel} title={entry.value}>
                  {displayValue(entry.value)}
                </span>
                <span className={styles.valueBarCount}>{formatNumber(entry.count)}</span>
                <span className={styles.valueBarTrack} aria-hidden="true">
                  <span
                    className={styles.valueBarFill}
                    style={{ width: `${(entry.count / maxTop) * 100}%` }}
                  />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(!col.categorical || col.topValues.length === 0) && col.sampleValues.length > 0 && (
        <div>
          <p className={styles.detailSectionTitle}>Sample values</p>
          <div className={styles.sampleList}>
            {col.sampleValues.map((value, index) => (
              <span className={styles.sampleChip} key={`${value}-${index}`} title={value}>
                {displayValue(value)}
              </span>
            ))}
          </div>
        </div>
      )}

      {findings.length > 0 && (
        <div>
          <p className={styles.detailSectionTitle}>Findings on this column</p>
          {findings.map((finding) => (
            <p className={styles.detailFindingLink} key={finding.id}>
              <span aria-hidden="true">{SEV_GLYPH[finding.severity]}</span>
              {finding.title}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function ColumnsPanel({ columns, findings, openColumns, onToggleColumn }: Props) {
  return (
    <section className={styles.panel} aria-label="Column profiles">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>
          Columns <span className={styles.panelHint}>({columns.length})</span>
        </h2>
        <span className={styles.panelHint}>select a column for its full profile</span>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.columnList}>
          {columns.map((col) => {
            const colFindings = findings.filter((f) => f.columnIndex === col.index);
            const isOpen = openColumns.has(col.index);
            return (
              <details
                key={col.index}
                id={`csv-col-${col.index}`}
                className={styles.column}
                open={isOpen}
                onToggle={(event) => onToggleColumn(col.index, event.currentTarget.open)}
              >
                <summary className={styles.columnSummary}>
                  <span className={styles.columnSummaryMain}>
                    <span className={styles.disclosure} aria-hidden="true">
                      {isOpen ? '▾' : '▸'}
                    </span>
                    <span
                      className={`${styles.columnName} ${col.synthesizedName ? styles.columnNameSynth : ''}`}
                      title={col.name}
                    >
                      {col.name}
                    </span>
                    <span className={styles.typeBadge}>{TYPE_LABEL[col.dominantType]}</span>
                    {col.candidateKey !== 'none' && (
                      <span className={styles.keyBadge} title={col.candidateKeyReason}>
                        key?
                      </span>
                    )}
                  </span>
                  <span className={styles.columnMeta}>
                    <span>{formatPercent(col.completeness)}</span>
                    <span>{formatNumber(col.distinct)} distinct</span>
                    {colFindings.length > 0 && (
                      <span
                        className={styles.issueDot}
                        data-sev={maxSeverity(colFindings)}
                        title={`${colFindings.length} finding${colFindings.length === 1 ? '' : 's'}`}
                      >
                        <span aria-hidden="true">{SEV_GLYPH[maxSeverity(colFindings)]}</span>
                        {colFindings.length}
                      </span>
                    )}
                  </span>
                  <span className={styles.completeMini} aria-hidden="true">
                    <span
                      className={styles.completeMiniFill}
                      style={{ width: `${col.completeness * 100}%` }}
                    />
                  </span>
                </summary>
                <ColumnDetail col={col} findings={colFindings} />
              </details>
            );
          })}
        </div>
      </div>
    </section>
  );
}
