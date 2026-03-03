/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Tests for OllamaContentConverter.
 * Tests conversion between GenAI and native Ollama formats.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OllamaContentConverter } from './converter.js';
import { FinishReason, Type } from '../../types/content.js';
import type { OllamaChatResponse } from '../ollamaNativeClient.js';

describe('OllamaContentConverter', () => {
  let converter: OllamaContentConverter;

  beforeEach(() => {
    converter = new OllamaContentConverter('llama3.2');
  });

  describe('setModel', () => {
    it('should update the model', () => {
      converter.setModel('llava');
      expect(converter).toBeDefined();
    });
  });

  describe('convertGenAIRequestToOllama', () => {
    it('should convert basic text request', () => {
      const genaiRequest = {
        model: 'llama3.2',
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Hello, World!' }],
          },
        ],
      };

      const result = converter.convertGenAIRequestToOllama(genaiRequest);

      expect(result.model).toBe('llama3.2');
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content).toBe('Hello, World!');
    });

    it('should convert multi-turn conversation', () => {
      const genaiRequest = {
        model: 'llama3.2',
        contents: [
          { role: 'user', parts: [{ text: 'Hi!' }] },
          { role: 'model', parts: [{ text: 'Hello!' }] },
          { role: 'user', parts: [{ text: 'How are you?' }] },
        ],
      };

      const result = converter.convertGenAIRequestToOllama(genaiRequest);

      expect(result.messages).toHaveLength(3);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[1].role).toBe('assistant');
      expect(result.messages[2].role).toBe('user');
    });

    it('should convert system instruction', () => {
      const genaiRequest = {
        model: 'llama3.2',
        contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
        config: {
          systemInstruction: 'You are a helpful assistant.',
        },
      };

      const result = converter.convertGenAIRequestToOllama(genaiRequest);

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].role).toBe('system');
      expect(result.messages[0].content).toBe('You are a helpful assistant.');
    });

    it('should convert system instruction from Content object', () => {
      const genaiRequest = {
        model: 'llama3.2',
        contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
        config: {
          systemInstruction: {
            role: 'system',
            parts: [{ text: 'Be concise.' }, { text: 'Be accurate.' }],
          },
        },
      };

      const result = converter.convertGenAIRequestToOllama(genaiRequest);

      expect(result.messages[0].role).toBe('system');
      expect(result.messages[0].content).toBe('Be concise.\nBe accurate.');
    });

    it('should convert generation config options', () => {
      const genaiRequest = {
        model: 'llama3.2',
        contents: [{ role: 'user', parts: [{ text: 'Test' }] }],
        config: {
          temperature: 0.7,
          topP: 0.9,
          topK: 40,
          maxOutputTokens: 100,
          stopSequences: ['END'],
        },
      };

      const result = converter.convertGenAIRequestToOllama(genaiRequest);

      expect(result.options?.temperature).toBe(0.7);
      expect(result.options?.top_p).toBe(0.9);
      expect(result.options?.top_k).toBe(40);
      expect(result.options?.num_predict).toBe(100);
      expect(result.options?.stop).toContain('END');
    });

    it('should convert inline images', () => {
      const genaiRequest = {
        model: 'llava',
        contents: [
          {
            role: 'user',
            parts: [
              { text: 'What is in this image?' },
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: 'base64imagedata',
                },
              },
            ],
          },
        ],
      };

      const result = converter.convertGenAIRequestToOllama(genaiRequest);

      expect(result.messages[0].images).toBeDefined();
      expect(result.messages[0].images).toContain('base64imagedata');
    });

    it('should convert function calls in assistant messages', () => {
      const genaiRequest = {
        model: 'llama3.2',
        contents: [
          { role: 'user', parts: [{ text: 'What is the weather?' }] },
          {
            role: 'model',
            parts: [
              {
                functionCall: {
                  id: 'call_123',
                  name: 'get_weather',
                  args: { location: 'San Francisco' },
                },
              },
            ],
          },
        ],
      };

      const result = converter.convertGenAIRequestToOllama(genaiRequest);

      expect(result.messages[1].tool_calls).toBeDefined();
      expect(result.messages[1].tool_calls?.[0].function.name).toBe('get_weather');
      expect(result.messages[1].tool_calls?.[0].function.arguments).toEqual({
        location: 'San Francisco',
      });
    });

    it('should convert function responses in user messages', () => {
      const genaiRequest = {
        model: 'llama3.2',
        contents: [
          { role: 'user', parts: [{ text: 'What is the weather?' }] },
          {
            role: 'model',
            parts: [
              {
                functionCall: {
                  id: 'call_123',
                  name: 'get_weather',
                  args: { location: 'San Francisco' },
                },
              },
            ],
          },
          {
            role: 'user',
            parts: [
              {
                functionResponse: {
                  id: 'call_123',
                  name: 'get_weather',
                  response: { temperature: 72, condition: 'sunny' },
                },
              },
            ],
          },
        ],
      };

      const result = converter.convertGenAIRequestToOllama(genaiRequest);

      // Function response should be converted to tool message
      expect(result.messages).toHaveLength(3);
    });

    it('should convert string contents', () => {
      const genaiRequest = {
        model: 'llama3.2',
        contents: ['Hello, World!'],
      };

      const result = converter.convertGenAIRequestToOllama(genaiRequest);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content).toBe('Hello, World!');
    });

    it('should filter out thought parts', () => {
      const genaiRequest = {
        model: 'llama3.2',
        contents: [
          {
            role: 'assistant',
            parts: [
              { text: 'Thinking...', thought: true },
              { text: 'Hello!' },
            ],
          },
        ],
      };

      const result = converter.convertGenAIRequestToOllama(genaiRequest);

      expect(result.messages[0].content).toBe('Hello!');
    });
  });

  describe('convertGenAIToolsToOllama', () => {
    it('should convert tools', () => {
      const genaiTools = [
        {
          functionDeclarations: [
            {
              name: 'get_weather',
              description: 'Get the current weather',
              parameters: {
                type: Type.OBJECT,
                properties: {
                  location: { type: Type.STRING },
                },
                required: ['location'],
              },
            },
          ],
        },
      ] as any;

      const result = converter.convertGenAIToolsToOllama(genaiTools);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('function');
      expect(result[0].function.name).toBe('get_weather');
      expect(result[0].function.description).toBe('Get the current weather');
      expect(result[0].function.parameters).toBeDefined();
    });

    it('should convert tools with parametersJsonSchema', () => {
      const genaiTools = [
        {
          functionDeclarations: [
            {
              name: 'calculate',
              description: 'Perform a calculation',
              parametersJsonSchema: {
                type: 'object',
                properties: {
                  expression: { type: 'string' },
                },
              },
            },
          ],
        },
      ];

      const result = converter.convertGenAIToolsToOllama(genaiTools as any);

      expect(result).toHaveLength(1);
      expect(result[0].function.parameters).toEqual({
        type: 'object',
        properties: {
          expression: { type: 'string' },
        },
      });
    });

    it('should return empty array for undefined tools', () => {
      const result = converter.convertGenAIToolsToOllama(undefined);
      expect(result).toEqual([]);
    });

    it('should skip tools without name or description', () => {
      const genaiTools = [
        {
          functionDeclarations: [
            { name: 'valid_tool', description: 'A valid tool' },
            { name: 'no_description' }, // Missing description
            { description: 'no_name' }, // Missing name
          ],
        },
      ];

      const result = converter.convertGenAIToolsToOllama(genaiTools as any);
      expect(result).toHaveLength(1);
    });
  });

  describe('convertOllamaResponseToGenAI', () => {
    it('should convert basic text response', () => {
      const ollamaResponse: OllamaChatResponse = {
        model: 'llama3.2',
        created_at: '2024-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: 'Hello, World!',
        },
        done: true,
        prompt_eval_count: 10,
        eval_count: 5,
      };

      const result = converter.convertOllamaResponseToGenAI(ollamaResponse);

      expect(result.candidates).toBeDefined();
      const candidate = result.candidates?.[0];
      expect(candidate).toBeDefined();
      expect(candidate?.content?.parts).toHaveLength(1);
      expect((candidate?.content?.parts as any)?.[0]).toHaveProperty('text', 'Hello, World!');
      expect(candidate?.finishReason).toBe(FinishReason.STOP);
    });

    it('should convert response with tool calls', () => {
      const ollamaResponse: OllamaChatResponse = {
        model: 'llama3.2',
        created_at: '2024-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              function: {
                name: 'get_weather',
                arguments: { location: 'San Francisco' },
              },
            },
          ],
        },
        done: true,
      };

      const result = converter.convertOllamaResponseToGenAI(ollamaResponse);
      const candidate = result.candidates?.[0];

      expect(candidate?.content?.parts).toHaveLength(1);
      expect((candidate?.content?.parts as any)?.[0]).toHaveProperty('functionCall');
      const functionCall = ((candidate?.content?.parts as any)?.[0])?.functionCall;
      expect(functionCall.name).toBe('get_weather');
      expect(functionCall.args).toEqual({ location: 'San Francisco' });
    });

    it('should convert response with text and tool calls', () => {
      const ollamaResponse: OllamaChatResponse = {
        model: 'llama3.2',
        created_at: '2024-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: 'Let me check the weather.',
          tool_calls: [
            {
              function: {
                name: 'get_weather',
                arguments: { location: 'San Francisco' },
              },
            },
          ],
        },
        done: true,
      };

      const result = converter.convertOllamaResponseToGenAI(ollamaResponse);
      const candidate = result.candidates?.[0];

      expect(candidate?.content?.parts).toHaveLength(2);
      expect((candidate?.content?.parts as any)?.[0]).toHaveProperty('text');
      expect((candidate?.content?.parts as any)?.[1]).toHaveProperty('functionCall');
    });

    it('should include usage metadata', () => {
      const ollamaResponse: OllamaChatResponse = {
        model: 'llama3.2',
        created_at: '2024-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: 'Hello!',
        },
        done: true,
        prompt_eval_count: 100,
        eval_count: 50,
        total_duration: 1000000000,
      };

      const result = converter.convertOllamaResponseToGenAI(ollamaResponse);

      expect(result.usageMetadata).toBeDefined();
      expect(result.usageMetadata?.promptTokenCount).toBe(100);
      expect(result.usageMetadata?.candidatesTokenCount).toBe(50);
      expect(result.usageMetadata?.totalTokenCount).toBe(150);
    });

    it('should set finish reason based on done flag', () => {
      const ollamaResponseDone: OllamaChatResponse = {
        model: 'llama3.2',
        created_at: '2024-01-01T00:00:00Z',
        message: { role: 'assistant', content: 'Done' },
        done: true,
      };

      const ollamaResponseNotDone: OllamaChatResponse = {
        model: 'llama3.2',
        created_at: '2024-01-01T00:00:00Z',
        message: { role: 'assistant', content: 'Processing...' },
        done: false,
      };

      const resultDone = converter.convertOllamaResponseToGenAI(ollamaResponseDone);
      const resultNotDone = converter.convertOllamaResponseToGenAI(ollamaResponseNotDone);

      expect(resultDone.candidates?.[0]?.finishReason).toBe(FinishReason.STOP);
      expect(resultNotDone.candidates?.[0]?.finishReason).toBe(FinishReason.FINISH_REASON_UNSPECIFIED);
    });

    it('should set model version', () => {
      const ollamaResponse: OllamaChatResponse = {
        model: 'llama3.2',
        created_at: '2024-01-01T00:00:00Z',
        message: { role: 'assistant', content: 'Hello' },
        done: true,
      };

      const result = converter.convertOllamaResponseToGenAI(ollamaResponse);

      expect(result.modelVersion).toBe('llama3.2');
    });
  });

  describe('convertOllamaChunkToGenAI', () => {
    it('should convert streaming chunk', () => {
      const ollamaChunk: OllamaChatResponse = {
        model: 'llama3.2',
        created_at: '2024-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: 'Hello',
        },
        done: false,
      };

      const result = converter.convertOllamaChunkToGenAI(ollamaChunk);
      const candidate = result.candidates?.[0];

      expect(candidate?.content?.parts).toHaveLength(1);
      expect((candidate?.content?.parts as any)?.[0]).toHaveProperty('text', 'Hello');
    });

    it('should convert final streaming chunk', () => {
      const ollamaChunk: OllamaChatResponse = {
        model: 'llama3.2',
        created_at: '2024-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: 'World!',
        },
        done: true,
        eval_count: 10,
      };

      const result = converter.convertOllamaChunkToGenAI(ollamaChunk);

      expect(result.candidates?.[0]?.finishReason).toBe(FinishReason.STOP);
    });

    it('should handle tool calls in streaming', () => {
      const toolCallAccumulator = new Map<number, { name: string; args: string }>();

      const ollamaChunk: OllamaChatResponse = {
        model: 'llama3.2',
        created_at: '2024-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              function: {
                name: 'get_weather',
                arguments: { location: 'SF' },
              },
            },
          ],
        },
        done: true,
      };

      const result = converter.convertOllamaChunkToGenAI(ollamaChunk, toolCallAccumulator);
      const candidate = result.candidates?.[0];

      expect(candidate?.content?.parts).toHaveLength(1);
      expect((candidate?.content?.parts as any)?.[0]).toHaveProperty('functionCall');
    });

    it('should emit tool calls when done chunk comes separately from tool_calls chunk', () => {
      // This test covers the bug fix where tool_calls were not emitted when:
      // - Chunk 1: has tool_calls but done=false (accumulate tool calls)
      // - Chunk 2: has done=true but no tool_calls (should emit accumulated tool calls)
      const toolCallAccumulator = new Map<number, { name: string; args: string }>();

      // Chunk 1: Contains tool_calls, but not done yet
      const chunk1: OllamaChatResponse = {
        model: 'llama3.2',
        created_at: '2024-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              function: {
                name: 'list_directory',
                arguments: { path: '/home' },
              },
            },
          ],
        },
        done: false,
      };

      const result1 = converter.convertOllamaChunkToGenAI(chunk1, toolCallAccumulator);

      // Tool call should be accumulated
      expect(toolCallAccumulator.size).toBe(1);
      // But NOT emitted yet (no functionCall in parts)
      expect(result1.functionCalls).toBeUndefined();

      // Chunk 2: Final chunk with done=true, but NO tool_calls
      const chunk2: OllamaChatResponse = {
        model: 'llama3.2',
        created_at: '2024-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: '',
        },
        done: true,
        eval_count: 10,
      };

      const result2 = converter.convertOllamaChunkToGenAI(chunk2, toolCallAccumulator);
      const candidate = result2.candidates?.[0];

      // NOW tool calls should be emitted!
      expect(result2.functionCalls).toBeDefined();
      expect(result2.functionCalls).toHaveLength(1);
      expect(result2.functionCalls?.[0].name).toBe('list_directory');
      expect(result2.functionCalls?.[0].args).toEqual({ path: '/home' });
      expect(candidate?.finishReason).toBe(FinishReason.TOOL_CALLS);
    });

    it('should emit multiple tool calls when done chunk comes separately', () => {
      // Test for multiple tool calls accumulated before done chunk
      const toolCallAccumulator = new Map<number, { name: string; args: string }>();

      // Chunk with multiple tool_calls
      const chunk1: OllamaChatResponse = {
        model: 'llama3.2',
        created_at: '2024-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              function: {
                name: 'read_file',
                arguments: { path: '/file1.txt' },
              },
            },
            {
              function: {
                name: 'read_file',
                arguments: { path: '/file2.txt' },
              },
            },
          ],
        },
        done: false,
      };

      const result1 = converter.convertOllamaChunkToGenAI(chunk1, toolCallAccumulator);
      expect(toolCallAccumulator.size).toBe(2);
      expect(result1.functionCalls).toBeUndefined();

      // Done chunk
      const chunk2: OllamaChatResponse = {
        model: 'llama3.2',
        created_at: '2024-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: '',
        },
        done: true,
      };

      const result2 = converter.convertOllamaChunkToGenAI(chunk2, toolCallAccumulator);

      expect(result2.functionCalls).toBeDefined();
      expect(result2.functionCalls).toHaveLength(2);
      expect(result2.functionCalls?.[0].name).toBe('read_file');
      expect(result2.functionCalls?.[1].name).toBe('read_file');
    });

    it('should not emit tool calls when accumulator is empty on done', () => {
      // Test that no tool calls are emitted when done=true but accumulator is empty
      const toolCallAccumulator = new Map<number, { name: string; args: string }>();

      const chunk: OllamaChatResponse = {
        model: 'llama3.2',
        created_at: '2024-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: 'Just a text response',
        },
        done: true,
      };

      const result = converter.convertOllamaChunkToGenAI(chunk, toolCallAccumulator);

      expect(result.functionCalls).toBeUndefined();
      expect(result.candidates?.[0]?.finishReason).toBe(FinishReason.STOP);
    });

    it('should handle chunk without accumulatedToolCalls parameter', () => {
      // Test that the function works without the optional accumulatedToolCalls parameter
      const chunk: OllamaChatResponse = {
        model: 'llama3.2',
        created_at: '2024-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: 'Hello',
        },
        done: true,
      };

      // Should not throw when accumulatedToolCalls is undefined
      expect(() => converter.convertOllamaChunkToGenAI(chunk)).not.toThrow();
    });

    it('should accumulate content across chunks', () => {
      const accumulatedContent = { text: '' };
      const chunks = ['Hello', ' ', 'World', '!'];

      let result: ReturnType<typeof converter.convertOllamaChunkToGenAI>;

      for (let i = 0; i < chunks.length; i++) {
        const chunk: OllamaChatResponse = {
          model: 'llama3.2',
          created_at: '2024-01-01T00:00:00Z',
          message: {
            role: 'assistant',
            content: chunks[i],
          },
          done: i === chunks.length - 1,
        };
        result = converter.convertOllamaChunkToGenAI(chunk, undefined, accumulatedContent);
      }

      expect(accumulatedContent.text).toBe('Hello World!');
      expect(result!.candidates?.[0]?.finishReason).toBe(FinishReason.STOP);
    });

    it('should emit tool calls even when done chunk has content', () => {
      // Test that tool calls are still emitted when done chunk has text content
      const toolCallAccumulator = new Map<number, { name: string; args: string }>();

      // Accumulate tool call
      const chunk1: OllamaChatResponse = {
        model: 'llama3.2',
        created_at: '2024-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              function: {
                name: 'get_weather',
                arguments: { city: 'Paris' },
              },
            },
          ],
        },
        done: false,
      };
      converter.convertOllamaChunkToGenAI(chunk1, toolCallAccumulator);

      // Done chunk with text content
      const chunk2: OllamaChatResponse = {
        model: 'llama3.2',
        created_at: '2024-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: 'Done processing',
        },
        done: true,
      };

      const result = converter.convertOllamaChunkToGenAI(chunk2, toolCallAccumulator);

      expect(result.functionCalls).toBeDefined();
      expect(result.functionCalls).toHaveLength(1);
      expect(result.functionCalls?.[0].name).toBe('get_weather');
    });

    it('should handle tool call with empty arguments', () => {
      const toolCallAccumulator = new Map<number, { name: string; args: string }>();

      const chunk: OllamaChatResponse = {
        model: 'llama3.2',
        created_at: '2024-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              function: {
                name: 'noop',
                arguments: {},
              },
            },
          ],
        },
        done: true,
      };

      const result = converter.convertOllamaChunkToGenAI(chunk, toolCallAccumulator);

      expect(result.functionCalls).toBeDefined();
      expect(result.functionCalls).toHaveLength(1);
      expect(result.functionCalls?.[0].name).toBe('noop');
      expect(result.functionCalls?.[0].args).toEqual({});
    });

    it('should emit tool calls with correct finish reason', () => {
      const toolCallAccumulator = new Map<number, { name: string; args: string }>();

      // Accumulate
      const chunk1: OllamaChatResponse = {
        model: 'llama3.2',
        created_at: '2024-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              function: {
                name: 'test_tool',
                arguments: { x: 1 },
              },
            },
          ],
        },
        done: false,
      };
      converter.convertOllamaChunkToGenAI(chunk1, toolCallAccumulator);

      // Emit with done
      const chunk2: OllamaChatResponse = {
        model: 'llama3.2',
        created_at: '2024-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: '',
        },
        done: true,
      };

      const result = converter.convertOllamaChunkToGenAI(chunk2, toolCallAccumulator);

      // Finish reason should be TOOL_CALLS, not STOP
      expect(result.candidates?.[0]?.finishReason).toBe(FinishReason.TOOL_CALLS);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty parts array', () => {
      const genaiRequest = {
        model: 'llama3.2',
        contents: [{ role: 'user', parts: [] }],
      };

      const result = converter.convertGenAIRequestToOllama(genaiRequest);

      // Empty parts should not create a message
      expect(result.messages).toHaveLength(0);
    });

    it('should handle null content in message', () => {
      const ollamaResponse: OllamaChatResponse = {
        model: 'llama3.2',
        created_at: '2024-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: '',
        },
        done: true,
      };

      const result = converter.convertOllamaResponseToGenAI(ollamaResponse);

      // Should handle empty content gracefully
      expect(result.candidates?.[0]?.content?.parts).toHaveLength(0);
    });

    it('should handle mixed content types', () => {
      const genaiRequest = {
        model: 'llava',
        contents: [
          {
            role: 'user',
            parts: [
              { text: 'Text part' },
              { inlineData: { mimeType: 'image/png', data: 'img' } },
            ],
          },
        ],
      };

      const result = converter.convertGenAIRequestToOllama(genaiRequest);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content).toContain('Text part');
      expect(result.messages[0].images).toContain('img');
    });
  });

  describe('Text-based Tool Call Parsing', () => {
    it('should parse tool call from <tool_call=...> format', () => {
      const ollamaResponse: OllamaChatResponse = {
        model: 'qwen3-coder',
        created_at: '2024-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: '<tool_call={"name": "list_directory", "arguments": {"path": "/home"}}>',
        },
        done: true,
      };

      const result = converter.convertOllamaResponseToGenAI(ollamaResponse);

      const functionCalls = result.functionCalls;
      expect(functionCalls).toBeDefined();
      expect(functionCalls).toHaveLength(1);
      expect(functionCalls?.[0].name).toBe('list_directory');
      expect(functionCalls?.[0].args).toEqual({ path: '/home' });
    });

    it('should parse tool call from <tool_call_start>...<tool_call_end> format', () => {
      const ollamaResponse: OllamaChatResponse = {
        model: 'qwen3-coder',
        created_at: '2024-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: '<tool_call_start>{"name": "read_file", "arguments": {"path": "/test.txt"}}<tool_call_end>',
        },
        done: true,
      };

      const result = converter.convertOllamaResponseToGenAI(ollamaResponse);

      const functionCalls = result.functionCalls;
      expect(functionCalls).toBeDefined();
      expect(functionCalls).toHaveLength(1);
      expect(functionCalls?.[0].name).toBe('read_file');
      expect(functionCalls?.[0].args).toEqual({ path: '/test.txt' });
    });

    it('should parse tool call from function call JSON format', () => {
      const ollamaResponse: OllamaChatResponse = {
        model: 'qwen3-coder',
        created_at: '2024-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: '{"type": "function", "function": {"name": "run_shell_command", "arguments": "{\\"command\\": \\"ls\\"}"}}',
        },
        done: true,
      };

      const result = converter.convertOllamaResponseToGenAI(ollamaResponse);

      const functionCalls = result.functionCalls;
      expect(functionCalls).toBeDefined();
      expect(functionCalls).toHaveLength(1);
      expect(functionCalls?.[0].name).toBe('run_shell_command');
    });

    it('should parse tool call from simple JSON with name/arguments', () => {
      const ollamaResponse: OllamaChatResponse = {
        model: 'qwen3-coder',
        created_at: '2024-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: 'Let me help you with that.\n{"name": "edit", "arguments": {"path": "/file.ts"}}',
        },
        done: true,
      };

      const result = converter.convertOllamaResponseToGenAI(ollamaResponse);

      const functionCalls = result.functionCalls;
      expect(functionCalls).toBeDefined();
      expect(functionCalls).toHaveLength(1);
      expect(functionCalls?.[0].name).toBe('edit');
      expect(functionCalls?.[0].args).toEqual({ path: '/file.ts' });
    });

    it('should clean text content after parsing tool calls', () => {
      const ollamaResponse: OllamaChatResponse = {
        model: 'qwen3-coder',
        created_at: '2024-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: 'I will list the directory for you.\n<tool_call={"name": "list_directory", "arguments": {"path": "/home"}}>',
        },
        done: true,
      };

      const result = converter.convertOllamaResponseToGenAI(ollamaResponse);

      // Should have both text and function call
      const parts = result.candidates?.[0]?.content?.parts;
      expect(parts).toBeDefined();

      // Should have function call
      expect(result.functionCalls).toBeDefined();
      expect(result.functionCalls).toHaveLength(1);

      // Text should be cleaned (tool call removed)
      const textPart = parts?.find((p) => 'text' in p);
      expect(textPart?.text).toContain('I will list the directory');
      expect(textPart?.text).not.toContain('<tool_call');
    });

    it('should prefer structured tool_calls over text parsing', () => {
      const ollamaResponse: OllamaChatResponse = {
        model: 'qwen3-coder',
        created_at: '2024-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: 'Some text content',
          tool_calls: [
            {
              function: {
                name: 'structured_call',
                arguments: { test: true },
              },
            },
          ],
        },
        done: true,
      };

      const result = converter.convertOllamaResponseToGenAI(ollamaResponse);

      // Should only have the structured tool call
      expect(result.functionCalls).toBeDefined();
      expect(result.functionCalls).toHaveLength(1);
      expect(result.functionCalls?.[0].name).toBe('structured_call');
    });
  });
});
