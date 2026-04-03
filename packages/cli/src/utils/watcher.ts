import { watch } from "chokidar";

export interface WatcherOptions {
  stabilityThreshold?: number;
}

export interface FileWatcher {
  close(): void;
}

/**
 * Watches multiple file paths for changes using chokidar.
 * Uses awaitWriteFinish to stabilize rapid saves (e.g. editor atomic writes).
 * Only change and add events trigger the callback — ignores initial scan.
 */
export function watchFiles(
  paths: string[],
  onChange: () => void,
  options?: WatcherOptions,
): FileWatcher {
  const stabilityThreshold = options?.stabilityThreshold ?? 300;

  const watcher = watch(paths, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold,
      pollInterval: 100,
    },
  });

  watcher.on("change", onChange);
  watcher.on("add", onChange);

  return {
    close() {
      void watcher.close();
    },
  };
}
