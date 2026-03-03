/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';

/**
 * UI store state interface
 */
export interface UIStoreState {
  // Theme
  themeName: string;

  // Dialogs
  activeDialog: string | null;

  // Focus
  focusedComponent: string | null;

  // Notifications
  notifications: Array<{
    id: string;
    type: 'info' | 'warning' | 'error' | 'success';
    message: string;
    timestamp: number;
  }>;

  // Vim mode
  vimModeEnabled: boolean;
  vimMode: 'normal' | 'insert' | 'visual' | 'command';

  // Debug
  debugMode: boolean;

  // Actions
  setTheme: (themeName: string) => void;
  openDialog: (dialogId: string) => void;
  closeDialog: () => void;
  setFocusedComponent: (componentId: string | null) => void;
  addNotification: (
    notification: Omit<UIStoreState['notifications'][0], 'id' | 'timestamp'>,
  ) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  setVimMode: (mode: UIStoreState['vimMode']) => void;
  toggleVimMode: () => void;
  setDebugMode: (enabled: boolean) => void;
  toggleDebugMode: () => void;
}

/**
 * UI Store - Manages general UI state
 *
 * Uses persist middleware for theme and preferences that should
 * survive app restarts.
 *
 * @example
 * // Subscribe to theme
 * const theme = useUIStore(state => state.themeName);
 *
 * @example
 * // Subscribe to notifications
 * const notifications = useUIStore(state => state.notifications);
 */
export const uiStore = create<UIStoreState>()(
  subscribeWithSelector(
    persist(
      (set, _get) => ({
        // Initial state
        themeName: 'default',
        activeDialog: null,
        focusedComponent: null,
        notifications: [],
        vimModeEnabled: false,
        vimMode: 'normal',
        debugMode: false,

        // Actions
        setTheme: (themeName: string) => {
          set({ themeName });
        },

        openDialog: (dialogId: string) => {
          set({ activeDialog: dialogId });
        },

        closeDialog: () => {
          set({ activeDialog: null });
        },

        setFocusedComponent: (componentId: string | null) => {
          set({ focusedComponent: componentId });
        },

        addNotification: (notification) => {
          const newNotification = {
            ...notification,
            id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
          };
          set((state) => ({
            notifications: [...state.notifications, newNotification],
          }));
        },

        removeNotification: (id: string) => {
          set((state) => ({
            notifications: state.notifications.filter((n) => n.id !== id),
          }));
        },

        clearNotifications: () => {
          set({ notifications: [] });
        },

        setVimMode: (mode: UIStoreState['vimMode']) => {
          set({ vimMode: mode });
        },

        toggleVimMode: () => {
          set((state) => ({
            vimModeEnabled: !state.vimModeEnabled,
            vimMode: !state.vimModeEnabled ? 'normal' : 'insert',
          }));
        },

        setDebugMode: (enabled: boolean) => {
          set({ debugMode: enabled });
        },

        toggleDebugMode: () => {
          set((state) => ({ debugMode: !state.debugMode }));
        },
      }),
      {
        name: 'ollama-code-ui',
        partialize: (state) => ({
          themeName: state.themeName,
          vimModeEnabled: state.vimModeEnabled,
          debugMode: state.debugMode,
        }),
      },
    ),
  ),
);

/**
 * Hook for using the UI store
 */
export const useUIStore = uiStore;
