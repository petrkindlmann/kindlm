# KindLM Cloud API — OpenAPI Specification

```yaml
openapi: "3.1.0"
info:
  title: KindLM Cloud API
  version: "1.0.0"
  description: |
    REST API for KindLM Cloud. Provides persistent storage for test runs,
    baseline management, compliance reports, and team collaboration.
  contact:
    name: KindLM
    url: https://kindlm.com
    email: support@kindlm.com
  license:
    name: AGPL-3.0
    url: https://www.gnu.org/licenses/agpl-3.0.html

servers:
  - url: https://api.kindlm.com/v1
    description: Production
  - url: http://localhost:8787/v1
    description: Local development (Wrangler)

security:
  - BearerAuth: []

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: "klm_*"
      description: |
        API token generated in dashboard or via `kindlm login`.
        Format: `klm_` prefix + 48 random hex characters.

  schemas:
    Error:
      type: object
      required: [error, message]
      properties:
        error:
          type: string
          description: Machine-readable error code
          example: "not_found"
        message:
          type: string
          description: Human-readable error message
          example: "Project not found"
        details:
          type: object
          description: Additional error context
          additionalProperties: true

    Organization:
      type: object
      required: [id, name, plan, created_at]
      properties:
        id:
          type: string
          example: "org_a1b2c3d4e5f6"
        name:
          type: string
          example: "ACME Corp"
        plan:
          type: string
          enum: [free, team, enterprise]
          example: "team"
        github_org:
          type: string
          nullable: true
          example: "acme-corp"
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time

    Project:
      type: object
      required: [id, org_id, name, created_at]
      properties:
        id:
          type: string
          example: "prj_x1y2z3"
        org_id:
          type: string
        name:
          type: string
          example: "customer-support-agent"
        description:
          type: string
          nullable: true
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time

    ProjectCreate:
      type: object
      required: [name]
      properties:
        name:
          type: string
          minLength: 1
          maxLength: 100
          pattern: "^[a-z0-9][a-z0-9-]*[a-z0-9]$"
        description:
          type: string
          maxLength: 500

    TestRun:
      type: object
      required: [id, project_id, total_tests, passed, failed, pass_rate, duration_ms, created_at]
      properties:
        id:
          type: string
          example: "run_m1n2o3"
        project_id:
          type: string
        git_commit:
          type: string
          nullable: true
          example: "a1b2c3d"
        git_branch:
          type: string
          nullable: true
          example: "main"
        ci_provider:
          type: string
          nullable: true
          enum: [github_actions, gitlab_ci, jenkins, circleci, local, null]
        total_tests:
          type: integer
          example: 24
        passed:
          type: integer
          example: 22
        failed:
          type: integer
          example: 2
        pass_rate:
          type: number
          format: float
          minimum: 0
          maximum: 1
          example: 0.917
        duration_ms:
          type: integer
          example: 12400
        compliance_report:
          type: string
          nullable: true
          description: Markdown compliance report content
        compliance_hash:
          type: string
          nullable: true
          description: SHA-256 hash of compliance report
        created_at:
          type: string
          format: date-time

    TestRunUpload:
      type: object
      required: [project_name, report]
      properties:
        project_name:
          type: string
          description: Project name (auto-created if not exists)
        report:
          type: object
          description: Full JSON report from `kindlm test --reporter json`
          required: [config_hash, suites, summary]
          properties:
            config_hash:
              type: string
            git:
              type: object
              properties:
                commit:
                  type: string
                branch:
                  type: string
                dirty:
                  type: boolean
            suites:
              type: array
              items:
                $ref: "#/components/schemas/SuiteResult"
            summary:
              $ref: "#/components/schemas/RunSummary"
            compliance:
              type: object
              nullable: true
              properties:
                markdown:
                  type: string
                hash:
                  type: string

    SuiteResult:
      type: object
      required: [name, tests]
      properties:
        name:
          type: string
        tests:
          type: array
          items:
            $ref: "#/components/schemas/TestResult"

    TestResult:
      type: object
      required: [name, pass, assertions]
      properties:
        name:
          type: string
          example: "refund-happy-path"
        pass:
          type: boolean
        assertions:
          type: array
          items:
            $ref: "#/components/schemas/AssertionResult"
        response_text:
          type: string
          nullable: true
        tool_calls:
          type: array
          items:
            type: object
            properties:
              name:
                type: string
              arguments:
                type: object
        latency_ms:
          type: integer
        cost_usd:
          type: number
          format: float

    AssertionResult:
      type: object
      required: [type, pass, message]
      properties:
        type:
          type: string
          enum: [tool_called, tool_not_called, tool_order, schema, judge, no_pii, keywords_present, keywords_absent, drift, latency, cost]
        pass:
          type: boolean
        score:
          type: number
          format: float
          nullable: true
          minimum: 0
          maximum: 1
        message:
          type: string
          example: "Tool lookup_order called with expected args"
        details:
          type: object
          nullable: true
          additionalProperties: true

    RunSummary:
      type: object
      required: [total_tests, passed, failed, pass_rate, duration_ms]
      properties:
        total_tests:
          type: integer
        passed:
          type: integer
        failed:
          type: integer
        pass_rate:
          type: number
          format: float
        duration_ms:
          type: integer
        total_cost_usd:
          type: number
          format: float
        gate_result:
          type: string
          enum: [passed, failed]

    RunComparison:
      type: object
      properties:
        current:
          $ref: "#/components/schemas/RunSummary"
        baseline:
          $ref: "#/components/schemas/RunSummary"
        deltas:
          type: object
          properties:
            pass_rate:
              type: number
              format: float
            duration_ms:
              type: integer
            cost_usd:
              type: number
              format: float
        test_diffs:
          type: array
          items:
            type: object
            properties:
              test_name:
                type: string
              status_changed:
                type: boolean
              current_pass:
                type: boolean
              baseline_pass:
                type: boolean
              drift_score:
                type: number
                format: float
                nullable: true

    Baseline:
      type: object
      required: [id, suite_name, label, created_at]
      properties:
        id:
          type: string
        suite_name:
          type: string
        label:
          type: string
          example: "v2.0-release"
        run_id:
          type: string
          description: The run this baseline was created from
        created_at:
          type: string
          format: date-time

    AuditLogEntry:
      type: object
      required: [id, actor, event, timestamp]
      properties:
        id:
          type: string
        actor:
          type: string
          description: User ID or "system"
        event:
          type: string
          enum: [run.uploaded, report.viewed, report.exported, baseline.set, member.added, member.removed, project.created, project.deleted, plan.changed]
        resource_type:
          type: string
          enum: [run, report, baseline, member, project, org]
        resource_id:
          type: string
        metadata:
          type: object
          additionalProperties: true
        timestamp:
          type: string
          format: date-time

    Pagination:
      type: object
      properties:
        total:
          type: integer
        page:
          type: integer
        per_page:
          type: integer
        has_more:
          type: boolean

  parameters:
    PageParam:
      name: page
      in: query
      schema:
        type: integer
        minimum: 1
        default: 1
    PerPageParam:
      name: per_page
      in: query
      schema:
        type: integer
        minimum: 1
        maximum: 100
        default: 20
    ProjectIdParam:
      name: project_id
      in: path
      required: true
      schema:
        type: string
    RunIdParam:
      name: run_id
      in: path
      required: true
      schema:
        type: string
    SuiteIdParam:
      name: suite_id
      in: path
      required: true
      schema:
        type: string

paths:
  # ── Auth ──
  /auth/github:
    post:
      tags: [Auth]
      summary: Exchange GitHub OAuth code for API token
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [code]
              properties:
                code:
                  type: string
                  description: GitHub OAuth authorization code
      responses:
        "200":
          description: Authentication successful
          content:
            application/json:
              schema:
                type: object
                properties:
                  token:
                    type: string
                    description: "API token (klm_* format)"
                  org:
                    $ref: "#/components/schemas/Organization"
        "401":
          description: Invalid OAuth code
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"

  /auth/verify:
    post:
      tags: [Auth]
      summary: Verify current token is valid
      responses:
        "200":
          description: Token is valid
          content:
            application/json:
              schema:
                type: object
                properties:
                  org:
                    $ref: "#/components/schemas/Organization"
                  user:
                    type: object
                    properties:
                      id:
                        type: string
                      github_login:
                        type: string
                      role:
                        type: string
                        enum: [owner, admin, member]
        "401":
          description: Invalid or expired token

  # ── Projects ──
  /projects:
    get:
      tags: [Projects]
      summary: List projects in current org
      parameters:
        - $ref: "#/components/parameters/PageParam"
        - $ref: "#/components/parameters/PerPageParam"
      responses:
        "200":
          description: Project list
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: "#/components/schemas/Project"
                  pagination:
                    $ref: "#/components/schemas/Pagination"

    post:
      tags: [Projects]
      summary: Create a project
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/ProjectCreate"
      responses:
        "201":
          description: Project created
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Project"
        "403":
          description: Project limit reached for current plan
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
        "409":
          description: Project name already exists in org

  /projects/{project_id}:
    get:
      tags: [Projects]
      summary: Get project details
      parameters:
        - $ref: "#/components/parameters/ProjectIdParam"
      responses:
        "200":
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Project"
        "404":
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"

    delete:
      tags: [Projects]
      summary: Delete a project and all associated runs
      parameters:
        - $ref: "#/components/parameters/ProjectIdParam"
      responses:
        "204":
          description: Deleted
        "404":
          description: Not found

  # ── Runs ──
  /projects/{project_id}/runs:
    get:
      tags: [Runs]
      summary: List test runs for a project
      parameters:
        - $ref: "#/components/parameters/ProjectIdParam"
        - $ref: "#/components/parameters/PageParam"
        - $ref: "#/components/parameters/PerPageParam"
        - name: branch
          in: query
          schema:
            type: string
        - name: since
          in: query
          schema:
            type: string
            format: date-time
        - name: until
          in: query
          schema:
            type: string
            format: date-time
      responses:
        "200":
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: "#/components/schemas/TestRun"
                  pagination:
                    $ref: "#/components/schemas/Pagination"

  /runs/upload:
    post:
      tags: [Runs]
      summary: Upload test results from CLI
      description: |
        Accepts the full JSON report from `kindlm test --reporter json`.
        Auto-creates the project if it doesn't exist (within plan limits).
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/TestRunUpload"
      responses:
        "201":
          description: Run uploaded
          content:
            application/json:
              schema:
                type: object
                properties:
                  run:
                    $ref: "#/components/schemas/TestRun"
                  dashboard_url:
                    type: string
                    format: uri
                    example: "https://cloud.kindlm.com/runs/run_m1n2o3"
        "403":
          description: Plan limit reached
        "413":
          description: Payload too large (max 5MB)

  /runs/{run_id}:
    get:
      tags: [Runs]
      summary: Get run details with all test results
      parameters:
        - $ref: "#/components/parameters/RunIdParam"
      responses:
        "200":
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/TestRun"
                  - type: object
                    properties:
                      results:
                        type: array
                        items:
                          $ref: "#/components/schemas/TestResult"

  /runs/{run_id}/compare:
    get:
      tags: [Runs]
      summary: Compare run against baseline or another run
      parameters:
        - $ref: "#/components/parameters/RunIdParam"
        - name: against
          in: query
          required: true
          schema:
            type: string
            description: "Run ID or 'baseline' or 'previous'"
      responses:
        "200":
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/RunComparison"

  # ── Baselines ──
  /projects/{project_id}/baselines:
    get:
      tags: [Baselines]
      summary: List baselines for a project
      parameters:
        - $ref: "#/components/parameters/ProjectIdParam"
      responses:
        "200":
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: "#/components/schemas/Baseline"

    post:
      tags: [Baselines]
      summary: Set a run as the new baseline
      parameters:
        - $ref: "#/components/parameters/ProjectIdParam"
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [run_id, label]
              properties:
                run_id:
                  type: string
                label:
                  type: string
                  maxLength: 100
                suite_name:
                  type: string
                  description: Scope baseline to a specific suite
      responses:
        "201":
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Baseline"

  # ── Audit Log (Enterprise only) ──
  /audit-log:
    get:
      tags: [Audit]
      summary: Query audit log (Enterprise plan only)
      parameters:
        - name: since
          in: query
          schema:
            type: string
            format: date-time
        - name: until
          in: query
          schema:
            type: string
            format: date-time
        - name: event
          in: query
          schema:
            type: string
        - name: actor
          in: query
          schema:
            type: string
        - $ref: "#/components/parameters/PageParam"
        - $ref: "#/components/parameters/PerPageParam"
      responses:
        "200":
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: "#/components/schemas/AuditLogEntry"
                  pagination:
                    $ref: "#/components/schemas/Pagination"
        "403":
          description: Enterprise plan required

  # ── Health ──
  /health:
    get:
      tags: [System]
      summary: Health check
      security: []
      responses:
        "200":
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    example: "ok"
                  version:
                    type: string
                    example: "1.0.0"
```

## Rate Limits

Rate limits are per-organization, enforced via Cloudflare Workers KV counter.

| Plan | Requests/hour | Burst (per 10s) |
|------|--------------|-----------------|
| Free | 100 | 10 |
| Team | 1,000 | 50 |
| Enterprise | 10,000 | 200 |

Rate limit headers returned on every response:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 847
X-RateLimit-Reset: 1708012800
```

When exceeded: `429 Too Many Requests` with `Retry-After` header.

## Error Codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `unauthorized` | 401 | Missing or invalid token |
| `forbidden` | 403 | Valid token but insufficient permissions |
| `plan_required` | 403 | Feature requires a higher plan |
| `not_found` | 404 | Resource doesn't exist |
| `conflict` | 409 | Duplicate resource (e.g., project name) |
| `rate_limited` | 429 | Too many requests |
| `payload_too_large` | 413 | Request body exceeds 5MB |
| `validation_error` | 422 | Invalid request body |
| `internal_error` | 500 | Unexpected server error |

## Idempotency

Upload endpoints accept an `Idempotency-Key` header. If the same key is sent twice within 24 hours, the second request returns the original response without creating a duplicate.

```
POST /v1/runs/upload
Idempotency-Key: ci-run-a1b2c3d4-2026-02-15
```
