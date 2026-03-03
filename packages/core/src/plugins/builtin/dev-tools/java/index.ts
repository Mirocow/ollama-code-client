/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import fs from 'node:fs';
import type { Config } from '../../../../config/config.js';
import { ToolErrorType } from '../../../../tools/tool-error.js';
import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  ToolConfirmationOutcome,
  Kind,
  type ToolInvocation,
  type ToolResult,
  type ToolResultDisplay,
  type ToolCallConfirmationDetails,
} from '../../../../tools/tools.js';
import { getErrorMessage } from '../../../../utils/errors.js';
import type { ShellExecutionConfig } from '../../../../services/shellExecutionService.js';
import { ShellExecutionService } from '../../../../services/shellExecutionService.js';
import { createDebugLogger } from '../../../../utils/debugLogger.js';
import type { AnsiOutput } from '../../../../utils/terminalSerializer.js';

import { abortSignalAny } from '../../../../utils/nodePolyfills.js';
const debugLogger = createDebugLogger('JAVA');

export const DEFAULT_JAVA_TIMEOUT_MS = 120000;

export type JavaBuildTool = 'maven' | 'gradle';

export type JavaAction =
  | 'run' // Run a Java class
  | 'r' // Alias for run
  | 'compile' // Compile Java files
  | 'c' // Alias for compile
  | 'test' // Run tests
  | 't' // Alias for test
  | 'build' // Build project
  | 'b' // Alias for build
  | 'clean' // Clean build artifacts
  | 'maven_compile' // Maven compile
  | 'mc' // Alias for maven_compile
  | 'maven_test' // Maven test
  | 'mt' // Alias for maven_test
  | 'maven_package' // Maven package
  | 'mp' // Alias for maven_package
  | 'maven_install' // Maven install
  | 'mi' // Alias for maven_install
  | 'maven_clean' // Maven clean
  | 'mcl' // Alias for maven_clean
  | 'maven_dependency_tree' // Show dependency tree
  | 'mdt' // Alias for maven_dependency_tree
  | 'maven_exec' // Execute Maven goal
  | 'gradle_build' // Gradle build
  | 'gb' // Alias for gradle_build
  | 'gradle_test' // Gradle test
  | 'gt' // Alias for gradle_test
  | 'gradle_clean' // Gradle clean
  | 'gcl' // Alias for gradle_clean
  | 'gradle_run' // Gradle run (application plugin)
  | 'gr' // Alias for gradle_run
  | 'gradle_tasks' // List Gradle tasks
  | 'gls' // Alias for gradle_tasks
  | 'gradle_dependency_tree' // Show dependency tree
  | 'gdt' // Alias for gradle_dependency_tree
  | 'gradle_exec' // Execute Gradle task
  | 'jar' // Create JAR file
  | 'custom'; // Custom Java command

// Action aliases mapping
const ACTION_ALIASES: Record<string, JavaAction> = {
  r: 'run',
  c: 'compile',
  t: 'test',
  b: 'build',
  mc: 'maven_compile',
  mt: 'maven_test',
  mp: 'maven_package',
  mi: 'maven_install',
  mcl: 'maven_clean',
  mdt: 'maven_dependency_tree',
  gb: 'gradle_build',
  gt: 'gradle_test',
  gcl: 'gradle_clean',
  gr: 'gradle_run',
  gls: 'gradle_tasks',
  gdt: 'gradle_dependency_tree',
};

export interface JavaToolParams {
  action: JavaAction;
  build_tool?: JavaBuildTool;
  class?: string; // Main class name for run
  file?: string; // Java file path for compile
  args?: string[]; // Additional arguments
  directory?: string; // Working directory
  output?: string; // Output directory/file
  timeout?: number;
  classpath?: string; // Classpath for compilation/run
  main_class?: string; // Main class for JAR/run
  goal?: string; // Maven goal or Gradle task
  profile?: string; // Maven profile
  command?: string; // Custom command
  description?: string;
}

export class JavaToolInvocation extends BaseToolInvocation<
  JavaToolParams,
  ToolResult
