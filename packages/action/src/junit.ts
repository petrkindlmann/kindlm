import * as core from '@actions/core';
import { DefaultArtifactClient } from '@actions/artifact';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { KindlmJsonReport } from './types.js';

/** XML-escape a string value for safe embedding in XML attributes and text. */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate JUnit XML from a KindLM JSON report.
 * D-19: Only includes test.name, suite.name, assertion.label, assertion.failureMessage.
 * Never includes model response text.
 */
export function generateJunitXml(report: KindlmJsonReport): string {
  const { totalTests, failed, errored, durationMs } = report.summary;
  const timeSeconds = (durationMs / 1000).toString();

  const suiteBlocks = report.suites.map((suite) => {
    const suiteFailures = suite.tests.filter(
      (t) => t.status === 'failed' || t.status === 'errored',
    ).length;

    const testcases = suite.tests.map((test) => {
      const classname = escapeXml(suite.name);
      const testname = escapeXml(test.name);

      if (test.status === 'passed') {
        return `      <testcase name="${testname}" classname="${classname}" />`;
      }

      // Collect only assertion label and failureMessage — never response_text
      const failedAssertions = test.assertions.filter((a) => !a.passed);
      const firstFailed = failedAssertions[0];
      const message = firstFailed ? escapeXml(firstFailed.label) : 'test failed';
      const textContent = failedAssertions
        .map((a) => escapeXml(a.failureMessage ?? a.label))
        .join('\n');

      return [
        `      <testcase name="${testname}" classname="${classname}">`,
        `        <failure message="${message}">${textContent}</failure>`,
        `      </testcase>`,
      ].join('\n');
    });

    return [
      `  <testsuite name="${escapeXml(suite.name)}" tests="${suite.tests.length}" failures="${suiteFailures}">`,
      ...testcases,
      `  </testsuite>`,
    ].join('\n');
  });

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<testsuites name="KindLM" tests="${totalTests}" failures="${failed}" errors="${errored}" time="${timeSeconds}">`,
    ...suiteBlocks,
    `</testsuites>`,
  ].join('\n');
}

/**
 * Write JUnit XML to a temp file and upload it as a GitHub Actions artifact.
 * Non-fatal: upload failure logs a warning but does not throw.
 */
export async function uploadJunitArtifact(xmlContent: string): Promise<void> {
  const filePath = path.join(os.tmpdir(), 'kindlm-results.xml');
  fs.writeFileSync(filePath, xmlContent, 'utf8');

  try {
    const client = new DefaultArtifactClient();
    await client.uploadArtifact('kindlm-test-results', [filePath], os.tmpdir(), {
      retentionDays: 30,
    });
  } catch (err) {
    core.warning(`Artifact upload failed: ${err}`);
  }
}
