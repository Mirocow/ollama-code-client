/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Chat API Route
 *
 * Handles chat requests with streaming support.
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

/**
 * Chat message type
 */
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: string[];
}

/**
 * Chat request type
 */
interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  format?: string | object;
  options?: Record<string, unknown>;
  keep_alive?: string | number;
}

/**
 * POST /api/chat
 *
 * Proxies chat requests to Ollama with streaming support
 */
export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { stream = true, ...rest } = body;

    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...rest, stream }),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: `Ollama error: ${error}` },
        { status: response.status }
      );
    }

    if (stream && response.body) {
      // Return streaming response
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();

      const readableStream = new ReadableStream({
        async start(controller) {
          const reader = response.body!.getReader();

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              controller.enqueue(encoder.encode(chunk));
            }
          } catch (error) {
            console.error('Chat stream error:', error);
            controller.error(error);
          } finally {
            controller.close();
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'application/x-ndjson',
          'Transfer-Encoding': 'chunked',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Non-streaming response
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
}
