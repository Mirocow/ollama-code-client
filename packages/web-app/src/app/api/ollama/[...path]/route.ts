/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Ollama API Proxy Route
 *
 * Proxies all requests to the Ollama API server to avoid CORS issues.
 * Supports streaming responses for chat and generate endpoints.
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Ollama server URL from environment or default
 */
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

/**
 * Proxy handler for all Ollama API requests
 *
 * @param request - Next.js request object
 * @param params - Route parameters containing the path
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const targetPath = path.join('/');
  const searchParams = request.nextUrl.searchParams;
  const targetUrl = `${OLLAMA_URL}/api/${targetPath}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Ollama proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to Ollama server' },
      { status: 503 }
    );
  }
}

/**
 * POST handler for Ollama API requests with streaming support
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const targetPath = path.join('/');
  const targetUrl = `${OLLAMA_URL}/api/${targetPath}`;
  const body = await request.text();

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    });

    // Check if this is a streaming response
    const isStreaming = request.headers.get('accept') === 'text/event-stream' ||
      JSON.parse(body).stream !== false;

    if (isStreaming && response.body) {
      // Return streaming response
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();

      const stream = new ReadableStream({
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
            console.error('Stream error:', error);
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'application/x-ndjson',
          'Transfer-Encoding': 'chunked',
        },
      });
    }

    // Non-streaming response
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Ollama proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to Ollama server' },
      { status: 503 }
    );
  }
}
