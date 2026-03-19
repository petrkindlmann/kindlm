# CI: GitHub Actions in 5 Minutes

Add KindLM to your CI pipeline. Tests run on every push, block merges on failure, and produce JUnit reports your CI system already knows how to display.

---

## Basic setup

Create `.github/workflows/kindlm.yml`:

```yaml
name: Agent Tests
on:
  push:
    branches: [main]
  pull_request:

jobs:
  kindlm:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm install -g @kindlm/cli

      - run: kindlm test
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

That's it. `kindlm test` exits with code 0 if all gates pass, code 1 if anything fails. GitHub Actions treats non-zero exit as a failed job.

## Add JUnit reporting

JUnit XML is the standard format for CI test reporting. Most CI systems render it natively.

```yaml
      - run: kindlm test --reporter junit > junit.xml
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}

      - uses: dorny/test-reporter@v1
        if: always()
        with:
          name: KindLM Results
          path: junit.xml
          reporter: java-junit
```

The `if: always()` ensures the report is uploaded even when tests fail — so you can see *which* tests failed in the GitHub UI.

## Multiple reporters

To get both JUnit and JSON output without running tests twice, run once with JUnit output and save the JSON report separately:

```yaml
      - name: Run KindLM tests
        run: kindlm test --reporter junit > junit.xml
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

Or save the JSON report as an artifact:

```yaml
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: kindlm-report
          path: kindlm-report.json
```

## Compliance reports in CI

Generate EU AI Act compliance docs automatically on main branch pushes:

```yaml
      - name: Run tests with compliance
        if: github.ref == 'refs/heads/main'
        run: kindlm test --compliance --reporter json > kindlm-report.json
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}

      - uses: actions/upload-artifact@v4
        if: github.ref == 'refs/heads/main'
        with:
          name: compliance-report
          path: compliance-reports/
```

## Multiple providers

If your config tests against multiple models, set all required API keys:

```yaml
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

## Custom config path

If your config file isn't at the default `kindlm.yaml`:

```yaml
      - run: kindlm test -c tests/agent-tests.yaml
```

## Gate thresholds

Override the pass rate gate from the command line:

```yaml
      - run: kindlm test --gate 95
```

This fails the job if the overall pass rate drops below 95%, regardless of what's in the YAML config.

## Caching

KindLM has no build step, but you can cache the npm install:

```yaml
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm install -g @kindlm/cli
```

## Full example

```yaml
name: Agent Tests
on:
  push:
    branches: [main]
  pull_request:

jobs:
  kindlm:
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm install -g @kindlm/cli

      - name: Run agent tests
        run: kindlm test --reporter junit > junit.xml
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

      - name: Upload test report
        uses: dorny/test-reporter@v1
        if: always()
        with:
          name: KindLM Results
          path: junit.xml
          reporter: java-junit

      - name: Generate compliance report
        if: github.ref == 'refs/heads/main'
        run: kindlm test --compliance
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}

      - name: Upload compliance artifacts
        uses: actions/upload-artifact@v4
        if: github.ref == 'refs/heads/main'
        with:
          name: compliance-reports
          path: compliance-reports/
```

## GitLab CI

```yaml
kindlm:
  image: node:20
  script:
    - npm install -g @kindlm/cli
    - kindlm test --reporter junit > junit.xml
  artifacts:
    reports:
      junit: junit.xml
  variables:
    OPENAI_API_KEY: $OPENAI_API_KEY
```

## Troubleshooting

**Job times out:** LLM API calls take time. Set `timeout-minutes: 10` or higher. Reduce `defaults.repeat` in your config if tests are slow.

**Rate limiting:** If you run many tests concurrently, the provider may rate-limit you. Set `defaults.concurrency: 2` in your config to limit parallel requests.

**Flaky tests:** LLM outputs are non-deterministic. Use `defaults.repeat: 3` and `gates.passRateMin: 0.9` to tolerate occasional variance while catching real regressions.

**API key not found:** Make sure the secret name in GitHub matches the `apiKeyEnv` value in your config. Go to Settings > Secrets and variables > Actions to add secrets.
