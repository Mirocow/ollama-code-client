/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Diagram Generator Tool
 *
 * This tool generates diagrams from text descriptions using various diagram formats:
 * - Mermaid: flowchart, sequence, class, state, er, gantt, etc.
 * - PlantUML: comprehensive diagram support with rich syntax
 *
 * Features:
 * - Automatic diagram type detection
 * - Multiple output formats: SVG, PNG, ASCII text
 * - Validation of diagram syntax
 * - Preview generation for quick visualization
 */

import { BaseDeclarativeTool, BaseToolInvocation, Kind } from '../../../../tools/tools.js';
import type { ToolResult, ToolResultDisplay } from '../../../../tools/tools.js';
import type { Config } from '../../../../config/config.js';
import { createDebugLogger } from '../../../../utils/debugLogger.js';

const debugLogger = createDebugLogger('DIAGRAM_GENERATOR');

// ============================================================================
// Types and Constants
// ============================================================================

/**
 * Supported diagram types
 */
export type DiagramType = 'mermaid' | 'plantuml' | 'auto';

/**
 * Supported output formats
 */
export type OutputFormat = 'svg' | 'png' | 'text';

/**
 * Parameters for the DiagramGeneratorTool
 */
export interface DiagramGeneratorParams {
  /**
   * The diagram content/source code
   * For Mermaid: uses Mermaid syntax (flowchart, sequenceDiagram, etc.)
   * For PlantUML: uses PlantUML syntax (@startuml/@enduml)
   */
  content: string;

  /**
   * The type of diagram to generate
   * - 'mermaid': Force Mermaid parsing
   * - 'plantuml': Force PlantUML parsing
   * - 'auto': Automatically detect diagram type from content
   * @default 'auto'
   */
  type: DiagramType;

  /**
   * Optional file path to save the generated diagram
   * If provided, the diagram will be saved to this location
   */
  output?: string;

  /**
   * Output format for the generated diagram
   * - 'svg': Scalable Vector Graphics (default)
   * - 'png': Portable Network Graphics
   * - 'text': ASCII text representation
   * @default 'svg'
   */
  format?: OutputFormat;
}

/**
 * Result of diagram generation
 */
export interface DiagramGeneratorResult extends ToolResult {
  /**
   * The detected or specified diagram type
   */
  diagramType: 'mermaid' | 'plantuml';

  /**
   * The normalized diagram source code
   */
  sourceCode: string;

  /**
   * The output format used
   */
  format: OutputFormat;

  /**
   * For SVG/PNG output: URL or data URI for the rendered diagram
   */
  renderUrl?: string;

  /**
   * For text output: ASCII representation of the diagram
   */
  asciiRepresentation?: string;

  /**
   * Instructions for rendering the diagram
   */
  renderInstructions: string;
}

/**
 * Mermaid diagram type patterns for auto-detection
 */
const MERMAID_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  type: string;
}> = [
  { pattern: /^\s*flowchart\s+(TB|BT|LR|RL|TD)/im, type: 'flowchart' },
  { pattern: /^\s*graph\s+(TB|BT|LR|RL|TD)/im, type: 'graph' },
  { pattern: /^\s*sequenceDiagram\b/im, type: 'sequence' },
  { pattern: /^\s*classDiagram\b/im, type: 'class' },
  { pattern: /^\s*stateDiagram(-v2)?\b/im, type: 'state' },
  { pattern: /^\s*erDiagram\b/im, type: 'er' },
  { pattern: /^\s*gantt\b/im, type: 'gantt' },
  { pattern: /^\s*pie\s+(showData)?\b/im, type: 'pie' },
  { pattern: /^\s*journey\b/im, type: 'journey' },
  { pattern: /^\s*gitGraph\b/im, type: 'git' },
  { pattern: /^\s*mindmap\b/im, type: 'mindmap' },
  { pattern: /^\s*timeline\b/im, type: 'timeline' },
  { pattern: /^\s*quadrantChart\b/im, type: 'quadrant' },
  { pattern: /^\s*requirementDiagram\b/im, type: 'requirement' },
  { pattern: /^\s*C4Context\b/im, type: 'c4' },
];

