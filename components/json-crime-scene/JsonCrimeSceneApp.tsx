'use client';

import Link from 'next/link';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  analyzeJson,
  LineIndex,
  SAMPLE_FILENAME,
  SAMPLE_JSON,
  searchTree,
  toJsonReport,
  toMarkdownReport,
  type JsonNode,
  type SearchHit,
} from '@/lib/json-crime-scene';
import { EmptyState } from './EmptyState';
import { FindingsPanel } from './FindingsPanel';
import { FormattedPanel } from './FormattedPanel';
import { InspectorPanel } from './InspectorPanel';
import { OverviewPanel } from './OverviewPanel';
import { ParseErrorPanel } from './ParseErrorPanel';
import { SourcePanel } from './SourcePanel';
import { TreePanel } from './TreePanel';
import { RENDER_CHILD_CAP } from './TreeNode';
import { copyToClipboard } from './clipboard';
import { downloadText } from './download';
import styles from './jcs.module.css';

/** Refuse files above this size — analyzing them could lock the tab. */
const HARD_MAX_BYTES = 25 * 1024 * 1024;
/** "Expand all" is offered only below this node count. */
const EXPAND_ALL_MAX_NODES = 3000;

interface Source {
  text: string;
  fileName: string | null;
  fileSize: number | null;
}

const EMPTY_SOURCE: Source = { text: '', fileName: null, fileSize: null };

