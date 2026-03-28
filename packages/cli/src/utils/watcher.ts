import { watch } from "node:fs";
import type { FSWatcher } from "node:fs";

export interface WatcherOptions {
  debounceMs?: number;
}

export interface FileWatcher {
  close(): void;
}

/**
 * Watches a file for changes and calls the callback after a debounce period.
 * Uses node:fs.watch which is efficient across platforms.
 * Returns a handle that can be closed to stop watching.
 */
export function watchFile(
  filePath: string,
  onChange: () => void,
  options?: WatcherOptions,
): FileWatcher {
  const debounceMs = options?.debounceMs ?? 300;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let fsWatcher: FSWatcher | null = null;

  fsWatcher = watch(filePath, () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      onChange();
    }, debounceMs);
  });

  return {
    close() {
      if (timer) clearTimeout(timer);
      if (fsWatcher) {
        fsWatcher.close();
        fsWatcher = null;
      }
    },
  };
}