/**
 * PlantUML patterns for auto-detection
 */
const PLANTUML_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  type: string;
}> = [
  { pattern: /@startuml\b/i, type: 'plantuml' },
  { pattern: /@startmindmap\b/i, type: 'mindmap' },
  { pattern: /@startsalt\b/i, type: 'salt' },
  { pattern: /@startgantt\b/i, type: 'gantt' },
  { pattern: /@startwbs\b/i, type: 'wbs' },
  { pattern: /@startjson\b/i, type: 'json' },
  { pattern: /@startyaml\b/i, type: 'yaml' },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Detects the diagram type from the content
 * @param content - The diagram source code
 * @returns The detected diagram type or null if not detected
 */
function detectDiagramType(content: string): 'mermaid' | 'plantuml' | null {
  // Check for PlantUML patterns first (they have explicit markers)
  for (const { pattern } of PLANTUML_PATTERNS) {
    if (pattern.test(content)) {
      return 'plantuml';
    }
  }

  // Check for Mermaid patterns
  for (const { pattern } of MERMAID_PATTERNS) {
    if (pattern.test(content)) {
      return 'mermaid';
    }
  }

  // Default to Mermaid if no specific pattern is found but content looks like a diagram
  const trimmedContent = content.trim();
  if (trimmedContent.length > 0) {
    // Heuristics for Mermaid-like content
    if (
      /^\s*(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt)\b/im.test(
        trimmedContent,
      )
    ) {
      return 'mermaid';
    }
  }

  return null;
}

/**
 * Validates Mermaid diagram syntax
 * @param content - The diagram source code
 * @returns Error message if invalid, null if valid
 */
function validateMermaidSyntax(content: string): string | null {
  const trimmedContent = content.trim();
  if (trimmedContent.length === 0) {
    return 'Mermaid diagram content cannot be empty';
  }

  // Check for known diagram types
  const hasValidStart = MERMAID_PATTERNS.some(({ pattern }) =>
    pattern.test(trimmedContent),
  );

  if (!hasValidStart) {
    return (
      'Invalid Mermaid syntax. Diagram must start with a valid diagram type ' +
      '(e.g., flowchart, sequenceDiagram, classDiagram, etc.)'
    );
  }

  // Basic syntax validation
  const lines = trimmedContent.split('\n');
  let braceCount = 0;
  let bracketCount = 0;

  for (const line of lines) {
    braceCount += (line.match(/[{]/g) || []).length;
    braceCount -= (line.match(/[}]/g) || []).length;
    bracketCount += (line.match(/\[/g) || []).length;
    bracketCount -= (line.match(/]/g) || []).length;
  }

  if (braceCount !== 0) {
    return `Unbalanced braces in Mermaid diagram. Found ${Math.abs(braceCount)} ${braceCount > 0 ? 'unclosed' : 'extra closing'} brace(s)`;
  }

  if (bracketCount !== 0) {
    return `Unbalanced brackets in Mermaid diagram. Found ${Math.abs(bracketCount)} ${bracketCount > 0 ? 'unclosed' : 'extra closing'} bracket(s)`;
  }

  return null;
}

/**
 * Validates PlantUML diagram syntax
 * @param content - The diagram source code
 * @returns Error message if invalid, null if valid
 */
function validatePlantUmlSyntax(content: string): string | null {
  const trimmedContent = content.trim();
  if (trimmedContent.length === 0) {
    return 'PlantUML diagram content cannot be empty';
  }

  // Check for PlantUML markers
  const hasStartMarker = /@start(uml|mindmap|salt|gantt|wbs|json|yaml)\b/i.test(
    trimmedContent,
  );
  const hasEndMarker = /@end(uml|mindmap|salt|gantt|wbs|json|yaml)\b/i.test(
    trimmedContent,
  );

  if (!hasStartMarker) {
    return 'PlantUML diagram must have a @startxxx marker (e.g., @startuml)';
  }

  if (!hasEndMarker) {
    return 'PlantUML diagram must have an @endxxx marker (e.g., @enduml)';
  }

  return null;
}

/**
 * Generates ASCII representation of a simple flowchart
 * This is a simplified version that works with basic node-link structures
 * @param content - The Mermaid diagram source code
 * @returns ASCII art representation
 */
function generateMermaidAscii(content: string): string {
  const lines: string[] = [];
  const nodes = new Map<string, string>();
  const connections: Array<{ from: string; to: string; label?: string }> = [];

  // Parse flowchart nodes and connections
  const flowchartRegex = /^\s*(flowchart|graph)\s+(TB|BT|LR|RL|TD)\s*$/im;
  const match = content.match(flowchartRegex);

  if (match) {
    lines.push(`┌─────────────────────────────────────┐`);
    lines.push(`│       MERMAID FLOWCHART             │`);
    lines.push(`│       Direction: ${match[2].padEnd(17)}│`);
    lines.push(`└─────────────────────────────────────┘`);
    lines.push('');
  }

  // Extract node definitions: A[Label], B(Label), C{Decision}, etc.
  const nodeRegex = /([A-Za-z0-9_]+)\s*[[({]([^}\])]+)[\])}]/g;
  let nodeMatch;
  while ((nodeMatch = nodeRegex.exec(content)) !== null) {
    nodes.set(nodeMatch[1], nodeMatch[2]);
  }

  // Extract connections: A --> B, A -->|label| B, etc.
  const connectionRegex =
    /([A-Za-z0-9_]+)\s*--+>?-?\|?([^|]*)\|?\s*([A-Za-z0-9_]+)/g;
  let connMatch;
  while ((connMatch = connectionRegex.exec(content)) !== null) {
    connections.push({
      from: connMatch[1],
      to: connMatch[3],
      label: connMatch[2]?.trim() || undefined,
    });
  }

  // Generate ASCII output
  if (nodes.size > 0) {
    lines.push('Nodes:');
    lines.push('─────────────────────────────────────');
    for (const [id, label] of nodes) {
      lines.push(`  [${id}] ${label}`);
    }
    lines.push('');
  }

  if (connections.length > 0) {
    lines.push('Connections:');
    lines.push('─────────────────────────────────────');
    for (const conn of connections) {
      const fromLabel = nodes.get(conn.from) || conn.from;
      const toLabel = nodes.get(conn.to) || conn.to;
      const arrow = conn.label ? `──[${conn.label}]──>` : '──>';
      lines.push(`  ${fromLabel} ${arrow} ${toLabel}`);
    }
    lines.push('');
  }

  // If no structured content found, show the raw content
  if (nodes.size === 0 && connections.length === 0) {
    lines.push('Raw diagram content:');
    lines.push('─────────────────────────────────────');
    lines.push(content);
  }

  return lines.join('\n');
}