> {
  constructor(
    private readonly config: Config,
    params: JavaToolParams,
    private readonly allowlist: Set<string>,
  ) {
    super(params);
  }

  getDescription(): string {
    const parts: string[] = [`Java ${this.params.action}`];
    const buildTool = this.params.build_tool || this.detectBuildTool();

    if (buildTool) {
      parts.push(`(${buildTool})`);
    }

    if (this.params.class) {
      parts.push(`class: ${this.params.class}`);
    }
    if (this.params.file) {
      parts.push(`file: ${this.params.file}`);
    }
    if (this.params.goal) {
      parts.push(`goal: ${this.params.goal}`);
    }
    if (this.params.directory) {
      parts.push(`[in ${this.params.directory}]`);
    }
    if (this.params.description) {
      parts.push(`(${this.params.description})`);
    }

    return parts.join(' ');
  }

  override async shouldConfirmExecute(
    _abortSignal: AbortSignal,
  ): Promise<ToolCallConfirmationDetails | false> {
    // Actions that modify the project need confirmation
    const needsConfirmation = [
      'maven_install',
      'clean',
      'maven_clean',
      'gradle_clean',
    ].includes(this.params.action);

    if (!needsConfirmation) {
      return false;
    }

    const command = this.buildCommand();
    const confirmationDetails: ToolCallConfirmationDetails = {
      type: 'exec',
      title: `Confirm Java ${this.params.action}`,
      command,
      rootCommand: 'java',
      onConfirm: async (outcome: ToolConfirmationOutcome) => {
        if (outcome === ToolConfirmationOutcome.ProceedAlways) {
          this.allowlist.add('java');
          this.allowlist.add('javac');
          this.allowlist.add('mvn');
          this.allowlist.add('gradle');
        }
      },
    };

    return confirmationDetails;
  }

  private detectBuildTool(): JavaBuildTool | null {
    const cwd = this.params.directory || this.config.getTargetDir();

    // Check for build files
    if (fs.existsSync(path.join(cwd, 'pom.xml'))) {
      return 'maven';
    }
    if (
      fs.existsSync(path.join(cwd, 'build.gradle')) ||
      fs.existsSync(path.join(cwd, 'build.gradle.kts')) ||
      fs.existsSync(path.join(cwd, 'settings.gradle')) ||
      fs.existsSync(path.join(cwd, 'settings.gradle.kts'))
    ) {
      return 'gradle';
    }

    return null;
  }

  private buildCommand(): string {
    // Resolve action alias
    const action = ACTION_ALIASES[this.params.action] || this.params.action;

    switch (action) {
      case 'run':
        return this.buildRunCommand();

      case 'compile':
        return this.buildCompileCommand();

      case 'test':
        return this.buildTestCommand();

      case 'build':
        return this.buildBuildCommand();

      case 'clean':
        return this.buildCleanCommand();

      case 'maven_compile':
        return this.buildMavenCompileCommand();

      case 'maven_test':
        return this.buildMavenTestCommand();

      case 'maven_package':
        return this.buildMavenPackageCommand();

      case 'maven_install':
        return this.buildMavenInstallCommand();

      case 'maven_clean':
        return this.buildMavenCleanCommand();

      case 'maven_dependency_tree':
        return this.buildMavenDependencyTreeCommand();

      case 'maven_exec':
        return this.buildMavenExecCommand();

      case 'gradle_build':
        return this.buildGradleBuildCommand();

      case 'gradle_test':
        return this.buildGradleTestCommand();

      case 'gradle_clean':
        return this.buildGradleCleanCommand();

      case 'gradle_run':
        return this.buildGradleRunCommand();

      case 'gradle_tasks':
        return this.buildGradleTasksCommand();

      case 'gradle_dependency_tree':
        return this.buildGradleDependencyTreeCommand();

      case 'gradle_exec':
        return this.buildGradleExecCommand();

      case 'jar':
        return this.buildJarCommand();

      case 'custom':
        return this.params.command || '';

      default:
        return '';
    }
  }

  private buildRunCommand(): string {
    const parts = ['java'];
    if (this.params.classpath) {
      parts.push('-cp', this.params.classpath);
    }
    if (this.params.class) {
      parts.push(this.params.class);
    }
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    return parts.join(' ');
  }

  private buildCompileCommand(): string {
    const parts = ['javac'];
    if (this.params.output) {
      parts.push('-d', this.params.output);
    }
    if (this.params.classpath) {
      parts.push('-cp', this.params.classpath);
    }
    if (this.params.file) {
      parts.push(this.params.file);
    } else {
      parts.push('*.java');
    }
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    return parts.join(' ');
  }

  private buildTestCommand(): string {
    const buildTool =
      this.params.build_tool || this.detectBuildTool() || 'maven';
    if (buildTool === 'gradle') {
      return this.buildGradleTestCommand();
    }
    return this.buildMavenTestCommand();
  }

  private buildBuildCommand(): string {
    const buildTool =
      this.params.build_tool || this.detectBuildTool() || 'maven';
    if (buildTool === 'gradle') {
      return this.buildGradleBuildCommand();
    }
    return this.buildMavenPackageCommand();
  }

  private buildCleanCommand(): string {
    const buildTool =
      this.params.build_tool || this.detectBuildTool() || 'maven';
    if (buildTool === 'gradle') {
      return this.buildGradleCleanCommand();
    }
    return this.buildMavenCleanCommand();
  }

  private buildMavenCompileCommand(): string {
    const parts = ['mvn', 'compile'];
    if (this.params.profile) {
      parts.push('-P', this.params.profile);
    }
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    return parts.join(' ');
  }

  private buildMavenTestCommand(): string {
    const parts = ['mvn', 'test'];
    if (this.params.profile) {
      parts.push('-P', this.params.profile);
    }
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    return parts.join(' ');
  }

  private buildMavenPackageCommand(): string {
    const parts = ['mvn', 'package'];
    if (this.params.profile) {
      parts.push('-P', this.params.profile);
    }
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    return parts.join(' ');
  }

  private buildMavenInstallCommand(): string {
    const parts = ['mvn', 'install'];
    if (this.params.profile) {
      parts.push('-P', this.params.profile);
    }
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    return parts.join(' ');
  }

  private buildMavenCleanCommand(): string {
    const parts = ['mvn', 'clean'];
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    return parts.join(' ');
  }

  private buildMavenDependencyTreeCommand(): string {
    const parts = ['mvn', 'dependency:tree'];
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    return parts.join(' ');
  }

  private buildMavenExecCommand(): string {
    const parts = ['mvn'];
    if (this.params.goal) {
      parts.push(this.params.goal);
    }
    if (this.params.profile) {
      parts.push('-P', this.params.profile);
    }
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    return parts.join(' ');
  }

  private buildGradleBuildCommand(): string {
    const parts = ['gradle', 'build'];
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    return parts.join(' ');
  }

  private buildGradleTestCommand(): string {
    const parts = ['gradle', 'test'];
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    return parts.join(' ');
  }

  private buildGradleCleanCommand(): string {
    const parts = ['gradle', 'clean'];
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    return parts.join(' ');
  }

  private buildGradleRunCommand(): string {
    const parts = ['gradle', 'run'];
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    return parts.join(' ');
  }

  private buildGradleTasksCommand(): string {
    const parts = ['gradle', 'tasks'];
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    return parts.join(' ');
  }

  private buildGradleDependencyTreeCommand(): string {
    const parts = ['gradle', 'dependencies'];
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    return parts.join(' ');
  }

  private buildGradleExecCommand(): string {
    const parts = ['gradle'];
    if (this.params.goal) {
      parts.push(this.params.goal);
    }
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    return parts.join(' ');
  }

  private buildJarCommand(): string {
    const parts = ['jar', 'cfe'];
    if (this.params.output) {
      parts.push(this.params.output);
    } else {
      parts.push('output.jar');
    }
    if (this.params.main_class) {
      parts.push(this.params.main_class);
    }
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    } else {
      parts.push('-C', 'build/classes', '.');
    }
    return parts.join(' ');
  }

  async execute(
    signal: AbortSignal,
    updateOutput?: (output: ToolResultDisplay) => void,
    shellExecutionConfig?: ShellExecutionConfig,
  ): Promise<ToolResult> {
    if (signal.aborted) {
      return {
        llmContent: 'Java command was cancelled by user before it could start.',
        returnDisplay: 'Command cancelled by user.',
      };
    }

    const command = this.buildCommand();
    if (!command) {
      return {
        llmContent: 'Invalid Java action or missing required parameters.',
        returnDisplay: 'Error: Invalid Java action.',
        error: {
          message: 'Invalid Java action or missing required parameters.',
          type: ToolErrorType.INVALID_TOOL_PARAMS,
        },
      };
    }

    const effectiveTimeout = this.params.timeout ?? DEFAULT_JAVA_TIMEOUT_MS;
    let combinedSignal = signal;
    if (effectiveTimeout) {
      const timeoutSignal = AbortSignal.timeout(effectiveTimeout);
      combinedSignal = abortSignalAny([signal, timeoutSignal]);
    }

    const cwd = this.params.directory || this.config.getTargetDir();
    let cumulativeOutput: string | AnsiOutput = '';
    let lastUpdateTime = Date.now();

    try {
      const { result: resultPromise } = await ShellExecutionService.execute(
        command,
        cwd,
        (event) => {
          if (event.type === 'data') {
            cumulativeOutput = event.chunk;
            if (updateOutput && Date.now() - lastUpdateTime > 1000) {
              updateOutput(
                typeof cumulativeOutput === 'string'
                  ? cumulativeOutput
                  : { ansiOutput: cumulativeOutput },
              );
              lastUpdateTime = Date.now();
            }
          }
        },
        combinedSignal,
        this.config.getShouldUseNodePtyShell(),
        shellExecutionConfig ?? {},
      );

      const result = await resultPromise;

      let llmContent = '';
      if (result.aborted) {
        const wasTimeout =
          effectiveTimeout && combinedSignal.aborted && !signal.aborted;
        llmContent = wasTimeout
          ? `Java command timed out after ${effectiveTimeout}ms.`
          : 'Java command was cancelled by user.';
        if (result.output.trim()) {
          llmContent += `\nOutput before ${wasTimeout ? 'timeout' : 'cancellation'}:\n${result.output}`;
        }
      } else {
        llmContent = [
          `Action: ${this.params.action}`,
          `Command: ${command}`,
          `Directory: ${cwd}`,
          `Output: ${result.output || '(empty)'}`,
          `Exit Code: ${result.exitCode ?? '(none)'}`,
        ].join('\n');
      }

      const executionError = result.error
        ? {
            error: {
              message: result.error.message,
              type: ToolErrorType.SHELL_EXECUTE_ERROR,
            },
          }
        : {};

      return {
        llmContent,
        returnDisplay: result.output || llmContent,
        ...executionError,
      };
    } catch (error) {
      debugLogger.error('Java tool execution failed:', error);
      return {
        llmContent: `Java command failed: ${getErrorMessage(error)}`,
        returnDisplay: `Error: ${getErrorMessage(error)}`,
        error: {
          message: getErrorMessage(error),
          type: ToolErrorType.SHELL_EXECUTE_ERROR,
        },
      };
    }
  }
}

