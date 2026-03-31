# Deferred Items

## Pre-existing lint errors (out of scope for 02-01)

These errors exist in files not modified by this plan. Not introduced by 02-01.

### packages/cli/src/utils/caching-adapter.ts
- `cacheHits` assigned but never used (no-unused-vars)
- `cacheMisses` assigned but never used (no-unused-vars)
- Non-null assertion on line 67
- `adapter` param unused on line 75

### packages/cli/src/utils/watcher.test.ts
- Non-null assertions on lines 41, 62, 78, 106

These should be fixed in a dedicated cleanup task.
