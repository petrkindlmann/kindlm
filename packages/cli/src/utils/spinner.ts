import ora, { type Ora } from "ora";

export interface Spinner {
  start(text: string): void;
  succeed(text: string): void;
  fail(text: string): void;
  stop(): void;
}

export function createSpinner(): Spinner {
  let instance: Ora | undefined;

  return {
    start(text: string): void {
      instance = ora(text).start();
    },
    succeed(text: string): void {
      instance?.succeed(text);
      instance = undefined;
    },
    fail(text: string): void {
      instance?.fail(text);
      instance = undefined;
    },
    stop(): void {
      instance?.stop();
      instance = undefined;
    },
  };
}
