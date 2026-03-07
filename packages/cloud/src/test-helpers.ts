import { vi } from "vitest";
import type { AuthContext, Bindings, Org, Token } from "./types.js";

// Mock env and execution context for Hono app.request()
export const testEnv: Bindings = {
  DB: {} as D1Database,
  ENVIRONMENT: "test",
  GITHUB_CLIENT_ID: "test-client-id",
  GITHUB_CLIENT_SECRET: "test-client-secret",
};

export const testExecutionCtx = {
  waitUntil: (_p: Promise<unknown>) => {},
  passThroughOnException: () => {},
  props: {},
};

// Mock org for tests
export function mockOrg(overrides: Partial<Org> = {}): Org {
  return {
    id: "org-1",
    name: "Test Org",
    plan: "team",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// Mock token for tests
export function mockToken(overrides: Partial<Token> = {}): Token {
  return {
    id: "tok-1",
    orgId: "org-1",
    userId: null,
    name: "test-token",
    tokenHash: "abc123hash",
    scope: "full",
    projectId: null,
    expiresAt: null,
    lastUsed: null,
    createdAt: "2025-01-01T00:00:00.000Z",
    revokedAt: null,
    ...overrides,
  };
}

// Mock auth context for tests
export function mockAuth(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    org: mockOrg(),
    token: mockToken(),
    user: null,
    ...overrides,
  };
}

// Minimal D1 mock that records calls and returns configured responses
export interface MockD1Statement {
  bind: ReturnType<typeof vi.fn>;
  first: ReturnType<typeof vi.fn>;
  all: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
}

export interface MockD1 {
  prepare: ReturnType<typeof vi.fn>;
  batch: ReturnType<typeof vi.fn>;
  _statements: Array<{ sql: string; params: unknown[]; stmt: MockD1Statement }>;
  _configureResponse(sqlPattern: string, response: {
    first?: unknown;
    all?: unknown[];
    changes?: number;
  }): void;
}

// Helper to make requests with test env/ctx
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function testRequest(app: any, url: string, init?: RequestInit): Promise<Response> {
  return app.request(url, init, testEnv, testExecutionCtx) as Promise<Response>;
}

export function createMockD1(): MockD1 {
  const responses = new Map<string, { first?: unknown; all?: unknown[]; changes?: number }>();
  const statements: MockD1['_statements'] = [];

  const mockD1: MockD1 = {
    _statements: statements,
    _configureResponse(sqlPattern: string, response) {
      responses.set(sqlPattern, response);
    },
    prepare: vi.fn((sql: string) => {
      const findResponse = () => {
        for (const [pattern, resp] of responses) {
          if (sql.includes(pattern)) return resp;
        }
        return undefined;
      };

      const stmt: MockD1Statement = {
        bind: vi.fn((...params: unknown[]) => {
          statements.push({ sql, params, stmt });
          return stmt;
        }),
        first: vi.fn(async () => {
          const resp = findResponse();
          return resp?.first ?? null;
        }),
        all: vi.fn(async () => {
          const resp = findResponse();
          return { results: resp?.all ?? [] };
        }),
        run: vi.fn(async () => {
          const resp = findResponse();
          return { meta: { changes: resp?.changes ?? 0 } };
        }),
      };

      return stmt;
    }),
    batch: vi.fn(async (stmts: MockD1Statement[]) => {
      return stmts.map(() => ({ meta: { changes: 1 } }));
    }),
  };

  return mockD1;
}
