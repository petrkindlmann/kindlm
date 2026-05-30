import type { Assertion, AssertionContext, AssertionResult } from "./interface.js";
import type { ProviderToolCall } from "../types/provider.js";

export interface TrajectoryAction {
  tool: string;
  args: Record<string, unknown>;
}

export interface TrajectoryConfig {
  reference: TrajectoryAction[];
  precision?: { minScore: number };
  recall?: { minScore: number };
  exactMatch: boolean;
  ordered: boolean;
  matchArgs: boolean;
}

/**
 * Stable, prototype-safe serialization of tool arguments. Keys are sorted
 * recursively so `{a,b}` and `{b,a}` fingerprint identically. `JSON.stringify`
 * never walks `__proto__`, and `Object.keys().sort()` enumerates own enumerable
 * properties only — so a `__proto__` key in the args cannot pollute prototypes.
 */
function canonicalizeArgs(args: Record<string, unknown>): string {
  const sortKeys = (v: unknown): unknown => {
    if (v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map(sortKeys);
    const o = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o).sort()) out[k] = sortKeys(o[k]);
    return out;
  };
  return JSON.stringify(sortKeys(args));
}

function fingerprint(
  call: ProviderToolCall | TrajectoryAction,
  matchArgs: boolean,
): string {
  const name = "name" in call ? call.name : call.tool;
  if (!matchArgs) return name;
  const args = "arguments" in call ? call.arguments : call.args;
  return `${name}::${canonicalizeArgs(args)}`;
}

/** Multiset (bag) intersection size — duplicate elements each consume one slot. O(n+m). */
function multisetIntersectionSize(
  predicted: string[],
  reference: string[],
): number {
  const refCounts = new Map<string, number>();
  for (const r of reference) refCounts.set(r, (refCounts.get(r) ?? 0) + 1);
  let matched = 0;
  for (const p of predicted) {
    const n = refCounts.get(p) ?? 0;
    if (n > 0) {
      matched++;
      refCounts.set(p, n - 1);
    }
  }
  return matched;
}

function sequencesEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function createTrajectoryAssertion(config: TrajectoryConfig): Assertion {
  return {
    type: "trajectory",
    evaluate(context: AssertionContext): Promise<AssertionResult[]> {
      const results: AssertionResult[] = [];
      const pred = context.toolCalls.map((c) => fingerprint(c, config.matchArgs));
      const ref = config.reference.map((a) => fingerprint(a, config.matchArgs));

      // Multiset intersection is order-insensitive natively, so precision/recall
      // need no sorting. Exact match compares literal sequences when ordered, or
      // sorted sequences (same multiset) when any-order.
      const predForExact = config.ordered ? pred : [...pred].sort();
      const refForExact = config.ordered ? ref : [...ref].sort();

      const baseMetadata = {
        predicted: pred,
        reference: ref,
        ordered: config.ordered,
        matchArgs: config.matchArgs,
        predictedRaw: context.toolCalls,
      };

      if (config.precision) {
        const matched = multisetIntersectionSize(pred, ref);
        const score = pred.length === 0 ? 0 : matched / pred.length;
        const passed = score >= config.precision.minScore;
        results.push({
          assertionType: "trajectory_precision",
          label: `Trajectory precision >= ${config.precision.minScore}`,
          passed,
          score,
          failureCode: passed ? undefined : "TRAJECTORY_PRECISION_LOW",
          failureMessage: passed
            ? undefined
            : `precision ${score.toFixed(3)} < ${config.precision.minScore} (pred=${pred.length}, matched=${matched})`,
          metadata: baseMetadata,
        });
      }

      if (config.recall) {
        const matched = multisetIntersectionSize(pred, ref);
        const score = ref.length === 0 ? 0 : matched / ref.length;
        const passed = score >= config.recall.minScore;
        results.push({
          assertionType: "trajectory_recall",
          label: `Trajectory recall >= ${config.recall.minScore}`,
          passed,
          score,
          failureCode: passed ? undefined : "TRAJECTORY_RECALL_LOW",
          failureMessage: passed
            ? undefined
            : `recall ${score.toFixed(3)} < ${config.recall.minScore} (ref=${ref.length}, matched=${matched})`,
          metadata: baseMetadata,
        });
      }

      if (config.exactMatch) {
        const equal = sequencesEqual(predForExact, refForExact);
        results.push({
          assertionType: "trajectory_exact_match",
          label: config.ordered
            ? "Trajectory exact match (ordered)"
            : "Trajectory exact match (any order)",
          passed: equal,
          score: equal ? 1 : 0,
          failureCode: equal ? undefined : "TRAJECTORY_EXACT_MISMATCH",
          failureMessage: equal
            ? undefined
            : `predicted=[${pred.join(", ")}] reference=[${ref.join(", ")}]`,
          metadata: baseMetadata,
        });
      }

      return Promise.resolve(results);
    },
  };
}
