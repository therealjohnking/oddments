/**
 * The off-thread match executor.
 *
 * Running a user regex over user text is the one operation that can hang the
 * page — catastrophic backtracking is synchronous and uninterruptible on the
 * main thread. So it runs in a Web Worker built from a Blob URL: no bundler
 * worker-emission magic (which keeps the static export portable, even from
 * `file://`), and the worker body embeds `executeRegex` verbatim via
 * `toString()`, so there is exactly one, already-unit-tested implementation.
 *
 * The manager guarantees the properties that matter for a *live* tool:
 *   • latest-wins — only the most recent request's answer is delivered; a
 *     superseded request resolves as `superseded` so no promise dangles.
 *   • timeout + recovery — if a run exceeds the budget the worker is terminated
 *     and recreated, the run resolves as `timeout`, and any queued request is
 *     dispatched to the fresh worker.
 *   • stale-proofing — a message whose id is not the in-flight id is ignored, so
 *     a late reply from a terminated worker can never overwrite newer state.
 *
 * The worker factory is injectable, which is what makes all of the above
 * testable without a real Worker. When no Worker/Blob is available (old or
 * server environments) it degrades to a synchronous run — acceptable because
 * every modern target has workers, and the surrounding UI still bounds input.
 */

import { executeRegex, type RawMatch } from '@/lib/regex-workbench';
import { WORKER_TIMEOUT_MS } from '@/lib/regex-workbench';

export interface ExecRequest {
  source: string;
  /** Execution flags (the user's flags plus `d`). */
  flags: string;
  text: string;
  cap: number;
}

export type ExecOutcome =
  | { status: 'ok'; matches: RawMatch[]; truncated: boolean }
  | { status: 'timeout' }
  | { status: 'error'; error: string }
  | { status: 'superseded' };

export interface WorkerLike {
  postMessage(message: unknown): void;
  terminate(): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror?: ((event: unknown) => void) | null;
}

export type WorkerFactory = () => WorkerLike | null;

export interface Executor {
  run(request: ExecRequest): Promise<ExecOutcome>;
  dispose(): void;
}

interface WorkerMessage {
  id: number;
  result: ExecOutcome;
}

function isWorkerMessage(data: unknown): data is WorkerMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as { id?: unknown }).id === 'number' &&
    'result' in data
  );
}

/** Build the worker's source: the shared executor plus a message handler. */
export function buildWorkerSource(): string {
  return `var __run = ${executeRegex.toString()};
self.onmessage = function (e) {
  var d = e.data;
  var out;
  try {
    var r = __run({ source: d.source, flags: d.flags, text: d.text, cap: d.cap });
    out = r.ok
      ? { status: 'ok', matches: r.matches, truncated: r.truncated }
      : { status: 'error', error: r.error };
  } catch (err) {
    out = { status: 'error', error: err && err.message ? err.message : String(err) };
  }
  self.postMessage({ id: d.id, result: out });
};`;
}

/** The real factory: a classic Blob-URL worker, or null when unavailable. */
export function defaultWorkerFactory(): WorkerLike | null {
  if (
    typeof Worker === 'undefined' ||
    typeof Blob === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    return null;
  }
  const blob = new Blob([buildWorkerSource()], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  try {
    const worker = new Worker(url);
    return worker as unknown as WorkerLike;
  } catch {
    // `new Worker` can throw synchronously — e.g. a Content-Security-Policy that
    // blocks blob/worker sources in a hardened deployment. Returning null makes
    // the executor degrade to synchronous execution rather than rejecting.
    return null;
  } finally {
    // The URL only needs to be valid at construction time.
    URL.revokeObjectURL(url);
  }
}

export interface ExecutorOptions {
  createWorker?: WorkerFactory;
  timeoutMs?: number;
}

interface Inflight {
  id: number;
  resolve: (outcome: ExecOutcome) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface Queued {
  request: ExecRequest;
  resolve: (outcome: ExecOutcome) => void;
}

export function createExecutor(options: ExecutorOptions = {}): Executor {
  const factory = options.createWorker ?? defaultWorkerFactory;
  const timeoutMs = options.timeoutMs ?? WORKER_TIMEOUT_MS;

  let worker: WorkerLike | null = null;
  let counter = 0;
  let inflight: Inflight | null = null;
  let queued: Queued | null = null;
  let disposed = false;

  const ensureWorker = (): WorkerLike | null => {
    if (worker) return worker;
    let created: WorkerLike | null;
    try {
      created = factory();
    } catch {
      // A factory that throws (e.g. `new Worker` blocked by CSP) must not reject
      // the run — degrade to synchronous execution instead.
      created = null;
    }
    if (!created) return null;
    created.onmessage = (event) => handleMessage(event.data);
    created.onerror = () => handleError();
    worker = created;
    return worker;
  };

  const handleMessage = (data: unknown): void => {
    if (!isWorkerMessage(data) || !inflight || data.id !== inflight.id) return; // stale
    clearTimeout(inflight.timer);
    const { resolve } = inflight;
    inflight = null;
    resolve(data.result);
    pump();
  };

  const handleError = (): void => {
    if (!inflight) return;
    clearTimeout(inflight.timer);
    const { resolve } = inflight;
    inflight = null;
    // A worker-level error is unexpected; recycle and report it.
    recycleWorker();
    resolve({ status: 'error', error: 'The matching worker crashed unexpectedly.' });
    pump();
  };

  const onTimeout = (id: number): void => {
    if (!inflight || inflight.id !== id) return;
    const { resolve } = inflight;
    inflight = null;
    recycleWorker();
    resolve({ status: 'timeout' });
    pump();
  };

  const recycleWorker = (): void => {
    if (worker) {
      worker.onmessage = null;
      if (worker.onerror !== undefined) worker.onerror = null;
      worker.terminate();
      worker = null;
    }
  };

  const dispatch = (request: ExecRequest, resolve: (o: ExecOutcome) => void): void => {
    const active = ensureWorker();
    const id = ++counter;
    if (!active) {
      // Synchronous fallback: no worker available in this environment.
      const result = executeRegex(request);
      resolve(
        result.ok
          ? { status: 'ok', matches: result.matches, truncated: result.truncated }
          : { status: 'error', error: result.error },
      );
      return;
    }
    const timer = setTimeout(() => onTimeout(id), timeoutMs);
    inflight = { id, resolve, timer };
    active.postMessage({
      id,
      source: request.source,
      flags: request.flags,
      text: request.text,
      cap: request.cap,
    });
  };

  const pump = (): void => {
    if (disposed || inflight || !queued) return;
    const { request, resolve } = queued;
    queued = null;
    dispatch(request, resolve);
  };

  return {
    run(request: ExecRequest): Promise<ExecOutcome> {
      if (disposed) return Promise.resolve({ status: 'superseded' });
      return new Promise<ExecOutcome>((resolve) => {
        if (inflight) {
          // A run is in flight; keep only the newest queued request.
          if (queued) queued.resolve({ status: 'superseded' });
          queued = { request, resolve };
        } else {
          dispatch(request, resolve);
        }
      });
    },
    dispose(): void {
      disposed = true;
      if (inflight) {
        clearTimeout(inflight.timer);
        inflight.resolve({ status: 'superseded' });
        inflight = null;
      }
      if (queued) {
        queued.resolve({ status: 'superseded' });
        queued = null;
      }
      recycleWorker();
    },
  };
}
