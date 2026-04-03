import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { KindlmJsonReport } from './types.js';

// Mock @actions/core
const mockSetOutput = vi.fn();
const mockSetFailed = vi.fn();
const mockGetInput = vi.fn();
const mockInfo = vi.fn();
const mockWarning = vi.fn();

vi.mock('@actions/core', () => ({
  getInput: mockGetInput,
  setOutput: mockSetOutput,
  setFailed: mockSetFailed,
  info: mockInfo,
  warning: mockWarning,
}));

// Mock @actions/exec
const mockExec = vi.fn().mockResolvedValue(0);
const mockGetExecOutput = vi.fn();

vi.mock('@actions/exec', () => ({
  exec: mockExec,
  getExecOutput: mockGetExecOutput,
}));

// Mock comment and junit modules to isolate run() unit tests
vi.mock('./comment.js', () => ({
  buildCommentBody: vi.fn(() => '<!-- kindlm-test-results -->'),
  upsertPrComment: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./junit.js', () => ({
  generateJunitXml: vi.fn(() => '<xml/>'),
  uploadJunitArtifact: vi.fn().mockResolvedValue(undefined),
}));

// Mock @actions/github context
vi.mock('@actions/github', () => ({
  context: {
    eventName: 'push',
    repo: { owner: 'acme', repo: 'kindlm' },
    payload: {},
  },
  getOctokit: vi.fn(),
}));

const { parseJsonReport, run } = await import('./run.js');

// --- Fixtures ---

function makeReport(): KindlmJsonReport {
  return {
    kindlm: { version: '2.3.0', timestamp: '2026-04-03T00:00:00Z' },
    summary: { totalTests: 5, passed: 5, failed: 0, errored: 0, skipped: 0, durationMs: 1200 },
    gates: { passed: true, results: [] },
    suites: [],
  };
}

// --- parseJsonReport ---

describe('parseJsonReport', () => {
  it('parses clean JSON correctly', () => {
    const report = makeReport();
    const result = parseJsonReport(JSON.stringify(report));
    expect(result.summary.totalTests).toBe(5);
    expect(result.summary.passed).toBe(5);
  });

  it('handles JSON mixed with non-JSON prefix (spinner output)', () => {
    const report = makeReport();
    const stdout = '\r⠸ Running tests...\n' + JSON.stringify(report);
    const result = parseJsonReport(stdout);
    expect(result.summary.totalTests).toBe(5);
  });

  it('throws on completely invalid input', () => {
    expect(() => parseJsonReport('not json at all')).toThrow();
  });
});

// --- run() ---

describe('run()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        config: 'kindlm.yaml',
        version: 'latest',
        args: '',
        'cloud-token': '',
        comment: 'true',
      };
      return inputs[name] ?? '';
    });
    mockGetExecOutput.mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify(makeReport()),
      stderr: '',
    });
  });

  it('sets all 5 step outputs on success', async () => {
    await run();
    const outputNames = mockSetOutput.mock.calls.map((c: [string, string]) => c[0]);
    expect(outputNames).toContain('pass-rate');
    expect(outputNames).toContain('total');
    expect(outputNames).toContain('passed');
    expect(outputNames).toContain('failed');
    expect(outputNames).toContain('exit-code');
  });

  it('does NOT call setFailed when exitCode is 0', async () => {
    await run();
    expect(mockSetFailed).not.toHaveBeenCalled();
  });

  it('calls setFailed when exitCode is non-zero', async () => {
    const failReport = makeReport();
    failReport.summary.failed = 2;
    failReport.summary.passed = 3;
    mockGetExecOutput.mockResolvedValue({
      exitCode: 1,
      stdout: JSON.stringify(failReport),
      stderr: '',
    });
    await run();
    expect(mockSetFailed).toHaveBeenCalledWith(expect.stringContaining('failed'));
  });

  it('wraps cloud upload in try/catch (non-fatal)', async () => {
    mockGetInput.mockImplementation((name: string) => {
      if (name === 'cloud-token') return 'tok-123';
      const defaults: Record<string, string> = { config: 'kindlm.yaml', version: 'latest', args: '', comment: 'false' };
      return defaults[name] ?? '';
    });
    // First exec call (npm install) succeeds; second (kindlm upload) throws
    mockExec
      .mockResolvedValueOnce(0)   // npm install
      .mockRejectedValueOnce(new Error('upload network error'));  // kindlm upload
    await run();
    // Should not propagate the error — setFailed not called due to upload failure
    // (setFailed may be called for test failures but not for upload error)
    const failCalls = mockSetFailed.mock.calls.filter((c: [string]) =>
      c[0].includes('upload') || c[0].includes('network'),
    );
    expect(failCalls).toHaveLength(0);
  });
});