interface TreeMaps {
  byId: Map<string, JsonNode>;
  byPointer: Map<string, JsonNode>;
  parentById: Map<string, JsonNode | null>;
  containerIds: string[];
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

function baseName(fileName: string | null): string {
  if (!fileName) return 'json-crime-scene';
  const withoutExt = fileName.replace(/\.[^.]+$/, '');
  return withoutExt.length > 0 ? withoutExt : 'json-crime-scene';
}

function buildMaps(tree: JsonNode): TreeMaps {
  const byId = new Map<string, JsonNode>();
  const byPointer = new Map<string, JsonNode>();
  const parentById = new Map<string, JsonNode | null>();
  const containerIds: string[] = [];
  const stack: { node: JsonNode; parent: JsonNode | null }[] = [{ node: tree, parent: null }];
  while (stack.length > 0) {
    const { node, parent } = stack.pop()!;
    byId.set(node.id, node);
    if (!byPointer.has(node.pointer)) byPointer.set(node.pointer, node);
    parentById.set(node.id, parent);
    if (node.kind === 'object' || node.kind === 'array') containerIds.push(node.id);
    if (node.children) for (const child of node.children) stack.push({ node: child, parent: node });
  }
  return { byId, byPointer, parentById, containerIds };
}

function initialExpanded(tree: JsonNode): Set<string> {
  const set = new Set<string>();
  const walk = (node: JsonNode, depth: number) => {
    if (node.kind !== 'object' && node.kind !== 'array') return;
    const shouldExpand = depth === 0 || (depth === 1 && node.childCount <= 25);
    if (!shouldExpand) return;
    set.add(node.id);
    for (const child of node.children ?? []) walk(child, depth + 1);
  };
  walk(tree, 0);
  return set;
}

export function JsonCrimeSceneApp() {
  const [source, setSource] = useState<Source>(EMPTY_SOURCE);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [revealCounts, setRevealCounts] = useState<Map<string, number>>(new Map());
  const [query, setQuery] = useState('');
  const [pendingInit, setPendingInit] = useState(false);
  const [initedFor, setInitedFor] = useState<JsonNode | null>(null);
  const [scrollTick, setScrollTick] = useState(0);
  const pendingScroll = useRef<string | null>(null);

  const deferredText = useDeferredValue(source.text);
  const deferredQuery = useDeferredValue(query);

  const analysis = useMemo(
    () => analyzeJson(deferredText, { fileName: source.fileName, fileSize: source.fileSize }),
    [deferredText, source.fileName, source.fileSize],
  );

  const maps = useMemo<TreeMaps | null>(
    () => (analysis.status === 'ok' ? buildMaps(analysis.tree) : null),
    [analysis],
  );

  const lineIndex = useMemo(
    () => (analysis.status === 'ok' ? new LineIndex(analysis.source) : null),
    [analysis],
  );

  const searchResult = useMemo(
    () => (analysis.status === 'ok' ? searchTree(analysis.tree, deferredQuery) : null),
    [analysis, deferredQuery],
  );

  // Initialize the tree once a freshly-loaded document produces a valid tree
  // (file / sample / first paste), never mid-edit. This is React's "adjust state
  // while rendering" reset pattern, guarded by tree identity so it runs exactly
  // once per new document. We only consume `pendingInit` on a *valid* tree — an
  // interim error/too-complex state (e.g. the deferred value still holding the
  // previous, invalid input) must not clear the flag, or a valid document loaded
  // right after an invalid one would render with its tree collapsed.
  if (pendingInit && analysis.status === 'ok' && analysis.tree !== initedFor) {
    setInitedFor(analysis.tree);
    setExpanded(initialExpanded(analysis.tree));
    setSelectedId(null);
    setRevealCounts(new Map());
    setPendingInit(false);
  }

  // Scroll a freshly-revealed node into view.
  useEffect(() => {
    const target = pendingScroll.current;
    if (!target) return;
    const el = document.getElementById(`jcs-node-${target}`);
    if (el)
      el.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    pendingScroll.current = null;
  }, [scrollTick]);

  const handleFile = useCallback((file: File) => {
    if (file.size > HARD_MAX_BYTES) {
      setError(
        `“${file.name}” is over 25 MB — too large to analyze safely in the browser. Try a smaller document.`,
      );
      return;
    }
    setError(null);
    setStatus(`Reading ${file.name}…`);
    const reader = new FileReader();
    reader.onload = () => {
      setSource({ text: String(reader.result ?? ''), fileName: file.name, fileSize: file.size });
      setPendingInit(true);
      setStatus(`Loaded ${file.name}.`);
    };
    reader.onerror = () => setError('Could not read that file.');
    reader.readAsText(file);
  }, []);

  const handlePasteChange = useCallback((text: string) => {
    setError(null);
    setSource((prev) => {
      if (prev.text === '' && text !== '') setPendingInit(true);
      return { text, fileName: null, fileSize: null };
    });
  }, []);

  const handleSample = useCallback(() => {
    setError(null);
    setSource({ text: SAMPLE_JSON, fileName: SAMPLE_FILENAME, fileSize: SAMPLE_JSON.length });
    setPendingInit(true);
    setStatus('Loaded the sample document.');
  }, []);

  const handleClear = useCallback(() => {
    setError(null);
    setSource(EMPTY_SOURCE);
    setExpanded(new Set());
    setRevealCounts(new Map());
    setSelectedId(null);
    setQuery('');
    setStatus('Cleared.');
  }, []);

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const reveal = useCallback((id: string) => {
    setRevealCounts((prev) => {
      const next = new Map(prev);
      next.set(id, (next.get(id) ?? RENDER_CHILD_CAP) + RENDER_CHILD_CAP);
      return next;
    });
  }, []);

  const selectNode = useCallback((node: JsonNode) => setSelectedId(node.id), []);

  const navigateToNode = useCallback(
    (node: JsonNode) => {
      if (!maps) return;
      setExpanded((prevExpanded) => {
        const nextExpanded = new Set(prevExpanded);
        setRevealCounts((prevReveal) => {
          const nextReveal = new Map(prevReveal);
          let child: JsonNode = node;
          let parent = maps.parentById.get(node.id) ?? null;
          while (parent) {
            nextExpanded.add(parent.id);
            const idx = parent.children?.indexOf(child) ?? -1;
            if (idx >= 0) {
              const have = nextReveal.get(parent.id) ?? RENDER_CHILD_CAP;
              if (idx + 1 > have) nextReveal.set(parent.id, idx + 1);
            }
            child = parent;
            parent = maps.parentById.get(parent.id) ?? null;
          }
          return nextReveal;
        });
        if (node.kind === 'object' || node.kind === 'array') nextExpanded.add(node.id);
        return nextExpanded;
      });
      setSelectedId(node.id);
      pendingScroll.current = node.id;
      setScrollTick((tick) => tick + 1);
    },
    [maps],
  );

  const navigateToPointer = useCallback(
    (pointer: string) => {
      const node = maps?.byPointer.get(pointer);
      if (node) navigateToNode(node);
    },
    [maps, navigateToNode],
  );

  const navigateToHit = useCallback(
    (hit: SearchHit) => {
      const node = maps?.byId.get(hit.nodeId) ?? maps?.byPointer.get(hit.pointer);
      if (node) navigateToNode(node);
    },
    [maps, navigateToNode],
  );

  const expandAll = useCallback(() => {
    if (maps) setExpanded(new Set(maps.containerIds));
  }, [maps]);

  const collapseAll = useCallback(() => {
    setExpanded(analysis.status === 'ok' ? new Set([analysis.tree.id]) : new Set());
    setRevealCounts(new Map());
  }, [analysis]);

  const copyText = useCallback(async (text: string, label: string) => {
    if (text.length === 0) {
      setStatus('Nothing to copy.');
      return;
    }
    const ok = await copyToClipboard(text);
    setStatus(
      ok
        ? `${label} copied to the clipboard.`
        : 'Copy failed — your browser blocked clipboard access.',
    );
  }, []);

  const copyReport = useCallback(async () => {
    const ok = await copyToClipboard(toMarkdownReport(analysis));
    setStatus(
      ok
        ? 'Diagnostic report copied to the clipboard.'
        : 'Copy failed — your browser blocked clipboard access.',
    );
  }, [analysis]);

  const downloadReport = useCallback(
    (ext: 'md' | 'json') => {
      const text = ext === 'md' ? toMarkdownReport(analysis) : toJsonReport(analysis);
      const ok = downloadText(
        `${baseName(source.fileName)}-report.${ext}`,
        text,
        ext === 'md' ? 'text/markdown' : 'application/json',
      );
      setStatus(ok ? `${ext.toUpperCase()} report downloaded.` : 'Download failed.');
    },
    [analysis, source.fileName],
  );

  const downloadFormatted = useCallback(
    (suffix: string, text: string, mime: string) => {
      if (text.length === 0) {
        setStatus('Nothing to download.');
        return;
      }
      const ok = downloadText(`${baseName(source.fileName)}-${suffix}`, text, mime);
      setStatus(ok ? 'Formatted JSON downloaded.' : 'Download failed.');
    },
    [source.fileName],
  );

  const hasData = source.text.trim().length > 0;
  const selectedNode = maps && selectedId ? (maps.byId.get(selectedId) ?? null) : null;

  const statusLabel =
    analysis.status === 'ok'
      ? `valid · ${analysis.profile.totalNodes.toLocaleString()} values`
      : analysis.status === 'error'
        ? 'invalid JSON'
        : analysis.status === 'too-complex'
          ? 'too complex to analyze'
          : null;

  return (
    <div className="container">
      <div className={styles.tool}>
        <header className={styles.toolHeader}>
          <p className={styles.breadcrumb}>
            <Link href="/">oddments</Link> / json-crime-scene
          </p>
          <h1 className={styles.title}>JSON Crime Scene</h1>
          <p className={styles.subtitle}>
            Paste or drop JSON and see what is actually in it: a structural profile, an explorable
            tree, exact paths, and diagnostic findings — from duplicate keys and inconsistent shapes
            to numbers that quietly lose precision.
          </p>
          <p className={styles.premise}>
            <strong>Observation before judgment.</strong> JSON Crime Scene inspects and explains one
            JSON document; it never repairs or rewrites it. Everything runs in your browser.
          </p>
        </header>

        <SourcePanel
          hasData={hasData}
          fileName={source.fileName}
          fileSize={source.fileSize}
          statusLabel={hasData ? statusLabel : null}
          statusOk={analysis.status === 'ok'}
          pasteValue={source.text}
          large={hasData && analysis.meta.large}
          error={error}
          onFile={handleFile}
          onPasteChange={handlePasteChange}
          onSample={handleSample}
          onClear={handleClear}
        />

        {analysis.status === 'ok' ? (
          <div className={styles.stack}>
            <OverviewPanel profile={analysis.profile} />
            <FindingsPanel
              findings={analysis.findings}
              onCopyReport={copyReport}
              onDownloadMarkdown={() => downloadReport('md')}
              onDownloadJson={() => downloadReport('json')}
              onNavigate={navigateToPointer}
            />
            <div className={styles.explorer}>
              <TreePanel
                tree={analysis.tree}
                selectedId={selectedId}
                expanded={expanded}
                revealCounts={revealCounts}
                query={query}
                searchResult={searchResult}
                canExpandAll={analysis.profile.totalNodes <= EXPAND_ALL_MAX_NODES}
                onQueryChange={setQuery}
                onSelectHit={navigateToHit}
                onToggle={toggle}
                onSelect={selectNode}
                onReveal={reveal}
                onExpandAll={expandAll}
                onCollapseAll={collapseAll}
              />
              <div className={styles.inspectorCol}>
                <InspectorPanel
                  node={selectedNode}
                  source={analysis.source}
                  lineIndex={lineIndex}
                  onCopy={copyText}
                />
              </div>
            </div>
            <FormattedPanel
              tree={analysis.tree}
              source={analysis.source}
              hasDuplicateKeys={analysis.hasDuplicateKeys}
              onCopy={copyText}
              onDownload={downloadFormatted}
            />
          </div>
        ) : analysis.status === 'error' ? (
          <div className={styles.stack}>
            <ParseErrorPanel error={analysis.error} />
          </div>
        ) : analysis.status === 'too-complex' ? (
          <div className={styles.stack}>
            <p className={styles.warnBanner} role="status">
              {analysis.reason === 'nesting'
                ? 'This JSON is valid but nested too deeply to analyze safely in the browser — parsing was stopped to protect the tab.'
                : 'This JSON could not be analyzed safely in the browser.'}
            </p>
          </div>
        ) : (
          <div className={styles.stack}>
            <EmptyState onSample={handleSample} />
          </div>
        )}

        <p className="visually-hidden" role="status" aria-live="polite">
          {status}
        </p>
      </div>
    </div>
  );
}
