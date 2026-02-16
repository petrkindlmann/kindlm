export interface ComplianceReport {
  title: string;
  generatedAt: string;
  version: string;
  hash: string;
  sections: ComplianceSection[];
}

export interface ComplianceSection {
  articleRef: string;
  title: string;
  content: string;
  evidence: ComplianceEvidence[];
}

export interface ComplianceEvidence {
  testName: string;
  suiteName: string;
  passed: boolean;
  details: string;
}

export interface JUnitReport {
  name: string;
  tests: number;
  failures: number;
  errors: number;
  time: number;
  testSuites: JUnitTestSuite[];
}

export interface JUnitTestSuite {
  name: string;
  tests: number;
  failures: number;
  errors: number;
  time: number;
  testCases: JUnitTestCase[];
}

export interface JUnitTestCase {
  name: string;
  classname: string;
  time: number;
  failure?: {
    message: string;
    type: string;
    content: string;
  };
  error?: {
    message: string;
    type: string;
    content: string;
  };
}
