import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    splitting: false,
    clean: true,
    sourcemap: true,
  },
  {
    entry: ["src/bin/kindlm.ts"],
    format: ["esm"],
    banner: { js: "#!/usr/bin/env node" },
    splitting: false,
    sourcemap: true,
  },
]);
