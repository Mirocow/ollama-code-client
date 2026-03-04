/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Code Analyzer Tool
 * Analyzes code for complexity, patterns, security issues, and style.
 */

import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  Kind,
  type ToolResult,
  type ToolResultDisplay,
} from '../../../../tools/tools.js';
import { ToolErrorType } from '../../../../tools/tool-error.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ============================================================================
// Types
// ============================================================================

/**
 * Analysis types available
 */
export type AnalysisType =
  | 'complexity'
  | 'security'
  | 'performance'
  | 'style'
  | 'patterns'
  | 'dependencies'
  | 'all';

/**
 * Severity levels for issues
 */
export type Severity = 'error' | 'warning' | 'info' | 'hint';

/**
 * Code issue found during analysis
 */
export interface CodeIssue {
  type: AnalysisType;
  severity: Severity;
  message: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  rule?: string;
  fix?: string;
}

/**
 * Complexity metrics
 */
export interface ComplexityMetrics {
  linesOfCode: number;
  linesOfComments: number;
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  maintainabilityIndex: number;
  functions: number;
  classes: number;
  imports: number;
}

/**
 * Dependency information
 */
export interface DependencyInfo {
  name: string;
  type: 'import' | 'require' | 'dynamic';
  source: string;
  line: number;
  isLocal: boolean;
  isUsed: boolean;
}

/**
 * Pattern detection result
 */
export interface PatternResult {
  name: string;
  type: 'design' | 'anti' | 'idiom';
  description: string;
  locations: Array<{
    line: number;
    code: string;
  }>;
}

/**
 * Full analysis result
 */
export interface CodeAnalysisResult {
  file: string;
  language: string;
  metrics: ComplexityMetrics;
  issues: CodeIssue[];
  dependencies: DependencyInfo[];
  patterns: PatternResult[];
  summary: {
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    recommendations: string[];
  };
}

/**
 * Tool parameters
 */
export interface CodeAnalyzerParams {
  file: string;
  analysis?: AnalysisType[];
}

// ============================================================================
// Language Detection
// ============================================================================

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.java': 'java',
  '.kt': 'kotlin',
  '.go': 'go',
  '.rs': 'rust',
  '.rb': 'ruby',
  '.php': 'php',
  '.cs': 'csharp',
  '.cpp': 'cpp',
  '.c': 'c',
  '.h': 'c',
  '.hpp': 'cpp',
  '.swift': 'swift',
  '.scala': 'scala',
  '.lua': 'lua',
  '.sh': 'bash',
  '.bash': 'bash',
  '.zsh': 'bash',
  '.sql': 'sql',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.xml': 'xml',
  '.html': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.md': 'markdown',
};

function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return LANGUAGE_EXTENSIONS[ext] || 'unknown';
}

// ============================================================================
// Complexity Analysis
// ============================================================================

