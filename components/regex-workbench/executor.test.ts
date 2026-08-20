import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildWorkerSource, createExecutor, type ExecOutcome, type WorkerLike } from './executor';

class FakeWorker implements WorkerLike {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  posted: Array<{ id: number; source: string; flags: string; text: string; cap: number }> = [];
  terminated = false;

  postMessage(message: unknown): void {
    this.posted.push(message as (typeof this.posted)[number]);
  }
  terminate(): void {
    this.terminated = true;
  }
  deliver(data: unknown): void {
    this.onmessage?.({ data });
  }
  lastId(): number {
    return this.posted[this.posted.length - 1]!.id;
  }
}

const req = (source: string, flags: string, text: string, cap = 1000) => ({
  source,
  flags,
  text,
  cap,
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createExecutor — happy path', () => {
  it('resolves with the worker result', async () => {
    const worker = new FakeWorker();
    const executor = createExecutor({ createWorker: () => worker });
    const promise = executor.run(req('a', 'g', 'aa'));
    expect(worker.posted).toHaveLength(1);
    worker.deliver({
      id: worker.lastId(),
      result: { status: 'ok', matches: [], truncated: false },
    });
    await expect(promise).resolves.toMatchObject({ status: 'ok' });
    executor.dispose();
  });
});

describe('createExecutor — stale and malformed messages', () => {
  it('ignores a message whose id is not the in-flight id', async () => {
    const worker = new FakeWorker();
    const executor = createExecutor({ createWorker: () => worker });
    const promise = executor.run(req('a', 'g', 'aa'));
    const id = worker.lastId();
    // A stale reply from an older run must not resolve the current one.
    worker.deliver({
      id: id - 1,
      result: { status: 'ok', matches: [{ index: 9 }], truncated: false },
    });
    worker.deliver({ id, result: { status: 'ok', matches: [], truncated: false } });
    const outcome = (await promise) as Extract<ExecOutcome, { status: 'ok' }>;
    expect(outcome.matches).toEqual([]);
    executor.dispose();
  });

  it('ignores malformed messages without crashing', async () => {
    const worker = new FakeWorker();
    const executor = createExecutor({ createWorker: () => worker });
    const promise = executor.run(req('a', 'g', 'aa'));
    worker.deliver(null);
    worker.deliver({ nope: true });
    worker.deliver(42);
    worker.deliver({
      id: worker.lastId(),
      result: { status: 'ok', matches: [], truncated: false },
    });
    await expect(promise).resolves.toMatchObject({ status: 'ok' });
    executor.dispose();
  });
});

describe('createExecutor — timeout and recovery', () => {
  it('terminates the worker on timeout and recreates it for the next run', async () => {
    vi.useFakeTimers();
    const created: FakeWorker[] = [];
    const executor = createExecutor({
      timeoutMs: 100,
      createWorker: () => {
        const w = new FakeWorker();
        created.push(w);
        return w;
      },
    });

    // First run hangs (no reply) → should time out and terminate the worker.
    const first = executor.run(req('(a+)+$', '', 'aaaaaaaaaaaaaaa!'));
    vi.advanceTimersByTime(100);
    await expect(first).resolves.toEqual({ status: 'timeout' });
    expect(created).toHaveLength(1);
    expect(created[0]!.terminated).toBe(true);

    // Recovery: a new run gets a fresh worker and succeeds.
    const second = executor.run(req('a', 'g', 'aa'));
    expect(created).toHaveLength(2);
    created[1]!.deliver({
      id: created[1]!.lastId(),
      result: { status: 'ok', matches: [], truncated: false },
    });
    await expect(second).resolves.toMatchObject({ status: 'ok' });
    executor.dispose();
  });
});

describe('createExecutor — latest-wins queueing', () => {
  it('supersedes an older queued request', async () => {
    const worker = new FakeWorker();
    const executor = createExecutor({ createWorker: () => worker });
    const first = executor.run(req('a', 'g', 'first')); // in flight
    const second = executor.run(req('b', 'g', 'second')); // queued
    const third = executor.run(req('c', 'g', 'third')); // supersedes second

    await expect(second).resolves.toEqual({ status: 'superseded' });

    // Complete the in-flight run; the queue then pumps the third request.
    worker.deliver({
      id: worker.lastId(),
      result: { status: 'ok', matches: [], truncated: false },
    });
    await expect(first).resolves.toMatchObject({ status: 'ok' });
    expect(worker.posted[worker.posted.length - 1]!.text).toBe('third');
    worker.deliver({
      id: worker.lastId(),
      result: { status: 'ok', matches: [], truncated: false },
    });
    await expect(third).resolves.toMatchObject({ status: 'ok' });
    executor.dispose();
  });
});

describe('createExecutor — synchronous fallback', () => {
  it('runs inline when no worker is available', async () => {
    const executor = createExecutor({ createWorker: () => null });
    const outcome = (await executor.run(req('a', 'g', 'aaa'))) as Extract<
      ExecOutcome,
      { status: 'ok' }
    >;
    expect(outcome.status).toBe('ok');
    expect(outcome.matches.map((m) => m.index)).toEqual([0, 1, 2]);
    executor.dispose();
  });

  it('falls back to synchronous execution when the factory throws (e.g. CSP)', async () => {
    const executor = createExecutor({
      createWorker: () => {
        throw new Error('worker construction blocked');
      },
    });
    // Must resolve to a result, not reject.
    const outcome = (await executor.run(req('a', 'g', 'aa'))) as Extract<
      ExecOutcome,
      { status: 'ok' }
    >;
    expect(outcome.status).toBe('ok');
    expect(outcome.matches.map((m) => m.index)).toEqual([0, 1]);
    executor.dispose();
  });
});

describe('buildWorkerSource', () => {
  it('embeds a runnable executor that responds to messages', () => {
    const source = buildWorkerSource();
    const fakeSelf: {
      onmessage: ((e: { data: unknown }) => void) | null;
      postMessage: (m: unknown) => void;
    } = {
      onmessage: null,
      postMessage: () => {},
    };
    const posted: unknown[] = [];
    fakeSelf.postMessage = (m: unknown) => posted.push(m);
    // Reconstruct the worker body with an injected `self`.
    new Function('self', source)(fakeSelf);
    fakeSelf.onmessage?.({ data: { id: 7, source: '\\d+', flags: 'g', text: 'a1b22', cap: 100 } });
    expect(posted).toHaveLength(1);
    const message = posted[0] as {
      id: number;
      result: { status: string; matches: Array<{ value: string }> };
    };
    expect(message.id).toBe(7);
    expect(message.result.status).toBe('ok');
    expect(message.result.matches.map((m) => m.value)).toEqual(['1', '22']);
  });
});
