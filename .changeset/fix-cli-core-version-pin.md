---
"@kindlm/cli": patch
---

Pin `@kindlm/core` dependency to `^2.3.1` instead of `*`. The bare `*` range let npm resolve `@kindlm/core` to whatever was latest at install time, risking a CLI/core version mismatch on fresh installs, and was not bumped by Changesets. A caret range still links locally in the monorepo and is now maintained automatically on release.
