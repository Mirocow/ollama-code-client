/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { eventBus } from './eventBus.js';

/**
 * Command interface for the Command Pattern
 */
export interface Command<T = unknown> {
  /** Unique identifier for this command */
  id: string;
  /** Human-readable description of the command */
  description: string;
  /** Command type for categorization */
  type: string;
  /** Execute the command */
  execute: () => Promise<T>;
  /** Undo the command */
  undo: () => Promise<void>;
  /** Redo the command (defaults to execute if not provided) */
  redo?: () => Promise<T>;
  /** Timestamp when the command was created */
  timestamp: number;
  /** Whether this command can be undone */
  canUndo: boolean;
  /** Metadata for the command */
  metadata?: Record<string, unknown>;
}

/**
 * Command history entry
 */
interface CommandHistoryEntry<T = unknown> {
  command: Command<T>;
  result: T | undefined;
  undone: boolean;
  executedAt: number;
}

/**
 * Command store state
 */
interface CommandStoreState {
  /** Stack of executed commands */
  history: CommandHistoryEntry[];
  /** Current position in history (for undo/redo navigation) */
  currentIndex: number;
  /** Maximum history size */
  maxHistorySize: number;
  /** Whether a command is currently executing */
  isExecuting: boolean;
  /** Whether undo operation is in progress */
  isUndoing: boolean;
  /** Whether redo operation is in progress */
  isRedoing: boolean;
  /** Last error that occurred */
  lastError: Error | null;

  // Actions
  execute: <T>(command: Omit<Command<T>, 'id' | 'timestamp'>) => Promise<T>;
  undo: () => Promise<boolean>;
  redo: () => Promise<boolean>;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;
  getHistory: () => CommandHistoryEntry[];
  getLastExecuted: () => CommandHistoryEntry | undefined;
  getLastUndone: () => CommandHistoryEntry | undefined;
}

/**
 * Generate unique command ID
 */
let commandIdCounter = 0;
function generateCommandId(): string {
  return `cmd-${Date.now()}-${++commandIdCounter}`;
}

/**
 * Command Store - Implements the Command Pattern with Undo/Redo support
 *
 * This store provides a clean interface for executing commands with
 * undo/redo capabilities. It integrates with the event bus for
 * cross-component notifications.
 *
 * @example
 * // Execute a command
 * const result = await commandStore.execute({
 *   description: 'Change theme to dark',
 *   type: 'theme',
 *   execute: async () => {
 *     const previous = currentTheme;
 *     setCurrentTheme('dark');
 *     return previous;
 *   },
 *   undo: async () => {
 *     setCurrentTheme(previousTheme);
 *   },
 *   canUndo: true,
 * });
 *
 * @example
 * // Undo the last command
 * if (commandStore.canUndo()) {
 *   await commandStore.undo();
 * }
 *
 * @example
 * // Redo the last undone command
 * if (commandStore.canRedo()) {
 *   await commandStore.redo();
 * }
 */
