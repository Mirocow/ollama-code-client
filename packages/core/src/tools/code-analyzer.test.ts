/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  CodeAnalyzerParams,
  AnalysisType,
  Severity,
  CodeIssue,
  ComplexityMetrics,
  DependencyInfo,
  PatternResult,
  CodeAnalysisResult,
} from './code-analyzer.js';
import codeAnalyzerTool from './code-analyzer.js';

// Mock fs module
vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(
    () => `
function hello(name) {
  if (name) {
    console.log("Hello " + name);
  }
}
export { hello };
`,
  ),
}));

describe('CodeAnalyzerTool', () => {
  describe('Tool Definition', () => {
    it('should have correct name', () => {
      expect(codeAnalyzerTool.name).toBe('code_analyzer');
    });

    it('should have correct display name', () => {
      expect(codeAnalyzerTool.displayName).toBe('Code Analyzer');
    });

    it('should have description', () => {
      expect(codeAnalyzerTool.description).toContain('analyzes code');
    });

    it('should have valid parameter schema', () => {
      expect(codeAnalyzerTool.parameterSchema).toBeDefined();
      expect(codeAnalyzerTool.parameterSchema.type).toBe('object');
      expect(codeAnalyzerTool.parameterSchema.properties).toHaveProperty('file');
    });
  });

  describe('Parameter Validation', () => {
    it('should require file parameter', () => {
      const params = {} as CodeAnalyzerParams;
      const error = codeAnalyzerTool.validateToolParams(params);
      expect(error).toBeTruthy();
    });

    it('should validate valid params', () => {
      const params: CodeAnalyzerParams = {
        file: '/test/file.ts',
      };
      const error = codeAnalyzerTool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept analysis array', () => {
      const params: CodeAnalyzerParams = {
        file: '/test/file.ts',
        analysis: ['complexity', 'security'],
      };
      const error = codeAnalyzerTool.validateToolParams(params);
      expect(error).toBeNull();
    });
  });

  describe('Analysis Types', () => {
    const validAnalysisTypes: AnalysisType[] = [
      'complexity',
      'security',
      'performance',
      'style',
      'patterns',
      'dependencies',
      'all',
    ];

    validAnalysisTypes.forEach((analysis) => {
      it(`should accept '${analysis}' analysis type`, () => {
        const params: CodeAnalyzerParams = {
          file: '/test/file.ts',
          analysis: [analysis],
        };
        const error = codeAnalyzerTool.validateToolParams(params);
        expect(error).toBeNull();
      });
    });
  });
});

describe('CodeAnalyzer Types', () => {
  it('should define CodeIssue interface correctly', () => {
    const issue: CodeIssue = {
      type: 'complexity',
      severity: 'warning',
      message: 'High cyclomatic complexity',
      line: 10,
      column: 1,
      endLine: 20,
      endColumn: 5,
      rule: 'complexity-max',
      fix: 'Extract into smaller functions',
    };
    expect(issue.type).toBe('complexity');
    expect(issue.severity).toBe('warning');
    expect(issue.line).toBe(10);
    expect(issue.rule).toBe('complexity-max');
  });

  it('should define Severity types', () => {
    const severities: Severity[] = ['error', 'warning', 'info', 'hint'];
    severities.forEach((s) => {
      expect(['error', 'warning', 'info', 'hint']).toContain(s);
    });
  });

  it('should define ComplexityMetrics interface correctly', () => {
    const metrics: ComplexityMetrics = {
      linesOfCode: 100,
      linesOfComments: 20,
      cyclomaticComplexity: 5,
      cognitiveComplexity: 6,
      maintainabilityIndex: 85,
      functions: 10,
      classes: 3,
      imports: 5,
    };
    expect(metrics.linesOfCode).toBe(100);
    expect(metrics.cyclomaticComplexity).toBe(5);
    expect(metrics.functions).toBe(10);
  });

  it('should define DependencyInfo interface correctly', () => {
    const dep: DependencyInfo = {
      name: 'lodash',
      type: 'import',
      source: "import _ from 'lodash'",
      line: 1,
      isLocal: false,
      isUsed: true,
    };
    expect(dep.name).toBe('lodash');
    expect(dep.type).toBe('import');
    expect(dep.isLocal).toBe(false);
  });

  it('should define PatternResult interface correctly', () => {
    const pattern: PatternResult = {
      name: 'Singleton',
      type: 'design',
      description: 'Singleton pattern detected',
      locations: [
        {
          line: 10,
          code: 'private static instance',
        },
      ],
    };
    expect(pattern.name).toBe('Singleton');
    expect(pattern.type).toBe('design');
    expect(pattern.locations).toHaveLength(1);
  });

  it('should define CodeAnalysisResult interface correctly', () => {
    const result: CodeAnalysisResult = {
      file: '/test/file.ts',
      language: 'typescript',
      metrics: {
        linesOfCode: 100,
        linesOfComments: 20,
        cyclomaticComplexity: 5,
        cognitiveComplexity: 6,
        maintainabilityIndex: 85,
        functions: 10,
        classes: 3,
        imports: 5,
      },
      issues: [],
      dependencies: [],
      patterns: [],
      summary: {
        score: 85,
        grade: 'A',
        recommendations: ['Good code quality'],
      },
    };
    expect(result.file).toBe('/test/file.ts');
    expect(result.language).toBe('typescript');
    expect(result.summary.grade).toBe('A');
  });
});

describe('CodeAnalyzerToolInvocation', () => {
  it('should create invocation with valid params', () => {
    const params: CodeAnalyzerParams = {
      file: '/test/file.ts',
    };
    const invocation = codeAnalyzerTool.createInvocation(params);
    expect(invocation).toBeDefined();
    expect(invocation.getDescription()).toContain('file.ts');
  });

  it('should create invocation with analysis types', () => {
    const params: CodeAnalyzerParams = {
      file: '/test/file.ts',
      analysis: ['complexity', 'security'],
    };
    const invocation = codeAnalyzerTool.createInvocation(params);
    expect(invocation.getDescription()).toContain('complexity');
    expect(invocation.getDescription()).toContain('security');
  });

  it('should create invocation with all analysis types', () => {
    const params: CodeAnalyzerParams = {
      file: '/test/file.ts',
      analysis: ['all'],
    };
    const invocation = codeAnalyzerTool.createInvocation(params);
    expect(invocation.getDescription()).toContain('all');
  });
});
