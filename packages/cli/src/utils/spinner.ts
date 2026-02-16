export interface Spinner {
  start(text: string): void;
  succeed(text: string): void;
  fail(text: string): void;
  stop(): void;
}

export function createSpinner(): Spinner {
  throw new Error("Not implemented");
}