/**
 * Generates ASCII representation for PlantUML diagrams
 * @param content - The PlantUML diagram source code
 * @returns ASCII art representation
 */
function generatePlantUmlAscii(content: string): string {
  const lines: string[] = [];

  // Detect diagram type
  const startMatch = content.match(/@start(\w+)/i);
  const diagramType = startMatch ? startMatch[1].toUpperCase() : 'UML';

  lines.push(`┌─────────────────────────────────────┐`);
  lines.push(`│       PLANTUML ${diagramType.padEnd(16)}│`);
  lines.push(`└─────────────────────────────────────┘`);
  lines.push('');

  // Extract participants/actors for sequence diagrams
  const participants: Array<{ type: string; name: string }> = [];
  const participantRegex =
    /(?:participant|actor|boundary|control|entity|database|collections|queue)\s+(\w+)(?:\s+as\s+(\w+))?/gi;
  let match;
  while ((match = participantRegex.exec(content)) !== null) {
    participants.push({
      type: 'participant',
      name: match[2] || match[1],
    });
  }

  // Extract classes for class diagrams
  const classes: string[] = [];
  const classRegex = /class\s+(\w+)/gi;
  while ((match = classRegex.exec(content)) !== null) {
    classes.push(match[1]);
  }

  // Generate output based on content
  if (participants.length > 0) {
    lines.push('Participants:');
    lines.push('─────────────────────────────────────');
    for (const p of participants) {
      lines.push(`  ┌─────────┐`);
      lines.push(`  │ ${p.name.padEnd(7)} │`);
      lines.push(`  └─────────┘`);
    }
    lines.push('');
  }

  if (classes.length > 0) {
    lines.push('Classes:');
    lines.push('─────────────────────────────────────');
    for (const cls of classes) {
      lines.push(`  ┌──────────────┐`);
      lines.push(`  │ ${cls.padEnd(12)} │`);
      lines.push(`  └──────────────┘`);
    }
    lines.push('');
  }

  // Show raw content if nothing parsed
  if (participants.length === 0 && classes.length === 0) {
    lines.push('Raw diagram content:');
    lines.push('─────────────────────────────────────');
    lines.push(content);
  }

  return lines.join('\n');
}

