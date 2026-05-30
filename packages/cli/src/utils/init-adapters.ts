/* eslint-disable no-console */
import chalk from "chalk";
import { createProvider } from "@kindlm/core";
import type { ProviderAdapter, KindLMConfig } from "@kindlm/core";
import { createHttpClient } from "./http.js";
import { createCachingAdapter } from "./caching-adapter.js";

export interface InitProviderAdaptersOptions {
  /** When true, do not wrap adapters with the caching layer. */
  noCache?: boolean;
}

/**
 * Resolve provider API keys from the environment and construct a
 * `ProviderAdapter` for every provider configured in `config.providers`.
 *
 * Behavior is identical to the inlined loop that used to live in
 * `runTests` — including the `process.exit(1)` calls for missing
 * env vars or provider construction failures. The helper is shared by
 * `runTests` and `kindlm redteam generate` so both entry points get
 * the same error model and env resolution semantics.
 *
 * The returned map is keyed by provider id (`openai`, `anthropic`,
 * `mcp`, `http`, …) — the same keys `ModelConfig.provider` uses.
 */
export async function initProviderAdapters(
  config: KindLMConfig,
  options: InitProviderAdaptersOptions = {},
): Promise<Map<string, ProviderAdapter>> {
  const httpClient = createHttpClient();
  const adapters = new Map<string, ProviderAdapter>();

  const providers = config.providers as Record<
    string,
    Record<string, unknown> | undefined
  >;

  for (const [name, providerConfig] of Object.entries(providers)) {
    if (!providerConfig) continue;

    const apiKeyEnv = providerConfig["apiKeyEnv"] as string | undefined;
    let apiKey = "";
    if (apiKeyEnv) {
      const key = process.env[apiKeyEnv];
      if (!key) {
        console.error(chalk.red(`Missing environment variable: ${apiKeyEnv}`));
        process.exit(1);
      }
      apiKey = key.trim();
    } else if (name !== "ollama" && name !== "http" && name !== "mcp") {
      console.error(
        chalk.red(`Provider "${name}" requires apiKeyEnv to be configured`),
      );
      process.exit(1);
    }

    let adapter: ProviderAdapter;
    try {
      if (name === "http") {
        // HTTP provider gets its config object directly + env lookup
        const httpProviderConfig = providerConfig as {
          url: string;
          method?: string;
          headers?: Record<string, string>;
          body?: string;
          responsePath?: string;
          toolCallsPath?: string;
          usagePaths?: {
            inputTokens?: string;
            outputTokens?: string;
            totalTokens?: string;
          };
          modelIdPath?: string;
        };
        adapter = createProvider(name, httpClient, {
          httpConfig: httpProviderConfig,
          envLookup: (envName: string) => process.env[envName],
        });
      } else if (name === "mcp") {
        const mcpProviderConfig = providerConfig as {
          serverUrl: string;
          toolName: string;
          headers?: Record<string, string>;
        };
        // Resolve env: headers before passing to core (core is I/O-free)
        const resolvedHeaders: Record<string, string> = {};
        for (const [k, v] of Object.entries(mcpProviderConfig.headers ?? {})) {
          if (v.startsWith("env:")) {
            const envVal = process.env[v.slice(4)];
            if (!envVal) {
              console.error(
                chalk.red(
                  `Missing environment variable for MCP header "${k}": ${v.slice(4)}`,
                ),
              );
              process.exit(1);
            }
            resolvedHeaders[k] = envVal;
          } else {
            resolvedHeaders[k] = v;
          }
        }
        adapter = createProvider(name, httpClient, {
          mcpConfig: {
            serverUrl: mcpProviderConfig.serverUrl,
            toolName: mcpProviderConfig.toolName,
            headers: resolvedHeaders,
          },
        });
      } else {
        adapter = createProvider(name, httpClient);
      }
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : String(cause);
      console.error(
        chalk.red(`Failed to create provider "${name}": ${msg}`),
      );
      process.exit(1);
    }

    await adapter.initialize({
      apiKey,
      baseUrl: providerConfig["baseUrl"] as string | undefined,
      organization: providerConfig["organization"] as string | undefined,
      timeoutMs: config.defaults.timeoutMs,
      maxRetries: 2,
    });

    // Wrap with caching unless --no-cache
    if (!options.noCache) {
      adapters.set(name, createCachingAdapter(adapter));
    } else {
      adapters.set(name, adapter);
    }
  }

  return adapters;
}