export const commandStore = create<CommandStoreState>()((set, get) => ({
  history: [],
  currentIndex: -1,
  maxHistorySize: 50,
  isExecuting: false,
  isUndoing: false,
  isRedoing: false,
  lastError: null,

  execute: async <T>(
    commandInput: Omit<Command<T>, 'id' | 'timestamp'>,
  ): Promise<T> => {
    const { isExecuting, maxHistorySize, history, currentIndex } = get();

    if (isExecuting) {
      throw new Error(
        'Cannot execute command while another command is executing',
      );
    }

    set({ isExecuting: true, lastError: null });

    const command: Command<T> = {
      ...commandInput,
      id: generateCommandId(),
      timestamp: Date.now(),
      canUndo: commandInput.canUndo ?? true,
    };

    try {
      const result: T = await command.execute();

      // Create history entry
      const entry: CommandHistoryEntry<T> = {
        command,
        result,
        undone: false,
        executedAt: Date.now(),
      };

      // Remove any commands after current index (for redo stack)
      const newHistory = history.slice(0, currentIndex + 1);

      // Add to history (respecting max size)
      const updatedHistory = [...newHistory, entry].slice(-maxHistorySize);

      set({
        history: updatedHistory,
        currentIndex: updatedHistory.length - 1,
        isExecuting: false,
      });

      // Emit event
      eventBus.getState().emit('command:executed', {
        commandId: command.id,
        commandType: command.type,
        result,
      });

      return result;
    } catch (error) {
      set({
        isExecuting: false,
        lastError: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  },

  undo: async () => {
    const { history, currentIndex, isExecuting, isUndoing } = get();

    if (isExecuting || isUndoing) {
      return false;
    }

    if (currentIndex < 0 || currentIndex >= history.length) {
      return false;
    }

    const entry = history[currentIndex];
    if (!entry || !entry.command.canUndo || entry.undone) {
      return false;
    }

    set({ isUndoing: true, lastError: null });

    try {
      await entry.command.undo();

      // Update history
      const newHistory = [...history];
      newHistory[currentIndex] = { ...entry, undone: true };

      set({
        history: newHistory,
        currentIndex: currentIndex - 1,
        isUndoing: false,
      });

      // Emit event
      eventBus.getState().emit('command:undone', {
        commandId: entry.command.id,
        commandType: entry.command.type,
      });

      return true;
    } catch (error) {
      set({
        isUndoing: false,
        lastError: error instanceof Error ? error : new Error(String(error)),
      });
      return false;
    }
  },

  redo: async () => {
    const { history, currentIndex, isExecuting, isRedoing } = get();

    if (isExecuting || isRedoing) {
      return false;
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex >= history.length) {
      return false;
    }

    const entry = history[nextIndex];
    if (!entry || !entry.undone) {
      return false;
    }

    set({ isRedoing: true, lastError: null });

    try {
      const redoFn = entry.command.redo ?? entry.command.execute;
      await redoFn();

      // Update history
      const newHistory = [...history];
      newHistory[nextIndex] = { ...entry, undone: false };

      set({
        history: newHistory,
        currentIndex: nextIndex,
        isRedoing: false,
      });

      // Emit event
      eventBus.getState().emit('command:redone', {
        commandId: entry.command.id,
        commandType: entry.command.type,
      });

      return true;
    } catch (error) {
      set({
        isRedoing: false,
        lastError: error instanceof Error ? error : new Error(String(error)),
      });
      return false;
    }
  },

  canUndo: () => {
    const { history, currentIndex, isExecuting, isUndoing, isRedoing } = get();

    if (isExecuting || isUndoing || isRedoing) {
      return false;
    }

    if (currentIndex < 0 || currentIndex >= history.length) {
      return false;
    }

    const entry = history[currentIndex];
    return entry?.command.canUndo === true && !entry.undone;
  },

  canRedo: () => {
    const { history, currentIndex, isExecuting, isUndoing, isRedoing } = get();

    if (isExecuting || isUndoing || isRedoing) {
      return false;
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex >= history.length) {
      return false;
    }

    const entry = history[nextIndex];
    return entry?.undone === true;
  },

  clearHistory: () => {
    set({
      history: [],
      currentIndex: -1,
      lastError: null,
    });
  },

  getHistory: () => get().history,

  getLastExecuted: () => {
    const { history, currentIndex } = get();
    if (currentIndex < 0 || currentIndex >= history.length) {
      return undefined;
    }
    return history[currentIndex];
  },

  getLastUndone: () => {
    const { history, currentIndex } = get();
    const nextIndex = currentIndex + 1;
    if (nextIndex >= history.length) {
      return undefined;
    }
    const entry = history[nextIndex];
    return entry?.undone ? entry : undefined;
  },
}));

/**
 * Hook for using the command store
 */
export const useCommandStore = commandStore;

/**
 * Utility functions for creating common commands
 */
export const CommandFactory = {
  /**
   * Create a simple reversible command
   */
  createReversible<T>(
    description: string,
    type: string,
    execute: () => Promise<T>,
    undo: () => Promise<void>,
    metadata?: Record<string, unknown>,
  ): Omit<Command<T>, 'id' | 'timestamp'> {
    return {
      description,
      type,
      execute,
      undo,
      canUndo: true,
      metadata,
    };
  },

  /**
   * Create a command that modifies a value
   */
  createValueChange<T>(
    description: string,
    type: string,
    getValue: () => T,
    setValue: (value: T) => Promise<void>,
    newValue: T,
    metadata?: Record<string, unknown>,
  ): Omit<Command<T>, 'id' | 'timestamp'> {
    let previousValue: T;

    return {
      description,
      type,
      execute: async () => {
        previousValue = getValue();
        await setValue(newValue);
        return previousValue;
      },
      undo: async () => {
        await setValue(previousValue);
      },
      redo: async () => {
        await setValue(newValue);
        return previousValue;
      },
      canUndo: true,
      metadata,
    };
  },
};
