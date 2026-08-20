'use client';

import type { ExplainNode, Explanation } from '@/lib/regex-workbench';
import styles from './regex-workbench.module.css';

interface Props {
  explanation: Explanation;
  patternEmpty: boolean;
}

function TreeItem({ node }: { node: ExplainNode }) {
  return (
    <li>
      <div className={styles.treeRow}>
        {node.source !== '' && <code className={styles.treeSource}>{node.source}</code>}
        <span className={styles.treeTitle}>{node.title}</span>
        {node.detail && <span className={styles.treeDetail}>— {node.detail}</span>}
      </div>
      {node.children && node.children.length > 0 && (
        <ul className={styles.treeChildren}>
          {node.children.map((child) => (
            <TreeItem key={child.id} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function ExplanationPanel({ explanation, patternEmpty }: Props) {
  return (
    <section className={styles.panel} aria-label="Pattern explanation">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>
          What the pattern means <span className={styles.panelHint}>· from the parse tree</span>
        </h2>
      </div>
      <div className={styles.panelBody}>
        {patternEmpty ? (
          <p className={styles.unavailable}>Enter a pattern to see a structural breakdown.</p>
        ) : explanation.status === 'unavailable' ? (
          <p className={styles.unavailable}>{explanation.message}</p>
        ) : (
          <ul className={styles.tree}>
            {explanation.nodes.map((node) => (
              <TreeItem key={node.id} node={node} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
