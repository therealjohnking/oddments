import type { JsonNode } from '@/lib/json-crime-scene';
import styles from './jcs.module.css';

/** Initial number of children rendered for a container before "show more". */
export const RENDER_CHILD_CAP = 100;

interface Props {
  node: JsonNode;
  selectedId: string | null;
  expanded: Set<string>;
  revealCounts: Map<string, number>;
  onToggle: (id: string) => void;
  onSelect: (node: JsonNode) => void;
  onReveal: (id: string) => void;
}

function keyLabel(node: JsonNode) {
  if (node.key !== undefined) {
    const key = node.key.length > 60 ? node.key.slice(0, 60) + '…' : node.key;
    return (
      <>
        <span className={styles.nodeKey}>&quot;{key}&quot;</span>
        <span className={styles.nodePunct}>:</span>
      </>
    );
  }
  if (node.index !== undefined) {
    return <span className={styles.nodeIndex}>{node.index}</span>;
  }
  return null;
}

function ScalarValue({ node }: { node: JsonNode }) {
  switch (node.kind) {
    case 'string':
      return (
        <span className={styles.valString}>
          &quot;{node.preview}
          {node.truncatedPreview ? '…' : ''}&quot;
        </span>
      );
    case 'number':
      return <span className={styles.valNumber}>{node.preview}</span>;
    case 'boolean':
      return <span className={styles.valBoolean}>{node.preview}</span>;
    default:
      return <span className={styles.valNull}>null</span>;
  }
}

export function TreeNode({
  node,
  selectedId,
  expanded,
  revealCounts,
  onToggle,
  onSelect,
  onReveal,
}: Props) {
  const isContainer = node.kind === 'object' || node.kind === 'array';
  const isEmpty = isContainer && node.childCount === 0;
  const isOpen = expanded.has(node.id);
  const selected = selectedId === node.id;

  const rowClass = `${styles.nodeRow} ${selected ? styles.nodeRowSelected : ''}`;

  const containerGlyphs = node.kind === 'object' ? ['{', '}'] : ['[', ']'];
  const countLabel =
    node.kind === 'object'
      ? `${node.childCount} ${node.childCount === 1 ? 'key' : 'keys'}`
      : `${node.childCount} ${node.childCount === 1 ? 'item' : 'items'}`;

  if (!isContainer || isEmpty) {
    return (
      <li>
        <button
          type="button"
          id={`jcs-node-${node.id}`}
          className={rowClass}
          data-selected={selected || undefined}
          aria-current={selected ? 'true' : undefined}
          onClick={() => onSelect(node)}
        >
          <span className={styles.twistyLeaf} aria-hidden="true" />
          {keyLabel(node)}
          {isEmpty ? (
            <span className={styles.nodePunct}>
              {containerGlyphs[0]}
              {containerGlyphs[1]}
            </span>
          ) : (
            <ScalarValue node={node} />
          )}
          {node.duplicateKey && (
            <span className={styles.dupBadge} title="This key is duplicated in its object">
              dup
            </span>
          )}
        </button>
      </li>
    );
  }

  const reveal = revealCounts.get(node.id) ?? RENDER_CHILD_CAP;
  const children = node.children ?? [];
  const shown = isOpen ? children.slice(0, reveal) : [];
  const hiddenCount = children.length - shown.length;

  return (
    <li>
      <button
        type="button"
        id={`jcs-node-${node.id}`}
        className={rowClass}
        data-selected={selected || undefined}
        aria-expanded={isOpen}
        onClick={() => {
          onSelect(node);
          onToggle(node.id);
        }}
      >
        <span className={styles.twisty} aria-hidden="true">
          {isOpen ? '▾' : '▸'}
        </span>
        {keyLabel(node)}
        <span className={styles.nodePunct}>
          {isOpen ? containerGlyphs[0] : `${containerGlyphs[0]} … ${containerGlyphs[1]}`}
        </span>
        <span className={styles.containerSummary}>{countLabel}</span>
        {node.duplicateKey && (
          <span className={styles.dupBadge} title="This key is duplicated in its object">
            dup
          </span>
        )}
      </button>

      {isOpen && (
        <ul className={styles.childList}>
          {shown.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              expanded={expanded}
              revealCounts={revealCounts}
              onToggle={onToggle}
              onSelect={onSelect}
              onReveal={onReveal}
            />
          ))}
          {hiddenCount > 0 && (
            <li>
              <button type="button" className={styles.showMore} onClick={() => onReveal(node.id)}>
                Show {Math.min(hiddenCount, RENDER_CHILD_CAP).toLocaleString()} more of{' '}
                {hiddenCount.toLocaleString()} hidden…
              </button>
            </li>
          )}
        </ul>
      )}
    </li>
  );
}
