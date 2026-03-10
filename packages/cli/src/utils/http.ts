import type { HttpClient, HttpRequestInit, HttpResponse } from "@kindlm/core";
import { ProviderError } from "@kindlm/core";

export function createHttpClient(): HttpClient {
  return {
    async fetch(url: string, init: HttpRequestInit): Promise<HttpResponse> {
      const controller = new AbortController();
      const timeoutId = init.timeoutMs
        ? setTimeout(() => controller.abort(), init.timeoutMs)
        : undefined;

      try {
        const response = await globalThis.fetch(url, {
          method: init.method,
          headers: init.headers,
          body: init.body,
          signal: controller.signal,
        });

        return {
          ok: response.ok,
          status: response.status,
          json: () => response.json() as Promise<unknown>,
        };
      } catch (error: unknown) {
        if (
          error instanceof DOMException && error.name === "AbortError" ||
          (error instanceof Error && error.name === "AbortError")
        ) {
          throw new ProviderError(
            "TIMEOUT",
            "Request timed out",
            408,
            true,
          );
        }
        throw error;
      } finally {
        if (timeoutId !== undefined) clearTimeout(timeoutId);
      }
    },
  };
}
