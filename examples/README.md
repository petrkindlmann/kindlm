# KindLM Examples

| File | What it tests |
|------|---------------|
| [basic-tool-call.yaml](basic-tool-call.yaml) | Agent calls the right tool with correct arguments |
| [pii-guardrail.yaml](pii-guardrail.yaml) | No PII leaked in responses + no fabricated explanations |
| [escalation-handling.yaml](escalation-handling.yaml) | Agent escalates to human when asked |
| [github-action.yml](github-action.yml) | GitHub Actions CI workflow template |

Run any example:

```bash
kindlm test -c examples/basic-tool-call.yaml
```
