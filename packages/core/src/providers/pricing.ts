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
