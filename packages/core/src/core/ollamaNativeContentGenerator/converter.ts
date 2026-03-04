/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Converter for transforming between Google GenAI format and native Ollama format.
 * This allows using the native Ollama API (/api/chat, /api/generate) instead of
 * the OpenAI-compatible API.
 */

import type {
  GenerateContentParameters,
  Part,
  Content,
  Tool,
  ToolListUnion,
  CallableTool,
  FunctionResponse,
  ContentListUnion,
  ContentUnion,
  PartUnion,
} from '../../types/content.js';
import { FinishReason, GenerateContentResponse } from '../../types/content.js';
import type {
  OllamaChatMessage,
  OllamaTool,
  OllamaToolCall,
  OllamaChatRequest,
  OllamaChatResponse,
  OllamaModelOptions,
} from '../ollamaNativeClient.js';

import { createDebugLogger } from '../../utils/debugLogger.js';
import { getModelHandlerFactory } from '../../model-handlers/index.js';

const debugLogger = createDebugLogger('OLLAMA_CONVERTER');

/**
 * Converter class for transforming data between GenAI and native Ollama formats
 */
export class OllamaContentConverter {
  private model: string;

  constructor(model: string) {
    this.model = model;
  }

  /**
   * Update the model used for response metadata
   */
  setModel(model: string): void {
    this.model = model;
  }

  /**
   * Convert GenAI request to native Ollama chat request format
   */
  convertGenAIRequestToOllama(
    request: GenerateContentParameters,
  ): OllamaChatRequest {
    const messages: OllamaChatMessage[] = [];

    // Handle system instruction from config
    const systemInstruction = this.extractSystemInstruction(request);

    // Process contents
    this.processContents(request.contents, messages);

    // Build options from config
    const options: OllamaModelOptions = this.buildModelOptions(request);

    // Build the request
    const ollamaRequest: OllamaChatRequest = {
      model: this.model,
      messages,
      stream: false,
      options,
    };

    // Add system instruction if present
    if (systemInstruction) {
      // Ollama handles system messages as part of the messages array
      messages.unshift({
        role: 'system',
        content: systemInstruction,
      });
    }

    // Add tools if present (tools are in config)
    const tools = this.convertGenAIToolsToOllama(request.config?.tools);
    if (tools.length > 0) {
      ollamaRequest.tools = tools;
    }

    return ollamaRequest;
  }

  /**
   * Extract system instruction from request config
   */
  private extractSystemInstruction(
    request: GenerateContentParameters,
  ): string | null {
    if (!request.config?.systemInstruction) return null;
    return this.extractTextFromContentUnion(request.config.systemInstruction);
  }

  /**
   * Build Ollama model options from request config
   */
  private buildModelOptions(
    request: GenerateContentParameters,
  ): OllamaModelOptions {
    const options: OllamaModelOptions = {};
    const config = request.config;

    if (!config) return options;

    // Map generation config to Ollama options
    if (config.temperature !== undefined) {
      options.temperature = config.temperature;
    }
    if (config.topP !== undefined) {
      options.top_p = config.topP;
    }
    if (config.topK !== undefined) {
      options.top_k = config.topK;
    }
    if (config.maxOutputTokens !== undefined) {
      options.num_predict = config.maxOutputTokens;
    }
    if (config.stopSequences && config.stopSequences.length > 0) {
      options.stop = config.stopSequences;
    }

    return options;
  }

  /**
   * Convert GenAI tools to native Ollama format
   */
  convertGenAIToolsToOllama(
    genaiTools: ToolListUnion | undefined,
  ): OllamaTool[] {
    if (!genaiTools) return [];

    const ollamaTools: OllamaTool[] = [];
    const toolsArray = Array.isArray(genaiTools) ? genaiTools : [genaiTools];

    for (const tool of toolsArray) {
      let actualTool: Tool;

      // Handle CallableTool vs Tool
      if ('tool' in tool) {
        // CallableTool - need to get the actual tool asynchronously
        // For now, skip async tools in sync context
        continue;
      } else {
        actualTool = tool as Tool;
      }

      if (actualTool.functionDeclarations) {
        for (const func of actualTool.functionDeclarations) {
          if (func.name && func.description) {
            let parameters: Record<string, unknown> | undefined;

            // Handle both Gemini tools (parameters) and MCP tools (parametersJsonSchema)
            if (func.parametersJsonSchema) {
              parameters = {
                ...(func.parametersJsonSchema as Record<string, unknown>),
              };
            } else if (func.parameters) {
              parameters = this.convertParametersToOllama(
                func.parameters as Record<string, unknown>,
              );
            }

            ollamaTools.push({
              type: 'function',
              function: {
                name: func.name,
                description: func.description,
                parameters: parameters || {},
              },
            });
          }
        }
      }
    }

    return ollamaTools;
  }