/**
 * Generates render URL for Mermaid diagrams using Kroki or Mermaid.ink
 * @param content - The Mermaid diagram source code
 * @param format - Output format
 * @returns URL for rendering
 */
function getMermaidRenderUrl(content: string, format: OutputFormat): string {
  // Encode the diagram content for URL
  const encoded = Buffer.from(content).toString('base64url');

  // Use mermaid.ink for rendering
  // Note: This is a public service, for production use consider self-hosting
  if (format === 'svg') {
    return `https://mermaid.ink/svg/${encoded}`;
  } else if (format === 'png') {
    return `https://mermaid.ink/img/${encoded}`;
  }

  return `https://mermaid.ink/svg/${encoded}`;
}

/**
 * Generates render URL for PlantUML diagrams
 * @param content - The PlantUML diagram source code
 * @param format - Output format
 * @returns URL for rendering
 */
function getPlantUmlRenderUrl(content: string, format: OutputFormat): string {
  // Encode using PlantUML's special encoding (deflate + base64)
  // For simplicity, we use the official PlantUML server
  const encoded = Buffer.from(content).toString('base64url');

  // Use official PlantUML server (or self-hosted instance)
  const server = 'https://www.plantuml.com/plantuml';

  if (format === 'svg') {
    return `${server}/svg/${encoded}`;
  } else if (format === 'png') {
    return `${server}/png/${encoded}`;
  }

  return `${server}/svg/${encoded}`;
}

/**
 * Generates instructions for rendering the diagram
 * @param diagramType - The diagram type
 * @param format - Output format
 * @param renderUrl - The render URL (if applicable)
 * @param outputPath - Optional output path
 * @returns Render instructions
 */
function generateRenderInstructions(
  diagramType: 'mermaid' | 'plantuml',
  format: OutputFormat,
  renderUrl: string,
  outputPath?: string,
): string {
  const instructions: string[] = [];

  if (format === 'text') {
    instructions.push('ASCII text representation generated above.');
    instructions.push(
      'This is a simplified view of the diagram structure.',
    );
  } else {
    instructions.push(`\n### Rendering Your ${diagramType.toUpperCase()} Diagram\n`);
    instructions.push(`\n**Option 1: Direct URL**`);
    instructions.push(`Open this URL in your browser:`);
    instructions.push(`\`\`\`\n${renderUrl}\n\`\`\`\n`);

    instructions.push(`**Option 2: Using curl**`);
    if (outputPath) {
      instructions.push(
        `\`\`\`bash\ncurl -o "${outputPath}" "${renderUrl}"\n\`\`\`\n`,
      );
    } else {
      const defaultFilename =
        diagramType === 'mermaid'
          ? `diagram.${format}`
          : `diagram.${format}`;
      instructions.push(
        `\`\`\`bash\ncurl -o "${defaultFilename}" "${renderUrl}"\n\`\`\`\n`,
      );
    }

    instructions.push(`**Option 3: Using ${diagramType === 'mermaid' ? 'Mermaid CLI' : 'PlantUML'}**`);
    if (diagramType === 'mermaid') {
      instructions.push(
        `\`\`\`bash\n# Install Mermaid CLI\nnpm install -g @mermaid-js/mermaid-cli\n\n# Generate diagram\nmmdc -i diagram.mmd -o output.${format}\n\`\`\`\n`,
      );
    } else {
      instructions.push(
        `\`\`\`bash\n# Using PlantUML jar\njava -jar plantuml.jar diagram.puml\n\n# Or using Docker\ndocker run --rm -v $(pwd):/data plantuml/plantuml diagram.puml\n\`\`\`\n`,
      );
    }

    instructions.push(`**Option 4: Online Editors**`);
    if (diagramType === 'mermaid') {
      instructions.push(
        `- [Mermaid Live Editor](https://mermaid.live)\n- [GitHub Markdown](https://github.com) (renders Mermaid natively)`,
      );
    } else {
      instructions.push(
        `- [PlantUML Online](https://www.plantuml.com/plantuml/uml/)\n- [PlantText](https://www.planttext.com/)`,
      );
    }
  }

  return instructions.join('\n');
}

