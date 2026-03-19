import { readFileSync } from "node:fs";
import { defineConfig } from "tsup";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8")) as { version: string };

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    splitting: false,
    clean: true,
    sourcemap: true,
    minify: true,
    define: {
      KINDLM_VERSION: JSON.stringify(pkg.version),
    },
  },
  {
    entry: ["src/bin/kindlm.ts"],
    format: ["esm"],
    banner: { js: "#!/usr/bin/env node" },
    splitting: false,
    sourcemap: true,
    minify: true,
    define: {
      KINDLM_VERSION: JSON.stringify(pkg.version),
    },
  },
]);
