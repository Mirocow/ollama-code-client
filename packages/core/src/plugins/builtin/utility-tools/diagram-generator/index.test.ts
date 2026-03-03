/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  DiagramGeneratorParams,
  DiagramType,
  OutputFormat} from './index.js';
import {
  DiagramGeneratorTool,
  createDiagramGeneratorTool,
} from './index.js';
import type { Config } from '../../../../config/config.js';

// Mock Config
const mockConfig = {
  getTargetDir: () => '/test/project',
  getWorkspaceContext: () => ({
    getDirectories: () => ['/test/project'],
    isPathWithinWorkspace: () => true,
  }),
  getFileSystemService: () => ({
    readTextFile: vi.fn(),
    writeTextFile: vi.fn(),
  }),
  getShouldUseNodePtyShell: () => false,
  getDebugMode: () => false,
  getSessionId: () => 'test-session',
} as unknown as Config;

describe('DiagramGeneratorTool', () => {
  let tool: DiagramGeneratorTool;

  beforeEach(() => {
    tool = new DiagramGeneratorTool(mockConfig);
  });

  describe('Tool Definition', () => {
    it('should have correct name', () => {
      expect(DiagramGeneratorTool.Name).toBe('diagram_generator');
    });

    it('should have correct display name', () => {
      expect(tool.displayName).toBe('DiagramGenerator');
    });

    it('should have description', () => {
      expect(tool.description).toContain('diagram');
    });

    it('should have valid parameter schema', () => {
      expect(tool.parameterSchema).toBeDefined();
      expect(tool.parameterSchema.type).toBe('object');
      expect(tool.parameterSchema.properties).toHaveProperty('content');
      expect(tool.parameterSchema.properties).toHaveProperty('type');
    });
  });

  describe('Parameter Validation', () => {
    it('should require content parameter', () => {
      const params = { type: 'mermaid' as DiagramType } as DiagramGeneratorParams;
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('content');
    });

    it('should require type parameter', () => {
      const params = { content: 'graph TD' } as DiagramGeneratorParams;
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('type');
    });

    it('should validate valid params', () => {
      const params: DiagramGeneratorParams = {
        content: 'flowchart TD\n  A[Start] --> B[End]',
        type: 'mermaid',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });

    it('should reject empty content', () => {
      const params: DiagramGeneratorParams = {
        content: '',
        type: 'mermaid',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('content');
    });

    it('should reject whitespace-only content', () => {
      const params: DiagramGeneratorParams = {
        content: '   ',
        type: 'mermaid',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('content');
    });
  });

  describe('Diagram Types', () => {
    const validTypes: DiagramType[] = ['mermaid', 'plantuml', 'auto'];

    validTypes.forEach((type) => {
      it(`should accept '${type}' type`, () => {
        const params: DiagramGeneratorParams = {
          content: 'flowchart TD\n  A --> B',
          type,
        };
        const error = tool.validateToolParamValues(params);
        expect(error).toBeNull();
      });
    });

    it('should reject invalid type', () => {
      const params = {
        content: 'flowchart TD\n  A --> B',
        type: 'invalid',
      } as unknown as DiagramGeneratorParams;
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('type');
    });
  });

  describe('Output Formats', () => {
    const validFormats: OutputFormat[] = ['svg', 'png', 'text'];

    validFormats.forEach((format) => {
      it(`should accept '${format}' format`, () => {
        const params: DiagramGeneratorParams = {
          content: 'flowchart TD\n  A --> B',
          type: 'mermaid',
          format,
        };
        const error = tool.validateToolParamValues(params);
        expect(error).toBeNull();
      });
    });

    it('should reject invalid format', () => {
      const params = {
        content: 'flowchart TD\n  A --> B',
        type: 'mermaid',
        format: 'pdf',
      } as unknown as DiagramGeneratorParams;
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('format');
    });
  });

  describe('Output Path', () => {
    it('should accept output path', () => {
      const params: DiagramGeneratorParams = {
        content: 'flowchart TD\n  A --> B',
        type: 'mermaid',
        output: '/output/diagram.svg',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });
  });
});

describe('DiagramGeneratorToolInvocation', () => {
  let tool: DiagramGeneratorTool;

  beforeEach(() => {
    tool = new DiagramGeneratorTool(mockConfig);
  });

  it('should create invocation with valid params', () => {
    const params: DiagramGeneratorParams = {
      content: 'flowchart TD\n  A --> B',
      type: 'mermaid',
    };
    const invocation = tool['createInvocation'](params);
    expect(invocation).toBeDefined();
    expect(invocation.getDescription()).toContain('mermaid');
  });

  it('should create invocation for plantuml type', () => {
    const params: DiagramGeneratorParams = {
      content: '@startuml\nAlice -> Bob\n@enduml',
      type: 'plantuml',
    };
    const invocation = tool['createInvocation'](params);
    expect(invocation.getDescription()).toContain('plantuml');
  });

  it('should create invocation for auto type', () => {
    const params: DiagramGeneratorParams = {
      content: 'flowchart TD\n  A --> B',
      type: 'auto',
    };
    const invocation = tool['createInvocation'](params);
    expect(invocation.getDescription()).toContain('auto-detect');
  });

  it('should create invocation with output path', () => {
    const params: DiagramGeneratorParams = {
      content: 'flowchart TD\n  A --> B',
      type: 'mermaid',
      output: '/output/diagram.svg',
    };
    const invocation = tool['createInvocation'](params);
    expect(invocation.getDescription()).toContain('diagram.svg');
  });

  it('should create invocation with format', () => {
    const params: DiagramGeneratorParams = {
      content: 'flowchart TD\n  A --> B',
      type: 'mermaid',
      format: 'png',
    };
    const invocation = tool['createInvocation'](params);
    expect(invocation.getDescription()).toContain('png');
  });
});

describe('createDiagramGeneratorTool', () => {
  it('should create tool instance', () => {
    const tool = createDiagramGeneratorTool(mockConfig);
    expect(tool).toBeInstanceOf(DiagramGeneratorTool);
  });
});

describe('Mermaid Diagram Detection', () => {
  const tool = new DiagramGeneratorTool(mockConfig);

  it('should detect flowchart mermaid diagrams', () => {
    const params: DiagramGeneratorParams = {
      content: 'flowchart TD\n  A[Start] --> B[End]',
      type: 'auto',
    };
    const error = tool.validateToolParamValues(params);
    expect(error).toBeNull();
  });

  it('should detect sequence diagrams', () => {
    const params: DiagramGeneratorParams = {
      content: 'sequenceDiagram\n  Alice->>Bob: Hello',
      type: 'auto',
    };
    const error = tool.validateToolParamValues(params);
    expect(error).toBeNull();
  });

  it('should detect class diagrams', () => {
    const params: DiagramGeneratorParams = {
      content: 'classDiagram\n  class Animal { +String name }',
      type: 'auto',
    };
    const error = tool.validateToolParamValues(params);
    expect(error).toBeNull();
  });

  it('should detect state diagrams', () => {
    const params: DiagramGeneratorParams = {
      content: 'stateDiagram-v2\n  [*] --> Active',
      type: 'auto',
    };
    const error = tool.validateToolParamValues(params);
    expect(error).toBeNull();
  });

  it('should detect er diagrams', () => {
    const params: DiagramGeneratorParams = {
      content: 'erDiagram\n  USER ||--o{ ORDER : places',
      type: 'auto',
    };
    const error = tool.validateToolParamValues(params);
    expect(error).toBeNull();
  });

  it('should detect gantt diagrams', () => {
    const params: DiagramGeneratorParams = {
      content: 'gantt\n  title Project Schedule',
      type: 'auto',
    };
    const error = tool.validateToolParamValues(params);
    expect(error).toBeNull();
  });
});

describe('PlantUML Detection', () => {
  const tool = new DiagramGeneratorTool(mockConfig);

  it('should detect plantuml diagrams with @startuml', () => {
    const params: DiagramGeneratorParams = {
      content: '@startuml\nAlice -> Bob\n@enduml',
      type: 'auto',
    };
    const error = tool.validateToolParamValues(params);
    expect(error).toBeNull();
  });

  it('should detect plantuml mindmaps', () => {
    const params: DiagramGeneratorParams = {
      content: '@startmindmap\n* Root\n** Branch\n@endmindmap',
      type: 'auto',
    };
    const error = tool.validateToolParamValues(params);
    expect(error).toBeNull();
  });

  it('should detect plantuml salt diagrams', () => {
    const params: DiagramGeneratorParams = {
      content: '@startsalt\n{A|B}\n@endsalt',
      type: 'auto',
    };
    const error = tool.validateToolParamValues(params);
    expect(error).toBeNull();
  });

  it('should detect plantuml gantt', () => {
    const params: DiagramGeneratorParams = {
      content: '@startgantt\n[Task 1] lasts 5 days\n@endgantt',
      type: 'auto',
    };
    const error = tool.validateToolParamValues(params);
    expect(error).toBeNull();
  });

  it('should detect plantuml wbs', () => {
    const params: DiagramGeneratorParams = {
      content: '@startwbs\n* Project\n** Task 1\n@endwbs',
      type: 'auto',
    };
    const error = tool.validateToolParamValues(params);
    expect(error).toBeNull();
  });
});
