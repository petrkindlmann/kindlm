import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { KindlmJsonReport } from './types.js';

// Mock @actions/core
vi.mock('@actions/core', () => ({
  warning: vi.fn(),
  info: vi.fn(),
}));

// Mock @actions/artifact
const mockUploadArtifact = vi.fn().mockResolvedValue({ id: 1 });
vi.mock('@actions/artifact', () => ({
  DefaultArtifactClient: vi.fn(() => ({ uploadArtifact: mockUploadArtifact })),
}));

// Mock fs and os for file writing
vi.mock('fs', () => ({ writeFileSync: vi.fn() }));
vi.mock('os', () => ({ tmpdir: vi.fn(() => '/tmp') }));
vi.mock('path', () => ({ join: vi.fn((...parts: string[]) => parts.join('/')) }));

const { generateJunitXml, uploadJunitArtifact } = await import('./junit.js');

// --- Fixtures ---

function makeReport(): KindlmJsonReport {
  return {
    kindlm: { version: '2.3.0', timestamp: '2026-04-03T00:00:00Z' },
    summary: { totalTests: 3, passed: 2, failed: 1, errored: 0, skipped: 0, durationMs: 2500 },
    gates: { passed: false, results: [] },
    suites: [
      {
        name: 'agent-suite',
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
              {
                passed: false,
                label: 'tool call get_weather expected',
                assertionType: 'toolCalls',
                score: 0,
                failureMessage: 'expected get_weather but model did not call it',
              },
              {
                passed: false,
                label: 'output length check',
                assertionType: 'maxLength',
                score: 0,
                failureMessage: 'output exceeded max length',
              },
            ],
          },
          {
            name: 'test-errored',
            status: 'errored',
            assertions: [],
          },
        ],
      },
    ],
  };
}

// --- generateJunitXml ---

describe('generateJunitXml', () => {
  it('produces XML declaration', () => {
    const xml = generateJunitXml(makeReport());
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
  });

  it('produces testsuites root element', () => {
    const xml = generateJunitXml(makeReport());
    expect(xml).toContain('<testsuites');
    expect(xml).toContain('</testsuites>');
  });

  it('sets correct counts on testsuites attributes', () => {
    const xml = generateJunitXml(makeReport());
    expect(xml).toContain('tests="3"');
    expect(xml).toContain('failures="1"');
    expect(xml).toContain('errors="0"');
  });

  it('sets correct duration (durationMs / 1000)', () => {
    const xml = generateJunitXml(makeReport());
    expect(xml).toContain('time="2.5"');
  });

  it('produces testsuite element for each suite', () => {
    const xml = generateJunitXml(makeReport());
    expect(xml).toContain('<testsuite name="agent-suite"');
    expect(xml).toContain('</testsuite>');
  });

  it('produces testcase elements', () => {
    const xml = generateJunitXml(makeReport());
    expect(xml).toContain('<testcase name="test-pass"');
    expect(xml).toContain('<testcase name="test-fail"');
  });

  it('maps failed tests to testcase with failure element', () => {
    const xml = generateJunitXml(makeReport());
    expect(xml).toContain('<failure');
    expect(xml).toContain('tool call get_weather expected');
  });

  it('maps passed tests to testcase without failure element inside', () => {
    const xml = generateJunitXml(makeReport());
    // Passed testcase block should not contain <failure
    const passBlock = xml.slice(xml.indexOf('name="test-pass"'), xml.indexOf('name="test-fail"'));
    expect(passBlock).not.toContain('<failure');
  });

  it('XML-escapes special characters in test names and messages', () => {
    const report = makeReport();
    report.suites[0].tests[1].assertions[0].failureMessage = 'expected <tool> & "agent"';
    const xml = generateJunitXml(report);
    expect(xml).not.toContain('<tool>');
    expect(xml).toContain('&lt;tool&gt;');
    expect(xml).toContain('&amp;');
  });

  it('does NOT include response_text in any field', () => {
    const report = makeReport();
    // Inject a response_text-like value to verify it never leaks
    (report.suites[0].tests[1] as Record<string, unknown>)['response_text'] = 'SENSITIVE_RESPONSE';
    const xml = generateJunitXml(report);
    expect(xml).not.toContain('SENSITIVE_RESPONSE');
    expect(xml).not.toContain('response_text');
  });

  it('includes classname attribute set to suite name', () => {
    const xml = generateJunitXml(makeReport());
    expect(xml).toContain('classname="agent-suite"');
  });
});

// --- uploadJunitArtifact ---

describe('uploadJunitArtifact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUploadArtifact.mockResolvedValue({ id: 1 });
  });

  it('calls uploadArtifact with correct artifact name and file', async () => {
    await uploadJunitArtifact('<xml/>');
    expect(mockUploadArtifact).toHaveBeenCalledWith(
      'kindlm-test-results',
      expect.arrayContaining([expect.stringContaining('kindlm-results.xml')]),
      expect.any(String),
      expect.objectContaining({ retentionDays: 30 }),
    );
  });

  it('catches upload errors and logs non-fatal warning', async () => {
    mockUploadArtifact.mockRejectedValue(new Error('network error'));
    const { warning } = await import('@actions/core');
    await expect(uploadJunitArtifact('<xml/>')).resolves.toBeUndefined();
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('Artifact upload failed'));
  });
});
