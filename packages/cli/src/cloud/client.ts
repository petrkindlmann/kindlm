export interface CloudClient {
  baseUrl: string;
  token: string;
  get(path: string): Promise<unknown>;
  post(path: string, body: unknown): Promise<unknown>;
  patch(path: string, body: unknown): Promise<unknown>;
  delete(path: string): Promise<unknown>;
}

export function createCloudClient(_baseUrl: string, _token: string): CloudClient {
  throw new Error("Not implemented");
}
