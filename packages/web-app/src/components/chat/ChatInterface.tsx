/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useWebSessionStore } from '@/stores/webSessionStore';
import { useWebSocket } from '@/hooks/useWebSocket';

/**
 * Model information from Ollama
 */
interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
}

/**
 * Main chat interface component
 */
export function ChatInterface() {
  const {
    sessions,
    activeSessionId,
    streaming,
    selectedModel,
    createSession,
    setActiveSession,
    addMessage,
    startStreaming,
    appendStreamContent,
    finishStreaming,
    cancelStreaming,
    setSelectedModel,
    sidebarOpen,
    toggleSidebar,
  } = useWebSessionStore();

  const [inputValue, setInputValue] = useState('');
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // WebSocket connection
  const { isConnected, send: _send } = useWebSocket({
    url: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:11434/api/ws',
    onMessage: (chunk) => {
      if (chunk.type === 'chunk' && chunk.content) {
        appendStreamContent(chunk.content);
      } else if (chunk.type === 'done') {
        finishStreaming();
      } else if (chunk.type === 'error') {
        console.error('WebSocket error:', chunk.error);
        finishStreaming();
      }
    },
    onError: (error) => {
      console.error('WebSocket error:', error);
    },
  });

  // Fetch available models
  useEffect(() => {
    async function fetchModels() {
      try {
        const response = await fetch('/api/models');
        const data = await response.json();
        setModels(data.models || []);
        if (data.models?.length > 0 && !selectedModel) {
          setSelectedModel(data.models[0].name);
        }
      } catch (error) {
        console.error('Failed to fetch models:', error);
      } finally {
        setIsLoadingModels(false);
      }
    }

    fetchModels();
  }, [selectedModel, setSelectedModel]);

  // Create initial session
  useEffect(() => {
    if (sessions.size === 0) {
      createSession(selectedModel);
    }
  }, [sessions.size, createSession, selectedModel]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [streaming.currentContent]);

  // Get active session
  const activeSession = activeSessionId ? sessions.get(activeSessionId) : null;

  // Handle send message
  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || streaming.isStreaming || !activeSessionId) return;

    const userMessage = inputValue.trim();
    setInputValue('');

    // Add user message
    addMessage(activeSessionId, {
      role: 'user',
      content: userMessage,
    });

    // Start streaming
    const abortController = new AbortController();
    startStreaming(abortController);

    // Send to Ollama via API route
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            ...(activeSession?.messages || []).map((m) => ({
              role: m.role,
              content: m.content,
            })),
            { role: 'user', content: userMessage },
          ],
          stream: true,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.message?.content) {
              appendStreamContent(parsed.message.content);
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }

      finishStreaming();
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('Request aborted');
      } else {
        console.error('Failed to send message:', error);
        finishStreaming();
      }
    }
  }, [
    inputValue,
    streaming.isStreaming,
    activeSessionId,
    activeSession,
    selectedModel,
    addMessage,
    startStreaming,
    appendStreamContent,
    finishStreaming,
  ]);

  // Handle keyboard shortcut
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      {sidebarOpen && (
        <aside className="w-64 border-r border-border bg-muted/30 flex flex-col">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold">Ollama Code</h2>
          </div>

          {/* Model selector */}
          <div className="p-4 border-b border-border">
            <label className="text-sm text-muted-foreground mb-2 block">
              Model
            </label>
            {isLoadingModels ? (
              <div className="text-sm text-muted-foreground">Loading models...</div>
            ) : (
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm"
              >
                {models.map((model) => (
                  <option key={model.name} value={model.name}>
                    {model.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Sessions list */}
          <div className="flex-1 overflow-auto p-4">
            <div className="space-y-2">
              {Array.from(sessions.values()).map((session) => (
                <button
                  key={session.id}
                  onClick={() => setActiveSession(session.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm truncate transition-colors ${
                    session.id === activeSessionId
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  {session.title || 'New Chat'}
                </button>
              ))}
            </div>
          </div>

          {/* New chat button */}
          <div className="p-4 border-t border-border">
            <button
              onClick={() => createSession(selectedModel)}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              New Chat
            </button>
          </div>
        </aside>
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-14 border-b border-border flex items-center px-4 gap-4">
          <button
            onClick={toggleSidebar}
            className="p-2 hover:bg-muted rounded-md transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <h1 className="font-semibold">{activeSession?.title || 'New Chat'}</h1>
          <div className="ml-auto flex items-center gap-2">
            <span
              className={`text-xs px-2 py-1 rounded-full ${
                isConnected
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
              }`}
            >
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {activeSession?.messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[80%] px-4 py-2 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                {message.role === 'assistant' && message.thinking && (
                  <details className="mb-2 text-xs text-muted-foreground">
                    <summary className="cursor-pointer hover:text-foreground">
                      Thinking...
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap text-xs">
                      {message.thinking}
                    </pre>
                  </details>
                )}
                <div className="whitespace-pre-wrap">{message.content}</div>
              </div>
            </div>
          ))}

          {/* Streaming response */}
          {streaming.isStreaming && streaming.currentContent && (
            <div className="flex justify-start">
              <div className="max-w-[80%] px-4 py-2 rounded-lg bg-muted">
                <div className="whitespace-pre-wrap">{streaming.currentContent}</div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border p-4">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Send a message... (Enter to send, Shift+Enter for new line)"
              className="flex-1 px-4 py-2 bg-background border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              rows={1}
              disabled={streaming.isStreaming}
            />
            {streaming.isStreaming ? (
              <button
                onClick={cancelStreaming}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!inputValue.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatInterface;