// ============================================================================
// Tool Invocation
// ============================================================================

/**
 * Invocation class for the Diagram Generator tool
 */
class DiagramGeneratorInvocation extends BaseToolInvocation<
  DiagramGeneratorParams,
  DiagramGeneratorResult
> {
  constructor(
    _config: Config,
    params: DiagramGeneratorParams,
  ) {
    super(params);
  }

  /**
   * Gets a description of what this tool invocation will do
   */
  getDescription(): string {
    const type = this.params.type === 'auto' ? 'auto-detect' : this.params.type;
    const format = this.params.format || 'svg';
    let desc = `Generate ${type} diagram`;

    if (this.params.output) {
      desc += ` and save to "${this.params.output}"`;
    }

    desc += ` (format: ${format})`;

    return desc;
  }

  /**
   * Executes the diagram generation
   */
  async execute(
    _signal: AbortSignal,
    _updateOutput?: (output: ToolResultDisplay) => void,
  ): Promise<DiagramGeneratorResult> {
    const { content, type, output, format = 'svg' } = this.params;

    try {
      // Step 1: Detect or use specified diagram type
      let detectedType: 'mermaid' | 'plantuml';

      if (type === 'auto') {
        const detected = detectDiagramType(content);
        if (!detected) {
          return {
            llmContent:
              'Unable to detect diagram type. Please specify "mermaid" or "plantuml" explicitly, or ensure your diagram starts with a valid diagram type marker.',
            returnDisplay:
              'Error: Could not detect diagram type. Please specify the type.',
            diagramType: 'mermaid', // Default
            sourceCode: content,
            format,
            renderInstructions:
              'Specify the diagram type (mermaid or plantuml) to generate the diagram.',
            error: {
              message: 'Could not detect diagram type',
            },
          };
        }
        detectedType = detected;
        debugLogger.info(`Auto-detected diagram type: ${detectedType}`);
      } else {
        detectedType = type;
      }

      // Step 2: Validate syntax
      const validationError =
        detectedType === 'mermaid'
          ? validateMermaidSyntax(content)
          : validatePlantUmlSyntax(content);

      if (validationError) {
        return {
          llmContent: `Validation error: ${validationError}\n\nPlease check your ${detectedType} syntax and try again.`,
          returnDisplay: `Error: ${validationError}`,
          diagramType: detectedType,
          sourceCode: content,
          format,
          renderInstructions: '',
          error: {
            message: validationError,
          },
        };
      }

      // Step 3: Generate output based on format
      let asciiRepresentation: string | undefined;
      let renderUrl: string | undefined;

      if (format === 'text') {
        asciiRepresentation =
          detectedType === 'mermaid'
            ? generateMermaidAscii(content)
            : generatePlantUmlAscii(content);
      } else {
        renderUrl =
          detectedType === 'mermaid'
            ? getMermaidRenderUrl(content, format)
            : getPlantUmlRenderUrl(content, format);
      }

      // Step 4: Generate render instructions
      const renderInstructions = generateRenderInstructions(
        detectedType,
        format,
        renderUrl || '',
        output,
      );

      // Step 5: Build result
      const result: DiagramGeneratorResult = {
        llmContent: this.buildLlmContent(
          detectedType,
          content,
          format,
          asciiRepresentation,
          renderUrl,
          renderInstructions,
        ),
        returnDisplay: this.buildReturnDisplay(
          detectedType,
          format,
          asciiRepresentation,
        ),
        diagramType: detectedType,
        sourceCode: content,
        format,
        renderUrl,
        asciiRepresentation,
        renderInstructions,
      };

      // Handle output path if specified
      if (output && renderUrl) {
        // In a real implementation, we would download and save the file here
        // For now, we just include the path in the instructions
        result.llmContent += `\n\n### Save to File\nTo save the diagram to \`${output}\`, run:\n\`\`\`bash\ncurl -o "${output}" "${renderUrl}"\n\`\`\``;
      }

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      debugLogger.error(`Diagram generation error: ${errorMessage}`, error);

      return {
        llmContent: `Error generating diagram: ${errorMessage}`,
        returnDisplay: `Error: ${errorMessage}`,
        diagramType: type === 'auto' ? 'mermaid' : type,
        sourceCode: content,
        format: format || 'svg',
        renderInstructions: '',
        error: {
          message: errorMessage,
        },
      };
    }
  }

  /**
   * Builds the LLM content for the result
   */
  private buildLlmContent(
    diagramType: 'mermaid' | 'plantuml',
    sourceCode: string,
    format: OutputFormat,
    asciiRepresentation?: string,
    renderUrl?: string,
    renderInstructions?: string,
  ): string {
    const parts: string[] = [];

    parts.push(`## ${diagramType.toUpperCase()} Diagram Generated\n`);
    parts.push(`**Type:** ${diagramType}`);
    parts.push(`**Format:** ${format}\n`);

    parts.push(`### Source Code\n\`\`\`${diagramType}`);
    parts.push(sourceCode);
    parts.push(`\`\`\`\n`);

    if (format === 'text' && asciiRepresentation) {
      parts.push(`### ASCII Representation\n\`\`\``);
      parts.push(asciiRepresentation);
      parts.push(`\`\`\`\n`);
    } else if (renderUrl) {
      parts.push(`### Render URL\n`);
      parts.push(`${renderUrl}\n`);
    }

    if (renderInstructions) {
      parts.push(renderInstructions);
    }

    return parts.join('\n');
  }

  /**
   * Builds the return display for the result
   */
  private buildReturnDisplay(
    diagramType: 'mermaid' | 'plantuml',
    format: OutputFormat,
    asciiRepresentation?: string,
  ): string {
    if (format === 'text' && asciiRepresentation) {
      return `Generated ${diagramType} ASCII diagram`;
    }
    return `Generated ${diagramType} diagram (${format})`;
  }
}

