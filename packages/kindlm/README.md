# kindlm

Behavioral regression testing for AI agents — test what your agents **do** (tool calls, decisions, structured output), not just what they say.

This package is a convenience alias. It installs [`@kindlm/cli`](https://www.npmjs.com/package/@kindlm/cli) and exposes the `kindlm` command, so these are equivalent:

```bash
npm install -g kindlm
# is the same as
npm install -g @kindlm/cli
```

Either way you get the `kindlm` CLI:

```bash
kindlm init       # scaffold a kindlm.yaml
kindlm test       # run your behavioral tests (exit 0 = pass, 1 = fail)
```

## Documentation

- CLI reference, config schema, and guides: **[@kindlm/cli](https://www.npmjs.com/package/@kindlm/cli)** and [kindlm.com](https://kindlm.com)
- Source: [github.com/petrkindlmann/kindlm](https://github.com/petrkindlmann/kindlm)

> Looking for the **VS Code extension** (YAML validation + completions for `kindlm.yaml`)? Install it from the VS Code Marketplace, not npm.

## License

MIT