function getJavaToolDescription(): string {
  return `Java development tool for managing Java projects with Maven or Gradle.

**Supported Build Tools:**
- Maven (detected by pom.xml)
- Gradle (detected by build.gradle / build.gradle.kts)

The tool auto-detects the build tool based on project files.

**Available Actions:**

1. **run** - Run a Java class
   - Requires: \`class\` (fully qualified class name)
   - Optional: \`classpath\` (classpath for the class)

2. **compile** - Compile Java files
   - Optional: \`file\` (Java file or pattern, defaults to *.java)
   - Optional: \`output\` (output directory)
   - Optional: \`classpath\` (classpath for compilation)

3. **test** - Run tests (auto-detects build tool)
   - Optional: \`build_tool\` (maven or gradle)
   - Optional: \`args\` (additional test arguments)

4. **build** - Build project (auto-detects build tool)
   - Optional: \`build_tool\` (maven or gradle)
   - Optional: \`args\` (additional build arguments)

5. **clean** - Clean build artifacts (auto-detects build tool)
   - Optional: \`build_tool\` (maven or gradle)

6. **maven_compile** - Maven compile
   - Optional: \`profile\` (Maven profile)
   - Optional: \`args\` (additional arguments)

7. **maven_test** - Maven test
   - Optional: \`profile\` (Maven profile)
   - Optional: \`args\` (additional arguments)

8. **maven_package** - Maven package
   - Optional: \`profile\` (Maven profile)
   - Optional: \`args\` (additional arguments)

9. **maven_install** - Maven install
   - Optional: \`profile\` (Maven profile)
   - Optional: \`args\` (additional arguments)

10. **maven_clean** - Maven clean

11. **maven_dependency_tree** - Show Maven dependency tree
    - Optional: \`args\` (additional arguments)

12. **maven_exec** - Execute Maven goal
    - Requires: \`goal\` (Maven goal to execute)
    - Optional: \`profile\` (Maven profile)

13. **gradle_build** - Gradle build
    - Optional: \`args\` (additional arguments)

14. **gradle_test** - Gradle test
    - Optional: \`args\` (additional arguments)

15. **gradle_clean** - Gradle clean
    - Optional: \`args\` (additional arguments)

16. **gradle_run** - Run application (requires application plugin)
    - Optional: \`args\` (additional arguments)

17. **gradle_tasks** - List available Gradle tasks
    - Optional: \`args\` (additional arguments)

18. **gradle_dependency_tree** - Show Gradle dependencies
    - Optional: \`args\` (additional arguments)

19. **gradle_exec** - Execute Gradle task
    - Requires: \`goal\` (task to execute)

20. **jar** - Create JAR file
    - Optional: \`output\` (JAR file name)
    - Optional: \`main_class\` (main class for executable JAR)

21. **custom** - Run custom Java command
    - Requires: \`command\` (custom command string)

**Common Parameters:**
- \`directory\`: Working directory (defaults to project root)
- \`timeout\`: Timeout in milliseconds (default: 120000, max: 600000)
- \`description\`: Brief description of the action

**Examples:**

\`\`\`json
// Run a Java class
{
  "action": "run",
  "class": "com.example.Main",
  "classpath": "target/classes:lib/*"
}

// Compile Java files
{
  "action": "compile",
  "file": "src/main/java/com/example/*.java",
  "output": "target/classes"
}

// Run Maven tests
{
  "action": "maven_test",
  "args": ["-Dtest=UserServiceTest"]
}

// Build with Gradle
{
  "action": "gradle_build",
  "args": ["--parallel"]
}

// Create JAR file
{
  "action": "jar",
  "output": "myapp.jar",
  "main_class": "com.example.Main"
}

// Show Maven dependency tree
{
  "action": "maven_dependency_tree"
}

// Run Gradle task
{
  "action": "gradle_exec",
  "goal": "bootRun"
}
\`\`\`
`;
}