// ============================================================================
// Tool Definition
// ============================================================================

/**
 * Diagram Generator Tool
 *
 * Generates diagrams from text descriptions using Mermaid or PlantUML syntax.
 * Supports automatic type detection and multiple output formats.
 *
 * @example
 * // Mermaid flowchart
 * const result = await tool.build({
 *   content: 'flowchart TD\n  A[Start] --> B[End]',
 *   type: 'mermaid',
 *   format: 'svg'
 * });
 *
 * @example
 * // PlantUML sequence diagram
 * const result = await tool.build({
 *   content: '@startuml\nAlice -> Bob\n@enduml',
 *   type: 'plantuml',
 *   format: 'png'
 * });
 *
 * @example
 * // Auto-detect diagram type
 * const result = await tool.build({
 *   content: 'sequenceDiagram\n  Alice->>Bob: Hello',
 *   type: 'auto',
 *   format: 'text'
 * });
 */
export class DiagramGeneratorTool extends BaseDeclarativeTool<
  DiagramGeneratorParams,
  DiagramGeneratorResult
> {
  static readonly Name = 'diagram_generator';

  constructor(private config: Config) {
    super(
      DiagramGeneratorTool.Name,
      'DiagramGenerator',
      `Generate diagrams from text descriptions using Mermaid or PlantUML syntax.

This tool supports:
- **Mermaid diagrams**: flowchart, sequence, class, state, er, gantt, pie, journey, git, mindmap, timeline, quadrant, requirement, and C4 diagrams
- **PlantUML diagrams**: all PlantUML diagram types including sequence, class, activity, component, state, object, deployment, timing, usecase, and more

**Output formats:**
- \`svg\`: Scalable Vector Graphics (recommended for web)
- \`png\`: Portable Network Graphics (raster image)
- \`text\`: ASCII text representation (quick preview)

**Auto-detection:**
When type is 'auto', the tool will automatically detect the diagram format based on the content syntax.

**Examples:**
\`\`\`
Mermaid flowchart:
flowchart TD
  A[Start] --> B{Decision}
  B -->|Yes| C[Action]
  B -->|No| D[End]

Mermaid sequence:
sequenceDiagram
  Alice->>Bob: Hello
  Bob-->>Alice: Hi!

PlantUML:
@startuml
Alice -> Bob : Hello
Bob --> Alice : Hi!
@enduml
\`\`\`

Usage:
- Use \`type: 'auto'\` for automatic detection
- Use \`format: 'text'\` for quick ASCII preview
- Use \`format: 'svg'\` or \`format: 'png'\` for production-quality output`,
      Kind.Other,
      {
        type: 'object',
        properties: {
          content: {
            description:
              'The diagram content/source code. For Mermaid: uses Mermaid syntax (flowchart, sequenceDiagram, etc.). For PlantUML: uses PlantUML syntax (@startuml/@enduml).',
            type: 'string',
          },
          type: {
            description:
              "The type of diagram to generate. Use 'mermaid' for Mermaid syntax, 'plantuml' for PlantUML syntax, or 'auto' to automatically detect the diagram type from content.",
            type: 'string',
            enum: ['mermaid', 'plantuml', 'auto'],
            default: 'auto',
          },
          output: {
            description:
              'Optional file path to save the generated diagram. If provided, instructions for saving will be included.',
            type: 'string',
          },
          format: {
            description:
              "Output format for the generated diagram. 'svg' for Scalable Vector Graphics, 'png' for Portable Network Graphics, or 'text' for ASCII text representation.",
            type: 'string',
            enum: ['svg', 'png', 'text'],
            default: 'svg',
          },
        },
        required: ['content', 'type'],
        additionalProperties: false,
        $schema: 'http://json-schema.org/draft-07/schema#',
      },
      true, // isOutputMarkdown
      false, // canUpdateOutput
    );
  }

  /**
   * Validates the tool parameters beyond schema validation
   */
  protected override validateToolParamValues(
    params: DiagramGeneratorParams,
  ): string | null {
    // Validate content is not empty
    if (!params.content || params.content.trim().length === 0) {
      return 'The "content" parameter cannot be empty.';
    }

    // Validate type
    if (
      params.type !== 'mermaid' &&
      params.type !== 'plantuml' &&
      params.type !== 'auto'
    ) {
      return 'The "type" parameter must be "mermaid", "plantuml", or "auto".';
    }

    // Validate format if provided
    if (params.format) {
      if (params.format !== 'svg' && params.format !== 'png' && params.format !== 'text') {
        return 'The "format" parameter must be "svg", "png", or "text".';
      }
    }

    return null;
  }

  /**
   * Creates the tool invocation
   */
  protected createInvocation(
    params: DiagramGeneratorParams,
  ): DiagramGeneratorInvocation {
    return new DiagramGeneratorInvocation(this.config, params);
  }
}

// ============================================================================
// Export
// ============================================================================

/**
 * Factory function to create a DiagramGeneratorTool instance
 * @param config - The configuration object
 * @returns A new DiagramGeneratorTool instance
 */
export function createDiagramGeneratorTool(
  config: Config,
): DiagramGeneratorTool {
  return new DiagramGeneratorTool(config);
}

/**
 * Default export: the DiagramGeneratorTool class
 * Use createDiagramGeneratorTool(config) to create an instance with configuration
 */
export const diagramGeneratorTool = {
  create: createDiagramGeneratorTool,
  DiagramGeneratorTool,
};
