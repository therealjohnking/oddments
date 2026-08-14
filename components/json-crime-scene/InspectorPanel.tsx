import { type JsonNode, type LineIndex, formatInt, toJsPath } from '@/lib/json-crime-scene';
import styles from './jcs.module.css';

interface Props {
  node: JsonNode | null;
  source: string;
  lineIndex: LineIndex | null;
  onCopy: (text: string, label: string) => void;
}

const VALUE_DISPLAY_CAP = 2000;

function CopyField({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: (text: string, label: string) => void;
}) {
  return (
    <div className={styles.inspectorField}>
      <span className={styles.inspectorLabel}>{label}</span>
      <div className={styles.pathRow}>
        <code className={styles.pathValue}>{value}</code>
        <button type="button" className={styles.copyBtn} onClick={() => onCopy(value, label)}>
          Copy
        </button>
      </div>
    </div>
  );
}

export function InspectorPanel({ node, source, lineIndex, onCopy }: Props) {
  return (
    <section className={styles.panel} aria-label="Node inspector">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Inspector</h2>
      </div>
      <div className={styles.panelBody}>
        {!node ? (
          <p className={styles.inspectorEmpty}>
            Select a node in the tree to see its type, path, JSON Pointer, and source position.
          </p>
        ) : (
          <NodeDetail node={node} source={source} lineIndex={lineIndex} onCopy={onCopy} />
        )}
      </div>
    </section>
  );
}

function NodeDetail({ node, source, lineIndex, onCopy }: { node: JsonNode } & Omit<Props, 'node'>) {
  const valueText = source.slice(node.offset, node.offset + node.length);
  const displayText =
    valueText.length > VALUE_DISPLAY_CAP ? valueText.slice(0, VALUE_DISPLAY_CAP) + '…' : valueText;
  const pos = lineIndex?.locate(node.offset) ?? null;

  const role =
    node.key !== undefined
      ? 'object member'
      : node.index !== undefined
        ? 'array element'
        : 'root value';

  const sizeStat =
    node.kind === 'object' || node.kind === 'array'
      ? `${formatInt(node.childCount)} ${node.kind === 'object' ? 'properties' : 'elements'}`
      : node.kind === 'string'
        ? `${formatInt(node.stringLength ?? 0)} characters`
        : null;

  return (
    <>
      <div className={styles.inspectorKindRow}>
        <span className={styles.kindBadge}>{node.kind}</span>
        <span className={styles.panelHint}>{role}</span>
        {node.duplicateKey && (
          <span className={styles.dupBadge} title="This key is duplicated in its object">
            duplicate key
          </span>
        )}
      </div>

      <div className={styles.inspectorField}>
        <span className={styles.inspectorLabel}>Value</span>
        <pre className={styles.valueBox}>{displayText || '(empty)'}</pre>
        <div className={styles.pathRow}>
          <span className={styles.spacer} />
          <button
            type="button"
            className={styles.copyBtn}
            onClick={() => onCopy(valueText, 'Value')}
          >
            Copy value
          </button>
        </div>
      </div>

      <CopyField
        label="JSON Pointer"
        value={node.pointer === '' ? '(root)' : node.pointer}
        onCopy={onCopy}
      />
      <CopyField label="JavaScript path" value={toJsPath(node.path)} onCopy={onCopy} />

      <div className={styles.inspectorField}>
        <span className={styles.inspectorLabel}>Details</span>
        <div className={styles.miniStat}>
          Depth {node.depth}
          {sizeStat ? ` · ${sizeStat}` : ''}
          {pos ? ` · line ${pos.line}, column ${pos.column}` : ''}
          {` · offset ${formatInt(node.offset)}`}
        </div>
      </div>
    </>
  );
}