  /**
   * Convert tools asynchronously (for CallableTool support)
   */
  async convertGenAIToolsToOllamaAsync(
    genaiTools: ToolListUnion | undefined,
  ): Promise<OllamaTool[]> {
    if (!genaiTools) return [];

    const ollamaTools: OllamaTool[] = [];
    const toolsArray = Array.isArray(genaiTools) ? genaiTools : [genaiTools];

    debugLogger.debug('Converting tools to Ollama format', {
      toolsCount: toolsArray.length,
    });

    for (const tool of toolsArray) {
      let actualTool: Tool;

      // Handle CallableTool vs Tool
      if ('tool' in tool) {
        actualTool = await (tool as CallableTool).tool();
      } else {
        actualTool = tool as Tool;
      }

      if (actualTool.functionDeclarations) {
        for (const func of actualTool.functionDeclarations) {
          if (func.name && func.description) {
            let parameters: Record<string, unknown> | undefined;

            // Handle both Gemini tools (parameters) and MCP tools (parametersJsonSchema)
            if (func.parametersJsonSchema) {
              parameters = {
                ...(func.parametersJsonSchema as Record<string, unknown>),
              };
            } else if (func.parameters) {
              parameters = this.convertParametersToOllama(
                func.parameters as Record<string, unknown>,
              );
            }

            ollamaTools.push({
              type: 'function',
              function: {
                name: func.name,
                description: func.description,
                parameters: parameters || {},
              },
            });
          }
        }
      }
    }

    debugLogger.info('Converted tools for Ollama', {
      count: ollamaTools.length,
      toolNames: ollamaTools.map((t) => t.function.name),
    });

    return ollamaTools;
  }

  /**
   * Convert parameters to Ollama format
   */
  private convertParametersToOllama(
    parameters: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    if (!parameters || typeof parameters !== 'object') {
      return parameters;
    }

    const converted = JSON.parse(JSON.stringify(parameters));

    const convertTypes = (obj: unknown): unknown => {
      if (typeof obj !== 'object' || obj === null) {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(convertTypes);
      }

      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (key === 'type' && typeof value === 'string') {
          result[key] = value.toLowerCase();
        } else if (typeof value === 'object') {
          result[key] = convertTypes(value);
        } else {
          result[key] = value;
        }
      }
      return result;
    };

