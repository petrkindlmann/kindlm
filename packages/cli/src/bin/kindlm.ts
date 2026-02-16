import { createProgram } from "../index.js";

process.on("unhandledRejection", (reason) => {
  const message =
    reason instanceof Error ? reason.message : String(reason);
  process.stderr.write(`\nUnhandled error: ${message}\n`);
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  process.stderr.write(`\nFatal error: ${error.message}\n`);
  process.exit(1);
});

createProgram().parse(process.argv);
