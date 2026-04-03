import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { KindlmJsonReport } from './types.js';

// Mock @actions/core
vi.mock('@actions/core', () => ({
  warning: vi.fn(),
  info: vi.fn(),
}));

// Mock @actions/github — configurable per test
const mockListComments = vi.fn();
const mockCreateComment = vi.fn();
const mockUpdateComment = vi.fn();
const mockGetOctokit = vi.fn(() => ({
  rest: {
    issues: {
      listComments: mockListComments,
      createComment: mockCreateComment,
      updateComment: mockUpdateComment,
    },
  },
}));

const mockContext = {
  eventName: 'pull_request',
  repo: { owner: 'acme', repo: 'kindlm' },
  payload: {
    pull_request: { number: 42 },
  },
};

vi.mock('@actions/github', () => ({
  getOctokit: mockGetOctokit,
  context: mockContext,
}));

// Import after mocks
const { buildCommentBody, upsertPrComment } = await import('./comment.js');

// --- Fixtures ---

function makeReport(overrides?: Partial<KindlmJsonReport>): KindlmJsonReport {
  return {
    kindlm: { version: '2.3.0', timestamp: '2026-04-03T00:00:00Z' },
    summary: { totalTests: 3, passed: 2, failed: 1, errored: 0, skipped: 0, durationMs: 1000 },
    gates: { passed: false, results: [] },
    suites: [
      {
        name: 'my-suite',
        status: 'failed',
        tests: [
          {
            name: 'test-pass',
            status: 'passed',
            assertions: [{ passed: true, label: 'output contains hello', assertionType: 'contains', score: 1 }],
          },
          {
            name: 'test-fail',
            status: 'failed',
            assertions: [
              { passed: false, label: 'tool call get_weather', assertionType: 'toolCalls', score: 0, failureMessage: 'expected tool call get_weather but got search' },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

// --- buildCommentBody ---

describe('buildCommentBody', () => {
  it('contains hidden marker', () => {
    const body = buildCommentBody(makeReport(), 66.7);
    expect(body).toContain('<!-- kindlm-test-results -->');
  });

  it('includes pass/fail table', () => {
    const body = buildCommentBody(makeReport(), 66.7);
    expect(body).toContain('| Passed | 2 |');
    expect(body).toContain('| Failed | 1 |');
    expect(body).toContain('| Total | 3 |');
  });

  it('includes pass rate', () => {
    const body = buildCommentBody(makeReport(), 66.7);
    expect(body).toContain('66.7%');
  });

  it('includes failing test names with reasons', () => {
    const body = buildCommentBody(makeReport(), 66.7);
    expect(body).toContain('test-fail');
    expect(body).toContain('expected tool call get_weather but got search');
  });

  it('includes suite name in failing test reference', () => {
    const body = buildCommentBody(makeReport(), 66.7);
    expect(body).toContain('my-suite');
  });

  it('does NOT include response_text even if present in assertions metadata', () => {
    const report = makeReport();
    // Inject a response_text-like value to verify it never leaks
    (report.suites[0].tests[1].assertions[0] as Record<string, unknown>)['response_text'] =
      'SENSITIVE_MODEL_RESPONSE';
    const body = buildCommentBody(report, 66.7);
    expect(body).not.toContain('SENSITIVE_MODEL_RESPONSE');
    expect(body).not.toContain('response_text');
  });

  it('includes cloud URL link when provided', () => {
    const body = buildCommentBody(makeReport(), 66.7, 'https://app.kindlm.com/runs/123');
    expect(body).toContain('https://app.kindlm.com/runs/123');
  });

  it('omits Report link when cloudUrl not provided', () => {
    const body = buildCommentBody(makeReport(), 66.7);
    expect(body).not.toContain('[Report]');
  });

  it('omits Failing Tests section when all tests pass', () => {
    const allPass = makeReport({
      summary: { totalTests: 2, passed: 2, failed: 0, errored: 0, skipped: 0, durationMs: 500 },
      suites: [
        {
          name: 'my-suite',
          status: 'passed',
          tests: [
            { name: 'test-pass', status: 'passed', assertions: [] },
            { name: 'test-pass-2', status: 'passed', assertions: [] },
          ],
        },
      ],
    });
    const body = buildCommentBody(allPass, 100);
    expect(body).not.toContain('Failing Tests');
  });
});

// --- upsertPrComment ---

describe('upsertPrComment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContext.eventName = 'pull_request';
    (mockContext.payload as Record<string, unknown>).pull_request = { number: 42 };
    delete (process.env as Record<string, unknown>).GITHUB_TOKEN;
  });

  it('skips when event is not pull_request', async () => {
    mockContext.eventName = 'push';
    process.env.GITHUB_TOKEN = 'tok';
    await upsertPrComment('body');
    expect(mockGetOctokit).not.toHaveBeenCalled();
  });

  it('logs warning and returns when GITHUB_TOKEN is missing', async () => {
    const { warning } = await import('@actions/core');
    await upsertPrComment('body');
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('GITHUB_TOKEN'));
    expect(mockGetOctokit).not.toHaveBeenCalled();
  });

  it('creates new comment when no existing marker found', async () => {
    process.env.GITHUB_TOKEN = 'tok';
    mockListComments.mockResolvedValue({ data: [{ id: 1, body: 'other comment' }] });
    mockCreateComment.mockResolvedValue({});
    await upsertPrComment('<!-- kindlm-test-results -->\nbody');
    expect(mockCreateComment).toHaveBeenCalledWith(
      expect.objectContaining({ issue_number: 42, body: expect.stringContaining('kindlm-test-results') }),
    );
    expect(mockUpdateComment).not.toHaveBeenCalled();
  });

  it('updates existing comment when marker found', async () => {
    process.env.GITHUB_TOKEN = 'tok';
    mockListComments.mockResolvedValue({
      data: [{ id: 99, body: '<!-- kindlm-test-results -->\nold results' }],
    });
    mockUpdateComment.mockResolvedValue({});
    await upsertPrComment('<!-- kindlm-test-results -->\nnew results');
    expect(mockUpdateComment).toHaveBeenCalledWith(
      expect.objectContaining({ comment_id: 99 }),
    );
    expect(mockCreateComment).not.toHaveBeenCalled();
  });

  it('catches 403 on fork PRs and logs non-fatal warning', async () => {
    process.env.GITHUB_TOKEN = 'tok';
    mockListComments.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }));
    const { warning } = await import('@actions/core');
    // Should not throw
    await expect(upsertPrComment('body')).resolves.toBeUndefined();
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('non-fatal'));
  });
});