function analyzeComplexity(
  content: string,
  _language: string,
): { metrics: ComplexityMetrics; issues: CodeIssue[] } {
  const lines = content.split('\n');
  const issues: CodeIssue[] = [];

  const linesOfCode = lines.filter(
    (line) => line.trim().length > 0 && !line.trim().startsWith('//'),
  ).length;
  const linesOfComments = lines.filter(
    (line) =>
      line.trim().startsWith('//') ||
      line.trim().startsWith('#') ||
      line.trim().startsWith('/*') ||
      line.trim().startsWith('*'),
  ).length;

  const controlPatterns = [
    /\bif\s*\(/g,
    /\belse\s+if\s*\(/g,
    /\bfor\s*\(/g,
    /\bwhile\s*\(/g,
    /\bswitch\s*\(/g,
    /\bcase\s+/g,
    /\bcatch\s*\(/g,
    /\?\s*:/g,
    /&&/g,
    /\|\|/g,
  ];

  let cyclomaticComplexity = 1;
  for (const pattern of controlPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      cyclomaticComplexity += matches.length;
    }
  }

  const functionPatterns = [
    /\bfunction\s+\w+/g,
    /\bconst\s+\w+\s*=\s*(?:async\s*)?\(/g,
    /\b\w+\s*:\s*(?:async\s*)?\([^)]*\)\s*=>/g,
    /\basync\s+\w+\s*\(/g,
    /\bdef\s+\w+/g,
  ];

  let functions = 0;
  for (const pattern of functionPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      functions += matches.length;
    }
  }

  const classPatterns = [/\bclass\s+\w+/g, /\binterface\s+\w+/g];
  let classes = 0;
  for (const pattern of classPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      classes += matches.length;
    }
  }

  const importPatterns = [
    /\bimport\s+.*from/g,
    /\brequire\s*\(/g,
    /\bimport\s*\(/g,
  ];
  let imports = 0;
  for (const pattern of importPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      imports += matches.length;
    }
  }

  const volume = linesOfCode * (content.length / linesOfCode || 1);
  const maintainabilityIndex = Math.max(
    0,
    Math.min(
      100,
      171 -
        5.2 * Math.log(volume) -
        0.23 * cyclomaticComplexity -
        16.2 * Math.log(linesOfCode),
    ),
  );

  if (cyclomaticComplexity > 20) {
    issues.push({
      type: 'complexity',
      severity: 'error',
      message: `High cyclomatic complexity (${cyclomaticComplexity}). Consider breaking down into smaller functions.`,
      rule: 'complexity-max',
      fix: 'Extract complex logic into separate functions or methods.',
    });
  } else if (cyclomaticComplexity > 10) {
    issues.push({
      type: 'complexity',
      severity: 'warning',
      message: `Moderate cyclomatic complexity (${cyclomaticComplexity}). Consider simplifying the logic.`,
      rule: 'complexity-warn',
    });
  }

  if (linesOfCode > 500) {
    issues.push({
      type: 'complexity',
      severity: 'warning',
      message: `File is too long (${linesOfCode} lines). Consider splitting into multiple files.`,
      rule: 'max-lines',
    });
  }

  return {
    metrics: {
      linesOfCode,
      linesOfComments,
      cyclomaticComplexity,
      cognitiveComplexity: Math.round(cyclomaticComplexity * 1.2),
      maintainabilityIndex: Math.round(maintainabilityIndex),
      functions,
      classes,
      imports,
    },
    issues,
  };
}

// ============================================================================
// Security Analysis
// ============================================================================

const SECURITY_PATTERNS: Array<{
  pattern: RegExp;
  message: string;
  severity: Severity;
}> = [
  {
    pattern: /eval\s*\(/g,
    message: 'Use of eval() is dangerous and can lead to code injection.',
    severity: 'error',
  },
  {
    pattern: /Function\s*\(/g,
    message: 'Dynamic function creation can lead to code injection.',
    severity: 'error',
  },
  {
    pattern: /innerHTML\s*=/g,
    message: 'Setting innerHTML can lead to XSS vulnerabilities.',
    severity: 'error',
  },
  {
    pattern: /dangerouslySetInnerHTML/g,
    message: 'dangerouslySetInnerHTML can lead to XSS if not sanitized.',
    severity: 'warning',
  },
  {
    pattern: /password\s*=\s*['"][^'"]+['"]/gi,
    message: 'Hardcoded password detected.',
    severity: 'error',
  },
  {
    pattern: /api[_-]?key\s*=\s*['"][^'"]+['"]/gi,
    message: 'Hardcoded API key detected.',
    severity: 'error',
  },
  {
    pattern: /secret\s*=\s*['"][^'"]+['"]/gi,
    message: 'Hardcoded secret detected.',
    severity: 'error',
  },
];

function analyzeSecurity(content: string): CodeIssue[] {
  const issues: CodeIssue[] = [];

  for (const { pattern, message, severity } of SECURITY_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(content)) !== null) {
      const beforeMatch = content.substring(0, match.index);
      const lineNumber = beforeMatch.split('\n').length;

      issues.push({
        type: 'security',
        severity,
        message,
        line: lineNumber,
        rule: 'security-' + pattern.source.substring(0, 20),
        fix: 'Use secure alternatives and sanitize all user inputs.',
      });
    }
  }

  return issues;
}

// ============================================================================
// Pattern Detection
// ============================================================================

const DESIGN_PATTERNS: Array<{
  name: string;
  pattern: RegExp;
  type: 'design' | 'anti' | 'idiom';
  description: string;
}> = [
  {
    name: 'Singleton',
    pattern:
      /(?:class\s+\w+.*\{[\s\S]*?private\s+static\s+instance[\s\S]*?\})|(?:getInstance\s*\(\s*\))/g,
    type: 'design',
    description: 'Singleton pattern detected',
  },
  {
    name: 'Factory',
    pattern: /(?:create\w+\s*\(\s*\))|(?:factory\s*:\s*\{)/gi,
    type: 'design',
    description: 'Factory pattern detected',
  },
  {
    name: 'Observer',
    pattern: /(?:addEventListener|subscribe|on\s*\(\s*['"][\w]+['"])/g,
    type: 'design',
    description: 'Observer pattern detected',
  },
  {
    name: 'Promise Chain',
    pattern: /\.then\s*\([^)]*\)\s*\.then/g,
    type: 'idiom',
    description: 'Promise chain detected - consider async/await',
  },
  {
    name: 'Callback Hell',
    pattern: /(?:\}\s*,\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{){3,}/g,
    type: 'anti',
    description: 'Nested callbacks detected - consider Promises',
  },
];

function analyzePatterns(content: string): PatternResult[] {
  const patterns: PatternResult[] = [];

  for (const { name, pattern, type, description } of DESIGN_PATTERNS) {
    const matches = [...content.matchAll(new RegExp(pattern.source, pattern.flags))];
    if (matches.length > 0) {
      const lines = content.split('\n');
      const locations = matches.slice(0, 5).map((match) => {
        const beforeMatch = content.substring(0, match.index);
        const lineNumber = beforeMatch.split('\n').length;
        return {
          line: lineNumber,
          code: lines[lineNumber - 1]?.trim() || '',
        };
      });

      patterns.push({
        name,
        type,
        description,
        locations,
      });
    }
  }

  return patterns;
}

// ============================================================================
// Dependency Analysis
// ============================================================================

function analyzeDependencies(content: string): DependencyInfo[] {
  const dependencies: DependencyInfo[] = [];

  const importPattern = /import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importPattern.exec(content)) !== null) {
    const beforeMatch = content.substring(0, match.index);
    const lineNumber = beforeMatch.split('\n').length;
    dependencies.push({
      name: match[1],
      type: 'import',
      source: match[0],
      line: lineNumber,
      isLocal: match[1].startsWith('.') || match[1].startsWith('/'),
      isUsed: true,
    });
  }

  const requirePattern = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requirePattern.exec(content)) !== null) {
    const beforeMatch = content.substring(0, match.index);
    const lineNumber = beforeMatch.split('\n').length;
    dependencies.push({
      name: match[1],
      type: 'require',
      source: match[0],
      line: lineNumber,
      isLocal: match[1].startsWith('.') || match[1].startsWith('/'),
      isUsed: true,
    });
  }

  return dependencies;
}

// ============================================================================
// Calculate Score
// ============================================================================

function calculateScore(
  metrics: ComplexityMetrics,
  issues: CodeIssue[],
): { score: number; grade: 'A' | 'B' | 'C' | 'D' | 'F'; recommendations: string[] } {
  let score = 100;
  const recommendations: string[] = [];

  if (metrics.cyclomaticComplexity > 20) {
    score -= 20;
    recommendations.push('Reduce cyclomatic complexity');
  } else if (metrics.cyclomaticComplexity > 10) {
    score -= 10;
  }

  if (metrics.linesOfCode > 500) {
    score -= 15;
    recommendations.push('Split large files into smaller modules');
  }

  for (const issue of issues) {
    if (issue.severity === 'error') score -= 10;
    else if (issue.severity === 'warning') score -= 5;
    else if (issue.severity === 'info') score -= 2;
  }

  score = Math.max(0, Math.min(100, score));

  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 70) grade = 'C';
  else if (score >= 60) grade = 'D';
  else grade = 'F';

  if (issues.filter((i) => i.type === 'security').length > 0) {
    recommendations.push('Address security issues before deployment');
  }

  if (recommendations.length === 0) {
    recommendations.push('Code looks good! Keep up the good work.');
  }

  return { score, grade, recommendations };
}

// ============================================================================
// Main Analysis Function
// ============================================================================

function analyzeCode(
  filePath: string,
  analysisTypes: AnalysisType[],
): CodeAnalysisResult {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const language = detectLanguage(filePath);
  const allIssues: CodeIssue[] = [];

  const runComplexity = analysisTypes.includes('complexity') || analysisTypes.includes('all');
  const runSecurity = analysisTypes.includes('security') || analysisTypes.includes('all');
  const runPatterns = analysisTypes.includes('patterns') || analysisTypes.includes('all');
  const runDependencies = analysisTypes.includes('dependencies') || analysisTypes.includes('all');

  let metrics: ComplexityMetrics = {
    linesOfCode: 0,
    linesOfComments: 0,
    cyclomaticComplexity: 1,
    cognitiveComplexity: 1,
    maintainabilityIndex: 100,
    functions: 0,
    classes: 0,
    imports: 0,
  };

  if (runComplexity) {
    const complexityResult = analyzeComplexity(content, language);
    metrics = complexityResult.metrics;
    allIssues.push(...complexityResult.issues);
  }

  if (runSecurity) {
    allIssues.push(...analyzeSecurity(content));
  }

  let patterns: PatternResult[] = [];
  if (runPatterns) {
    patterns = analyzePatterns(content);
  }

  let dependencies: DependencyInfo[] = [];
  if (runDependencies) {
    dependencies = analyzeDependencies(content);
  }

  const summary = calculateScore(metrics, allIssues);

  return {
    file: filePath,
    language,
    metrics,
    issues: allIssues,
    dependencies,
    patterns,
    summary,
  };
}

// ============================================================================
// Tool Invocation
// ============================================================================

class CodeAnalyzerInvocation extends BaseToolInvocation<
  CodeAnalyzerParams,
  ToolResult
> {
  constructor(params: CodeAnalyzerParams) {
    super(params);
  }

  getDescription(): string {
    return `Analyzing ${this.params.file} for ${this.params.analysis?.join(', ') || 'complexity, security, patterns'}`;
  }

  async execute(
    _signal: AbortSignal,
    _updateOutput?: (output: ToolResultDisplay) => void,
  ): Promise<ToolResult> {
    try {
      const result = analyzeCode(
        this.params.file,
        this.params.analysis || ['complexity', 'security', 'patterns'],
      );

      const llmContent = `## Code Analysis: ${result.file}

**Language:** ${result.language}
**Score:** ${result.summary.score}/100 (Grade: ${result.summary.grade})

### Metrics
- Lines of Code: ${result.metrics.linesOfCode}
- Cyclomatic Complexity: ${result.metrics.cyclomaticComplexity}
- Functions: ${result.metrics.functions}
- Classes: ${result.metrics.classes}

### Issues Found: ${result.issues.length}
${result.issues.map((i) => `- [${i.severity.toUpperCase()}] ${i.message}${i.line ? ` (line ${i.line})` : ''}`).join('\n')}

### Recommendations
${result.summary.recommendations.map((r) => `- ${r}`).join('\n')}`;

      return {
        llmContent,
        returnDisplay: `Analyzed ${result.file}: Score ${result.summary.score}/100 (${result.summary.grade}), ${result.issues.length} issues found`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        llmContent: `Error analyzing file: ${errorMessage}`,
        returnDisplay: errorMessage,
        error: {
          message: errorMessage,
          type: ToolErrorType.EXECUTION_FAILED,
        },
      };
    }
  }
}

// ============================================================================
// Tool Definition
// ============================================================================

/**
 * Code Analyzer Tool class definition
 */
export class CodeAnalyzerTool extends BaseDeclarativeTool<
  CodeAnalyzerParams,
  ToolResult
> {
  static readonly Name = 'code_analyzer';
  
  constructor() {
    super(
      CodeAnalyzerTool.Name,
      'Code Analyzer',
      `Analyzes code files for complexity, security issues, patterns, and provides recommendations.

Returns detailed metrics including:
- Lines of code and comments
- Cyclomatic complexity
- Function and class count
- Security vulnerabilities
- Design patterns detected
- Overall quality score (0-100) with grade (A-F)

Use this tool to get insights about code quality and potential improvements.`,
      Kind.Read,
      {
        type: 'object',
        properties: {
          file: {
            type: 'string',
            description: 'Path to the file to analyze',
          },
          analysis: {
            type: 'array',
            items: {
              type: 'string',
              enum: [
                'complexity',
                'security',
                'performance',
                'style',
                'patterns',
                'dependencies',
                'all',
              ],
            },
            description:
              'Types of analysis to run. Default: ["complexity", "security", "patterns"]',
          },
        },
        required: ['file'],
      },
      true, // isOutputMarkdown
      false, // canUpdateOutput
    );
  }

  protected override createInvocation(
    params: CodeAnalyzerParams,
  ): CodeAnalyzerInvocation {
    return new CodeAnalyzerInvocation(params);
  }
}

export const codeAnalyzerTool = new CodeAnalyzerTool();
export default codeAnalyzerTool;