    return convertTypes(converted) as Record<string, unknown> | undefined;
  }

  /**
   * Process contents and convert to Ollama messages
   */
  private processContents(
    contents: ContentListUnion,
    messages: OllamaChatMessage[],
  ): void {
    if (Array.isArray(contents)) {
      for (const content of contents) {
        this.processContent(content, messages);
      }
    } else if (contents) {
      this.processContent(contents, messages);
    }
  }

  /**
   * Process a single content item and convert to Ollama message(s)
   */
  private processContent(
    content: ContentUnion | PartUnion,
    messages: OllamaChatMessage[],
  ): void {
    if (typeof content === 'string') {
      messages.push({ role: 'user', content });
      return;
    }

    if (!this.isContentObject(content)) return;

    const parts = content.parts || [];
    const role = content.role === 'model' ? 'assistant' : 'user';

    const contentParts: string[] = [];
    const images: string[] = [];
    const toolCalls: OllamaToolCall[] = [];

    for (const part of parts) {
      if (typeof part === 'string') {
        contentParts.push(part);
        continue;
      }

      // Handle text content (skip thought parts)
      if ('text' in part && part.text && !('thought' in part && part.thought)) {
        contentParts.push(part.text);
      }

      // Handle inline images (base64)
      if (
        part.inlineData?.mimeType?.startsWith('image/') &&
        part.inlineData?.data
      ) {
        images.push(part.inlineData.data);
      }

      // Handle function calls (assistant messages)
      if ('functionCall' in part && part.functionCall && role === 'assistant') {
        toolCalls.push({
          function: {
            name: part.functionCall.name || '',
            arguments: part.functionCall.args || {},
          },
        });
      }

      // Handle function responses (user messages)
      if (part.functionResponse && role === 'user') {
        const toolMessage = this.createToolMessage(part.functionResponse);
        if (toolMessage) {
          messages.push(toolMessage);
        }
      }
    }

    // Build the message
    const message: OllamaChatMessage = {
      role: role as 'system' | 'user' | 'assistant' | 'tool',
      content: contentParts.join(''),
    };

    if (images.length > 0) {
      message.images = images;
    }

    if (toolCalls.length > 0) {
      message.tool_calls = toolCalls;
    }

    // Only add message if it has content or tool calls
    if (message.content || message.tool_calls) {
      messages.push(message);
    }
  }

  /**
   * Create a tool message from function response
   */
  private createToolMessage(
    response: FunctionResponse,
  ): OllamaChatMessage | null {
    const textContent = this.extractFunctionResponseContent(response.response);

    const message: OllamaChatMessage = {
      role: 'tool',
      content: textContent,
    };

    // Ollama requires tool_name for tool role messages
    if (response.name) {
      message.tool_name = response.name;
    }

    debugLogger.debug('Created tool message', {
      toolName: response.name,
      contentLength: textContent.length,
    });

    return message;
  }

  /**
   * Extract content from function response
   */
  private extractFunctionResponseContent(response: unknown): string {
    if (response === null || response === undefined) {
      return '';
    }

    if (typeof response === 'string') {
      return response;
    }

    if (typeof response === 'object') {
      const responseObject = response as Record<string, unknown>;
      const output = responseObject['output'];
      if (typeof output === 'string') {
        return output;
      }

      const error = responseObject['error'];
      if (typeof error === 'string') {
        return error;
      }
    }

    try {
      return JSON.stringify(response);
    } catch {
      return String(response);
    }
  }

  /**
   * Parse tool calls from text content when model returns them in text format.
   * Uses the model handler factory to get the appropriate parser for the model.
   *
   * @see {@link ../../model-handlers/README.md} for adding new model support
   */
  private parseToolCallsFromText(content: string): {
    toolCalls: Array<{ name: string; args: Record<string, unknown> }>;
    cleanedContent: string;
  } {
    const factory = getModelHandlerFactory();
    return factory.parseToolCalls(this.model, content);
  }

  /**
   * Convert native Ollama response to GenAI format
   */
  convertOllamaResponseToGenAI(
    ollamaResponse: OllamaChatResponse,
  ): GenerateContentResponse {
    const response = new GenerateContentResponse();
    const parts: Part[] = [];

    // Log the response for debugging
    debugLogger.debug('Converting Ollama response', {
      hasContent: !!ollamaResponse.message?.content,
      contentLength: ollamaResponse.message?.content?.length,
      hasToolCalls: !!ollamaResponse.message?.tool_calls,
      toolCallsCount: ollamaResponse.message?.tool_calls?.length,
      toolCalls: ollamaResponse.message?.tool_calls?.map(
        (tc) => tc.function.name,
      ),
      done: ollamaResponse.done,
    });

    // Handle tool calls from structured response
    if (ollamaResponse.message?.tool_calls) {
      debugLogger.info('Processing tool calls from response', {
        count: ollamaResponse.message.tool_calls.length,
        tools: ollamaResponse.message.tool_calls.map((tc) => tc.function.name),
      });
      for (const toolCall of ollamaResponse.message.tool_calls) {
        parts.push({
          functionCall: {
            id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            name: toolCall.function.name,
            args: toolCall.function.arguments,
          },
        });
      }
    }

    // Handle text content - also parse for embedded tool calls
    if (ollamaResponse.message?.content) {
      const content = ollamaResponse.message.content;

      // Try to parse tool calls from text content (for models that don't return structured tool_calls)
      const { toolCalls: parsedToolCalls, cleanedContent } =
        this.parseToolCallsFromText(content);

      if (parsedToolCalls.length > 0) {
        debugLogger.info('Parsed tool calls from text content', {
          count: parsedToolCalls.length,
          tools: parsedToolCalls.map((tc) => tc.name),
          arguments: parsedToolCalls.map((tc) => ({
            name: tc.name,
            args: tc.args,
          })),
        });

        for (const tc of parsedToolCalls) {
          parts.push({
            functionCall: {
              id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
              name: tc.name,
              args: tc.args,
            },
          });
        }
      }

      // Add cleaned text content if not empty
      if (cleanedContent.trim()) {
        parts.unshift({ text: cleanedContent });
      }
    }

    response.responseId = `ollama-${Date.now()}`;
    response.createTime = new Date().getTime().toString();

    // Determine finish reason - use TOOL_CALLS if there are tool calls
    const hasToolCalls = parts.some((p) => p.functionCall);
    const finishReason = ollamaResponse.done
      ? hasToolCalls
        ? FinishReason.TOOL_CALLS
        : FinishReason.STOP
      : FinishReason.FINISH_REASON_UNSPECIFIED;

    response.candidates = [
      {
        content: {
          parts,
          role: 'model' as const,
        },
        finishReason,
        index: 0,
        safetyRatings: [],
      },
    ];

    // Set functionCalls for convenience (used by turn.ts)
    if (hasToolCalls) {
      response.functionCalls = parts
        .filter((p) => p.functionCall)
        .map((p) => p.functionCall!);
      debugLogger.info('Set functionCalls on response', {
        count: response.functionCalls.length,
      });
    }

    response.modelVersion = this.model;
    response.promptFeedback = { safetyRatings: [] };

    // Add usage metadata if available
    if (
      ollamaResponse.prompt_eval_count !== undefined ||
      ollamaResponse.eval_count !== undefined
    ) {
      response.usageMetadata = {
        promptTokenCount: ollamaResponse.prompt_eval_count || 0,
        candidatesTokenCount: ollamaResponse.eval_count || 0,
        totalTokenCount:
          (ollamaResponse.prompt_eval_count || 0) +
          (ollamaResponse.eval_count || 0),
      };
    }

    return response;
  }

  /**
   * Convert streaming Ollama response chunk to GenAI format
   */
  convertOllamaChunkToGenAI(
    ollamaChunk: OllamaChatResponse,
    accumulatedToolCalls?: Map<number, { name: string; args: string }>,
    accumulatedContent?: { text: string },
  ): GenerateContentResponse {
    const response = new GenerateContentResponse();
    const parts: Part[] = [];

    // Log chunk details for debugging
    if (ollamaChunk.message?.tool_calls || ollamaChunk.done) {
      debugLogger.debug('Converting Ollama chunk', {
        hasContent: !!ollamaChunk.message?.content,
        hasToolCalls: !!ollamaChunk.message?.tool_calls,
        toolCallsCount: ollamaChunk.message?.tool_calls?.length,
        toolCalls: ollamaChunk.message?.tool_calls?.map((tc) => ({
          name: tc.function.name,
          hasArgs: !!tc.function.arguments,
        })),
        done: ollamaChunk.done,
        doneType: typeof ollamaChunk.done,
        accumulatedToolCallsSize: accumulatedToolCalls?.size,
        hasAccumulatedToolCalls: !!accumulatedToolCalls,
      });
    }

    // Log ALL chunks with done=true for debugging
    if (ollamaChunk.done) {
      debugLogger.info('Chunk with done=true received', {
        hasMessage: !!ollamaChunk.message,
        hasToolCallsInMessage: !!ollamaChunk.message?.tool_calls,
        accumulatedToolCallsSize: accumulatedToolCalls?.size,
        willEmit: accumulatedToolCalls && accumulatedToolCalls.size > 0,
      });
    }

    // Accumulate content for text-based tool call parsing
    if (accumulatedContent && ollamaChunk.message?.content) {
      accumulatedContent.text += ollamaChunk.message.content;
    }

    // Handle text content
    if (ollamaChunk.message?.content) {
      parts.push({ text: ollamaChunk.message.content });
    }

    // Handle tool calls in streaming - accumulate tool calls from chunks
    if (ollamaChunk.message?.tool_calls && accumulatedToolCalls) {
      for (let i = 0; i < ollamaChunk.message.tool_calls.length; i++) {
        const toolCall = ollamaChunk.message.tool_calls[i];
        if (toolCall.function.name) {
          debugLogger.info('Accumulating tool call', {
            index: i,
            name: toolCall.function.name,
          });
          accumulatedToolCalls.set(i, {
            name: toolCall.function.name,
            args: JSON.stringify(toolCall.function.arguments),
          });
        }
      }
    }

    // If stream is done, emit all accumulated tool calls
    // NOTE: This must be OUTSIDE the tool_calls check above, because the final
    // chunk with done=true may not contain tool_calls, but we still need to emit
    // the previously accumulated ones.
    const shouldEmitToolCalls =
      ollamaChunk.done &&
      accumulatedToolCalls &&
      accumulatedToolCalls.size > 0;

    debugLogger.debug('Tool calls emit check', {
      done: ollamaChunk.done,
      hasAccumulatedToolCalls: !!accumulatedToolCalls,
      accumulatedSize: accumulatedToolCalls?.size,
      shouldEmit: shouldEmitToolCalls,
    });

    if (shouldEmitToolCalls) {
      debugLogger.info('Emitting accumulated tool calls', {
        count: accumulatedToolCalls.size,
        tools: [...accumulatedToolCalls.values()].map((tc) => tc.name),
      });
      for (const [_idx, toolCall] of accumulatedToolCalls) {
        parts.push({
          functionCall: {
            id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            name: toolCall.name,
            args: JSON.parse(toolCall.args || '{}'),
          },
        });
      }
    }

    // Parse tool calls from accumulated text content when stream is done
    // This handles models that return tool calls in text format
    if (
      ollamaChunk.done &&
      accumulatedContent &&
      accumulatedContent.text &&
      (!accumulatedToolCalls || accumulatedToolCalls.size === 0)
    ) {
      const { toolCalls: parsedToolCalls, cleanedContent } =
        this.parseToolCallsFromText(accumulatedContent.text);

      if (parsedToolCalls.length > 0) {
        debugLogger.info('Parsed tool calls from streaming text content', {
          count: parsedToolCalls.length,
          tools: parsedToolCalls.map((tc) => tc.name),
          arguments: parsedToolCalls.map((tc) => ({
            name: tc.name,
            args: tc.args,
          })),
        });

        for (const tc of parsedToolCalls) {
          parts.push({
            functionCall: {
              id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
              name: tc.name,
              args: tc.args,
            },
          });
        }

        // Update accumulated content with cleaned version
        accumulatedContent.text = cleanedContent;
      }
    }

    response.responseId = `ollama-${Date.now()}`;
    response.createTime = new Date().getTime().toString();

    // Determine if there are tool calls
    const hasToolCalls = parts.some((p) => p.functionCall);

    const candidate: {
      content: { parts: Part[]; role: string };
      index: number;
      safetyRatings: never[];
      finishReason?: FinishReason;
    } = {
      content: {
        parts,
        role: 'model' as const,
      },
      index: 0,
      safetyRatings: [],
    };

    if (ollamaChunk.done) {
      candidate.finishReason = hasToolCalls
        ? FinishReason.TOOL_CALLS
        : FinishReason.STOP;
    }

    response.candidates = [candidate];

    // Set functionCalls for convenience (used by turn.ts)
    if (hasToolCalls) {
      response.functionCalls = parts
        .filter((p) => p.functionCall)
        .map((p) => p.functionCall!);
    }

    response.modelVersion = this.model;
    response.promptFeedback = { safetyRatings: [] };

    // Add usage metadata if available (in final chunk with done=true)
    if (
      ollamaChunk.done &&
      (ollamaChunk.prompt_eval_count !== undefined ||
        ollamaChunk.eval_count !== undefined)
    ) {
      response.usageMetadata = {
        promptTokenCount: ollamaChunk.prompt_eval_count || 0,
        candidatesTokenCount: ollamaChunk.eval_count || 0,
        totalTokenCount:
          (ollamaChunk.prompt_eval_count || 0) + (ollamaChunk.eval_count || 0),
      };
    }

    return response;
  }

  /**
   * Type guard to check if content is a valid Content object
   */
  private isContentObject(
    content: unknown,
  ): content is { role: string; parts: Part[] } {
    return (
      typeof content === 'object' &&
      content !== null &&
      'role' in content &&
      'parts' in content &&
      Array.isArray((content as Record<string, unknown>)['parts'])
    );
  }

  /**
   * Extract text content from various GenAI content union types
   */
  private extractTextFromContentUnion(contentUnion: unknown): string {
    if (typeof contentUnion === 'string') {
      return contentUnion;
    }

    if (Array.isArray(contentUnion)) {
      return contentUnion
        .map((item) => this.extractTextFromContentUnion(item))
        .filter(Boolean)
        .join('\n');
    }

    if (typeof contentUnion === 'object' && contentUnion !== null) {
      if ('parts' in contentUnion) {
        const content = contentUnion as Content;
        return (
          content.parts
            ?.map((part: Part) => {
              if (typeof part === 'string') return part;
              if ('text' in part) return part.text || '';
              return '';
            })
            .filter(Boolean)
            .join('\n') || ''
        );
      }
    }

    return '';
  }
}
