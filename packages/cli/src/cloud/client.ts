const DEFAULT_CLOUD_URL = "https://api.kindlm.com";
const DEFAULT_TIMEOUT_MS = 30_000;
const RETRY_DELAY_MS = 1_000;
const MAX_RETRIES = 1;

export class CloudApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "CloudApiError";
    this.status = status;
  }
}

export interface CloudClient {
  baseUrl: string;
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  patch<T>(path: string, body: unknown): Promise<T>;
  delete(path: string): Promise<void>;
}

export function getCloudUrl(): string {
  const url = process.env["KINDLM_CLOUD_URL"] ?? DEFAULT_CLOUD_URL;
  if (url.startsWith("http://") && !isLocalhost(url)) {
    throw new Error(
      `Refusing to use insecure HTTP for Cloud API: ${url}. Use HTTPS or target localhost for development.`,
    );
  }
  return url;
}

function isLocalhost(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1";
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createCloudClient(baseUrl: string, token: string): CloudClient {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        await sleep(RETRY_DELAY_MS);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
      init.signal = controller.signal;

      try {
        const response = await fetch(url, init);

        if (!response.ok) {
          // Retry on 5xx
          if (response.status >= 500 && attempt < MAX_RETRIES) {
            lastError = new CloudApiError(response.status, `HTTP ${response.status}`);
            continue;
          }

          let message = `HTTP ${response.status}`;
          const contentType = response.headers.get("content-type") ?? "";
          if (contentType.includes("application/json")) {
            try {
              const errorBody = (await response.json()) as { error?: string };
              if (errorBody.error) {
                message = errorBody.error;
              }
            } catch {
              // ignore parse errors
            }
          }
          throw new CloudApiError(response.status, message);
        }

        if (response.status === 204) {
          return undefined as T;
        }

        // Validate response content-type is JSON before parsing
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
          throw new CloudApiError(
            response.status,
            `Expected JSON response but got content-type: ${contentType}`,
          );
        }

        return (await response.json()) as T;
      } catch (error) {
        if (error instanceof CloudApiError) throw error;
        lastError = error instanceof Error ? error : new Error(String(error));

        // Retry on network errors (not CloudApiErrors)
        if (attempt < MAX_RETRIES) continue;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    throw lastError ?? new Error("Request failed");
  }

  return {
    baseUrl,
    get: <T>(path: string) => request<T>("GET", path),
    post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
    patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
    delete: (path: string) => request<void>("DELETE", path),
  };
}
