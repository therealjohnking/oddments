import { formatNumber, type PreviewData } from '@/lib/csv-autopsy';
import styles from './csv-autopsy.module.css';

interface Props {
  preview: PreviewData;
}

export function PreviewPanel({ preview }: Props) {
  if (preview.rows.length === 0) return null;

  return (
    <section className={styles.panel} aria-label="Data preview">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Preview</h2>
        <span className={styles.panelHint}>
          first {formatNumber(preview.shownRows)} of {formatNumber(preview.totalRows)} rows
        </span>
      </div>
      <div className={styles.previewWrap}>
        <table className={styles.previewTable}>
          <caption className="visually-hidden">
            A preview of the first {preview.shownRows} rows of the dataset. Malformed and blank rows
            are marked by their row number.
          </caption>
          <thead>
            <tr>
              <th scope="col" className={styles.rowNumCell}>
                #
              </th>
              {preview.header.map((name, index) => (
                <th scope="col" key={index}>
                  {name === '' ? `Column ${index + 1}` : name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row, i) => {
              const rowNumber = preview.rowNumbers[i]! + 1;
              const flag = preview.malformedRows.has(rowNumber)
                ? 'malformed'
                : preview.blankRows.has(rowNumber)
                  ? 'blank'
                  : undefined;
              return (
                <tr key={rowNumber} data-flag={flag}>
                  <th scope="row" className={styles.rowNumCell}>
                    {rowNumber}
                    {flag && (
                      <span className={styles.rowFlagGlyph} aria-hidden="true">
                        {flag === 'malformed' ? '⚠' : '∅'}
                      </span>
                    )}
                    {flag && (
                      <span className="visually-hidden">
                        {' '}
                        ({flag === 'malformed' ? 'malformed row' : 'blank row'})
                      </span>
                    )}
                  </th>
                  {preview.header.map((_, j) => {
                    const value = row[j] ?? '';
                    return (
                      <td key={j} title={value}>
                        {value === '' ? <span className={styles.emptyCell}>·</span> : value}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {(preview.truncatedRows || preview.truncatedColumns) && (
        <p className={styles.previewFoot}>
          Preview only —{' '}
          {preview.truncatedRows ? `${formatNumber(preview.totalRows)} rows total` : ''}
          {preview.truncatedRows && preview.truncatedColumns ? ', ' : ''}
          {preview.truncatedColumns
            ? `showing ${formatNumber(preview.shownColumns)} of ${formatNumber(preview.totalColumns)} columns`
            : ''}
          . Raw values are shown exactly as stored.
        </p>
      )}
    </section>
  );
}
