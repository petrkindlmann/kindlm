#!/usr/bin/env node
// Thin forwarder: `kindlm` is an alias for the real CLI in @kindlm/cli.
// Locate that package's `kindlm` bin and run it with the same args, stdio,
// and exit code, so behavior is identical to installing @kindlm/cli directly.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join, sep } from "node:path";
import { existsSync } from "node:fs";

const require = createRequire(import.meta.url);

// Resolve @kindlm/cli via its package root. We avoid require.resolve(
// "@kindlm/cli/package.json") because the package's "exports" map does not
// expose ./package.json. Instead resolve the main entry (always allowed) and
// walk up to the package directory, then read its bin from package.json there.
function resolveCliBin() {
  const mainEntry = require.resolve("@kindlm/cli"); // e.g. .../@kindlm/cli/dist/index.cjs
  const marker = `${sep}@kindlm${sep}cli${sep}`;
  const idx = mainEntry.lastIndexOf(marker);
  let pkgDir;
  if (idx !== -1) {
    pkgDir = mainEntry.slice(0, idx + marker.length - 1);
  } else {
    // Fallback: assume bin lives in the same dir as the main entry (dist/).
    pkgDir = dirname(dirname(mainEntry));
  }

  const pkg = require(join(pkgDir, "package.json"));
  const binField = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.kindlm;
  if (!binField) throw new Error("@kindlm/cli does not expose a `kindlm` bin");

  const binPath = join(pkgDir, binField);
  if (!existsSync(binPath)) {
    throw new Error(`@kindlm/cli bin not found at ${binPath}`);
  }
  return binPath;
}

let cliBin;
try {
  cliBin = resolveCliBin();
} catch (err) {
  process.stderr.write(
    `kindlm: could not locate @kindlm/cli. Try reinstalling: npm install -g kindlm\n` +
      `(${err instanceof Error ? err.message : String(err)})\n`,
  );
  process.exit(1);
}

const child = spawn(process.execPath, [cliBin, ...process.argv.slice(2)], {
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
child.on("error", (err) => {
  process.stderr.write(`kindlm: failed to launch CLI: ${err.message}\n`);
  process.exit(1);
});
