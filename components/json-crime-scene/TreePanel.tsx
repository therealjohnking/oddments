import type { JsonNode, SearchHit, SearchResult } from '@/lib/json-crime-scene';
import { TreeNode } from './TreeNode';
import styles from './jcs.module.css';

interface Props {
  tree: JsonNode;
  selectedId: string | null;
  expanded: Set<string>;
  revealCounts: Map<string, number>;
  query: string;
  searchResult: SearchResult | null;
  canExpandAll: boolean;
  onQueryChange: (query: string) => void;
  onSelectHit: (hit: SearchHit) => void;
  onToggle: (id: string) => void;
  onSelect: (node: JsonNode) => void;
  onReveal: (id: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

function ptrLabel(pointer: string): string {
  return pointer === '' ? '(root)' : pointer;
}

export function TreePanel({
  tree,
  selectedId,
  expanded,
  revealCounts,
  query,
  searchResult,
  canExpandAll,
  onQueryChange,
  onSelectHit,
  onToggle,
  onSelect,
  onReveal,
  onExpandAll,
  onCollapseAll,
}: Props) {
  return (
    <section className={styles.panel} aria-label="JSON tree">
      <div className={styles.treeToolbar}>
        <input
          type="search"
          className={styles.searchInput}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search keys and values…"
          aria-label="Search keys and values"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
        {searchResult && searchResult.query.length > 0 && (
          <span className={styles.searchMeta} role="status">
            {searchResult.total === 0
              ? 'no matches'
              : `${searchResult.hits.length}${searchResult.capped ? ` of ${searchResult.total}` : ''} match${searchResult.total === 1 ? '' : 'es'}`}
          </span>
        )}
      </div>

      {searchResult && searchResult.query.length > 0 && searchResult.hits.length > 0 && (
        <ul className={styles.searchHits} aria-label="Search results">
          {searchResult.hits.map((hit, index) => (
            <li key={`${hit.nodeId}-${hit.where}-${index}`}>
              <button type="button" className={styles.searchHit} onClick={() => onSelectHit(hit)}>
                <span className={styles.searchHitWhere}>{hit.where}</span>
                <span className={styles.searchHitPtr}>{ptrLabel(hit.pointer)}</span>
                <span className={styles.searchHitPreview}>{hit.preview}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.treeWrap}>
        <ul className={styles.treeList}>
          <TreeNode
            node={tree}
            selectedId={selectedId}
            expanded={expanded}
            revealCounts={revealCounts}
            onToggle={onToggle}
            onSelect={onSelect}
            onReveal={onReveal}
          />
        </ul>
      </div>

      <div className={styles.treeExpandBar}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnGhost}`}
          onClick={onExpandAll}
          disabled={!canExpandAll}
          title={canExpandAll ? undefined : 'This document is large — expand branches individually'}
        >
          Expand all
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnGhost}`}
          onClick={onCollapseAll}
        >
          Collapse all
        </button>
      </div>
    </section>
  );
}
