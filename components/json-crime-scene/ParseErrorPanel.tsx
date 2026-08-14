import type { JsonParseError } from '@/lib/json-crime-scene';
import styles from './jcs.module.css';

interface Props {
  error: JsonParseError;
}

export function ParseErrorPanel({ error }: Props) {
  return (
    <section className={styles.errorPanel} aria-label="Parse error" role="alert">
      <div className={styles.errorHead}>
        <h2 className={styles.errorTitle}>Not valid JSON</h2>
        <span className={styles.errorPos}>
          line {error.position.line}, column {error.position.column}
        </span>
      </div>
      <p className={styles.errorMsg}>{error.message}</p>
      <pre className={styles.errorContext} aria-label="Source context">
        {error.context}
      </pre>
      <p className={styles.errorMeta}>
        {error.additionalErrors > 0
          ? `Showing the first problem; ${error.additionalErrors} more ${error.additionalErrors === 1 ? 'issue was' : 'issues were'} found after it. `
          : ''}
        Standard JSON only — comments, trailing commas, single quotes, and unquoted keys are not
        allowed.
      </p>
    </section>
  );
}
