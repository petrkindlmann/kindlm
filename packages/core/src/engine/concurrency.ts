// ============================================================
// Concurrency Helper
// ============================================================
//
// Lifted verbatim from `runner.ts` so the red team engine (and any
// future engine flavor) can reuse the same bounded-parallelism
// primitive without duplicating it or reaching into runner internals.
//
// Behavior contract (must match the previous private helper so
// `runner.ts` keeps working unchanged):
//   * Runs `tasks` with at most `limit` in flight at once.
//   * Preserves input order in the returned array, regardless of
//     finish order — consumers index results against their task
//     position.
//   * Never swallows errors — if a task throws, the enclosing
//     `Promise.all` on workers rejects and the caller sees the
//     exception. Worker loop does not try/catch.
//   * Short-circuits the worker pool size to `tasks.length` when
//     `limit` is larger, so an empty task list does no work.
//
// This module is deliberately package-internal — it is not re-exported
// from `packages/core/src/index.ts`. Downstream consumers (`@kindlm/cli`)
// should not depend on the concurrency helper directly; they drive the
// engine instead.
// ============================================================

/**
 * Run async tasks with a bounded concurrency pool.
 *
 * @param tasks - Array of thunk-style tasks. Each entry must be a
 *                function that returns a Promise when invoked; this lets
 *                the caller construct tasks eagerly without starting
 *                them, and lets the pool control when each call begins.
 * @param limit - Maximum number of tasks in flight at once.
 * @returns Resolved results in the same order as `tasks`.
 */
export async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = Array.from({ length: tasks.length }) as T[];
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const index = nextIndex++;
      const task = tasks[index];
      if (task === undefined) {
        throw new Error(`Task at index ${index} is undefined`);
      }
      results[index] = await task();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () =>
    worker(),
  );
  await Promise.all(workers);
  return results;
}
