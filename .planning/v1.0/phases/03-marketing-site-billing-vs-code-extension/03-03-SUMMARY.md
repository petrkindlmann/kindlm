---
phase: 3
plan: 3
title: "VS Code extension publish to marketplace"
status: partial — code tasks complete, publish requires manual action
completed_at: 2026-03-28
---

## What Was Completed

### Task 1: @vscode/vsce added to devDependencies
- `packages/vscode/package.json` devDependencies now contains `"@vscode/vsce": "^3.7.1"`

### Task 2: Icon created and wired up
- Created `packages/vscode/icon.png` — valid 128x128 PNG (dark background with K mark)
- Added `"icon": "icon.png"` field to `packages/vscode/package.json`
- Note: icon is a minimal programmatically-generated placeholder. For a production-quality icon, replace with a designed version before publishing.

### Task 3: CHANGELOG.md created
- `packages/vscode/CHANGELOG.md` exists with 0.1.0 entry covering: YAML validation, completions, hover docs, JSON Schema integration, and 4 snippets.

### Task 4: VSIX built successfully
- `packages/vscode/kindlm-0.1.0.vsix` rebuilt: **10 files, 17.24 KB** (clean)
- Fixed a critical monorepo packaging bug: vsce was including 19,000+ files (entire monorepo) due to npm workspaces. Fixed by:
  - Adding `--no-dependencies` to the vsce package command
  - Updating `.vscodeignore` to exclude `src/**`, `tsconfig.json`, `*.vsix`, `node_modules/**`
  - Updating `package` script: `npx vsce package --no-dependencies`

### Task 5: Publish to marketplace — SKIPPED (manual action required)

## Checkpoint: Manual Steps Required to Publish

Publishing the VS Code extension requires a Microsoft account and Azure DevOps PAT. These are one-time setup steps:

### Step 1: Create VS Code Marketplace Publisher

1. Go to https://marketplace.visualstudio.com/manage
2. Sign in with a Microsoft account
3. Click **Create Publisher**
4. Publisher ID: `kindlm`, Display Name: `KindLM`
5. Save

### Step 2: Create Azure DevOps Personal Access Token (PAT)

1. Go to https://dev.azure.com
2. Click user icon → **Personal Access Tokens**
3. Create new token:
   - Name: `vscode-marketplace-publish`
   - Organization: **All accessible organizations**
   - Expiration: 90 days
   - Scopes: **Marketplace → Manage**
4. Copy the PAT (shown only once)

### Step 3: Publish

```bash
cd /Users/petr/projects/kindlm/packages/vscode

# One-command publish with PAT
npx vsce publish -p <YOUR_PAT_HERE>
```

### Step 4: Verify

After 1-2 minutes for marketplace indexing:
```bash
code --install-extension kindlm.kindlm
code --list-extensions | grep kindlm
```

Also check: https://marketplace.visualstudio.com/items?itemName=kindlm.kindlm

### Optional: Improve the icon

The current `icon.png` is a minimal programmatic placeholder (dark background, white K shape). For a professional marketplace listing, replace it with a designed icon before publishing:
- 128x128 or 256x256 PNG
- Use the KindLM brand colors and logo
- Save as `packages/vscode/icon.png`
- Rebuild VSIX: `npm run build && npm run package`

## Files Modified

- `packages/vscode/package.json` — added @vscode/vsce, icon field, updated package script
- `packages/vscode/.vscodeignore` — fixed monorepo exclusions
- `packages/vscode/CHANGELOG.md` — created with 0.1.0 entry (new file)
- `packages/vscode/icon.png` — minimal 128x128 PNG icon (new file)
- `packages/vscode/kindlm-0.1.0.vsix` — rebuilt clean VSIX (new file, 17.24 KB)

## Commit

`28391bb` — Prepare VS Code extension for marketplace: add vsce, icon, changelog, clean VSIX