export class JavaTool extends BaseDeclarativeTool<JavaToolParams, ToolResult> {
  static Name: string = 'java_dev';
  private allowlist: Set<string> = new Set();

  constructor(private readonly config: Config) {
    super(
      JavaTool.Name,
      'JavaDev',
      getJavaToolDescription(),
      Kind.Execute,
      {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: [
              'run',
              'r',
              'compile',
              'c',
              'test',
              't',
              'build',
              'b',
              'clean',
              'maven_compile',
              'mc',
              'maven_test',
              'mt',
              'maven_package',
              'mp',
              'maven_install',
              'mi',
              'maven_clean',
              'mcl',
              'maven_dependency_tree',
              'mdt',
              'maven_exec',
              'gradle_build',
              'gb',
              'gradle_test',
              'gt',
              'gradle_clean',
              'gcl',
              'gradle_run',
              'gr',
              'gradle_tasks',
              'gls',
              'gradle_dependency_tree',
              'gdt',
              'gradle_exec',
              'jar',
              'custom',
            ],
            description: 'The Java action to perform',
          },
          build_tool: {
            type: 'string',
            enum: ['maven', 'gradle'],
            description: 'Build tool to use (auto-detected if not specified)',
          },
          class: {
            type: 'string',
            description: 'Main class name for run action',
          },
          file: {
            type: 'string',
            description: 'Java file path for compile action',
          },
          args: {
            type: 'array',
            items: { type: 'string' },
            description: 'Additional arguments for the action',
          },
          directory: {
            type: 'string',
            description: 'Working directory for the command',
          },
          output: {
            type: 'string',
            description: 'Output directory or file name',
          },
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds (max 600000)',
          },
          classpath: {
            type: 'string',
            description: 'Classpath for compilation and execution',
          },
          main_class: {
            type: 'string',
            description: 'Main class for JAR creation',
          },
          goal: {
            type: 'string',
            description: 'Maven goal or Gradle task to execute',
          },
          profile: {
            type: 'string',
            description: 'Maven profile to activate',
          },
          command: {
            type: 'string',
            description: 'Custom command for custom action',
          },
          description: {
            type: 'string',
            description: 'Brief description of the action',
          },
        },
        required: ['action'],
      },
      false,
      true,
    );
  }

  protected override validateToolParamValues(
    params: JavaToolParams,
  ): string | null {
    if (!params.action) {
      return 'Action is required.';
    }

    if (params.action === 'run' && !params.class) {
      return 'Class name is required for run action.';
    }

    if (params.action === 'maven_exec' && !params.goal) {
      return 'Goal is required for maven_exec action.';
    }

    if (params.action === 'gradle_exec' && !params.goal) {
      return 'Goal is required for gradle_exec action.';
    }

    if (params.action === 'custom' && !params.command) {
      return 'Command is required for custom action.';
    }

    if (params.timeout !== undefined) {
      if (params.timeout <= 0 || params.timeout > 600000) {
        return 'Timeout must be between 1 and 600000ms.';
      }
    }

    if (params.directory) {
      if (!path.isAbsolute(params.directory)) {
        return 'Directory must be an absolute path.';
      }
      const workspaceDirs = this.config.getWorkspaceContext().getDirectories();
      const isWithinWorkspace = workspaceDirs.some((wsDir) =>
        params.directory!.startsWith(wsDir),
      );
      if (!isWithinWorkspace) {
        return `Directory '${params.directory}' is not within the workspace.`;
      }
    }

    return null;
  }

  protected createInvocation(
    params: JavaToolParams,
  ): ToolInvocation<JavaToolParams, ToolResult> {
    return new JavaToolInvocation(this.config, params, this.allowlist);
  }
}
