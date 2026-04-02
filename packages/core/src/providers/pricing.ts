export interface ModelPricing {
  input: number; // cost per 1M input tokens
  output: number; // cost per 1M output tokens
}

export type PricingMatch =
  | {
      ok: true;
      price: ModelPricing;
      matchedModel: string;
      matchType: "exact" | "prefix";
    }
  | { ok: false };

/**
 * Consolidated pricing table for all supported providers.
 * Used by dry-run cost estimation — does not replace per-adapter private tables.
 */
export const KINDLM_PRICING: Record<string, ModelPricing> = {
  // OpenAI
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4-turbo": { input: 10.0, output: 30.0 },
  "o3-mini": { input: 1.1, output: 4.4 },
  // Anthropic
  "claude-opus-4-5-20250929": { input: 15.0, output: 75.0 },
  "claude-sonnet-4-5-20250929": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4.0 },
  // Google Gemini
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
  "gemini-2.0-flash-lite": { input: 0.075, output: 0.3 },
  "gemini-1.5-pro": { input: 1.25, output: 5.0 },
  "gemini-1.5-flash": { input: 0.075, output: 0.3 },
  "gemini-1.5-flash-8b": { input: 0.0375, output: 0.15 },
};

/**
 * Estimates the cost of a dry-run test entry using output price as a proxy.
 * Returns null when the model is not in KINDLM_PRICING or is a command entry.
 *
 * Formula: (maxTokens / 1_000_000) * output_price_per_1M * repeat
 */
export function estimateDryRunCost(
  modelId: string,
  maxTokens: number,
  repeat: number,
): number | null {
  if (modelId === "command") return null;
  const match = lookupModelPricing(modelId, KINDLM_PRICING);
  if (!match.ok) return null;
  return (maxTokens / 1_000_000) * match.price.output * repeat;
}

export function lookupModelPricing(
  model: string,
  pricingTable: Record<string, ModelPricing>,
): PricingMatch {
  // 1. Exact match
  const exactPrice = pricingTable[model];
  if (exactPrice) {
    return {
      ok: true,
      price: exactPrice,
      matchedModel: model,
      matchType: "exact",
    };
  }

  // 2. Prefix match: model starts with a pricing key followed by a separator
  const prefixMatches = Object.keys(pricingTable).filter(
    (key) => model.startsWith(`${key}-`) || model.startsWith(`${key}:`),
  );

  if (prefixMatches.length === 1) {
    const matchedKey = prefixMatches[0];
    if (!matchedKey) return { ok: false };
    const prefixPrice = pricingTable[matchedKey];
    if (prefixPrice) {
      return {
        ok: true,
        price: prefixPrice,
        matchedModel: matchedKey,
        matchType: "prefix",
      };
    }
  }

  // Multiple or zero matches: unknown pricing
  return { ok: false };
}
