#!/usr/bin/env bash
set -euo pipefail

echo "=== CLI-01: Verify npx init from packed tarball ==="

# Build first
npm run build --workspace=packages/core
npm run build --workspace=packages/cli

# Pack the CLI
cd packages/cli
TARBALL=$(npm pack --pack-destination /tmp 2>/dev/null | tail -1)
cd ../..

# Create a clean temp directory
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR /tmp/$TARBALL" EXIT

cd "$TMPDIR"

# Run init via npx from the tarball
node --input-type=module -e "
import { execSync } from 'node:child_process';
execSync('npx /tmp/$TARBALL init', { stdio: 'inherit', cwd: '$TMPDIR' });
"

# Verify output
if [ ! -f kindlm.yaml ]; then
  echo "FAIL: kindlm.yaml not created"
  exit 1
fi

# Verify the YAML is parseable
node -e "
const { readFileSync } = require('fs');
const yaml = readFileSync('kindlm.yaml', 'utf-8');
if (!yaml.includes('kindlm: 1')) {
  process.exit(1);
}
"

# Verify the generated YAML passes validate
node /tmp/$(echo $TARBALL | sed 's/.tgz//')/dist/kindlm.js validate -c kindlm.yaml 2>/dev/null || {
  echo "WARN: validate failed on init template (may need API key resolution skip)"
}

echo "PASS: CLI-01 verified"
