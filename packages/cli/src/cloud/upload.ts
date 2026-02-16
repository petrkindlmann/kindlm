import type { CloudClient } from "./client.js";

export interface UploadOptions {
  projectId: string;
  suiteId: string;
  idempotencyKey: string;
}

export function uploadResults(
  _client: CloudClient,
  _results: unknown,
  _options: UploadOptions,
): Promise<void> {
  throw new Error("Not implemented");
}
