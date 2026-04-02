/* eslint-disable no-console */
import type { Command } from "commander";
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";

export function registerCacheCommand(program: Command): void {
  const cache = program
    .command("cache")
    .description("Manage response cache");

  cache
    .command("clear")
    .description("Delete all cached responses")
    .action(() => {
      const cacheDir = join(process.cwd(), ".kindlm", "cache");

      if (!existsSync(cacheDir)) {
        console.log(chalk.dim("Cache is empty (no cache directory found)."));
        return;
      }

      let count = 0;
      let totalBytes = 0;

      const subdirs = readdirSync(cacheDir);
      for (const subdir of subdirs) {
        const subdirPath = join(cacheDir, subdir);
        const files = readdirSync(subdirPath);
        for (const file of files) {
          const filePath = join(subdirPath, file);
          totalBytes += statSync(filePath).size;
          rmSync(filePath);
          count++;
        }
        // Remove empty subdir — non-fatal if it fails
        try {
          rmSync(subdirPath, { recursive: true });
        } catch {
          // ignore
        }
      }

      const kbFreed = (totalBytes / 1024).toFixed(1);
      console.log(
        chalk.green(
          `Cleared ${count} cached response${count !== 1 ? "s" : ""} (${kbFreed} KB freed).`,
        ),
      );
    });
}
