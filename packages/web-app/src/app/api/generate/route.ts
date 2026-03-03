/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Generate API Route
 *
 * Handles text generation requests with streaming support.
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

/**
 * Generate request type
 */
interface GenerateRequest {
  model: string;
  prompt: string;
  system?: string;
  context?: number[];
  stream?: boolean;
  raw?: boolean;
  format?: string | object;
  options?: Record<string, unknown>;
  keep_alive?: string | number;
}

/**
 * POST /api/generate
 *
 * Proxies generate requests to Ollama with streaming support
 */
export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();
    const { stream = true, ...rest } = body;

    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
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
            console.error('Generate stream error:', error);
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

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Generate API error:', error);
    return NextResponse.json(
      { error: 'Failed to process generate request' },
      { status: 500 }
    );
  }
}
