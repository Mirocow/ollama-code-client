/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { memo } from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import {
  AuthType,
  shortenPath,
  tildeifyPath,
  getModelCapabilities,
  tokenLimit,
} from '@ollama-code/ollama-code-core';
import { theme } from '../semantic-colors.js';
import { shortAsciiLogo } from './AsciiArt.js';
import { getAsciiArtWidth, getCachedStringWidth } from '../utils/textUtils.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { t, getCurrentLanguage } from '../../i18n/index.js';

/**
 * Extract model size from model name (e.g., "14b" from "qwen2.5-coder:14b")
 * Supports various formats:
 * - Standard: 7b, 14b, 32b, 70b, 72b, 120b, 405b, etc.
 * - Decimal: 0.5b, 1.5b, 2.7b, 8.7b, etc.
 * - MoE: 8x7b, 8x22b, 16x12b, etc.
 * - With suffixes: 7b-q4, 14b-q8, etc.
 * - In name: llama3-70b, mistral-7b, qwen2.5-32b
 */
function extractModelSize(model: string): string | null {
  const lowerModel = model.toLowerCase();

  // Skip common non-size suffixes and try again
  const skipSuffixes = [
    'instruct',
    'chat',
    'base',
    'preview',
    'latest',
    'quantized',
  ];
  for (const suffix of skipSuffixes) {
    if (
      lowerModel.endsWith('-' + suffix) ||
      lowerModel.endsWith(':' + suffix)
    ) {
      return extractModelSize(lowerModel.slice(0, -(suffix.length + 1)));
    }
  }

  // Pattern 1: MoE models like 8x7b, 8x22b, 16x12b
  const moeMatch = lowerModel.match(/(\d+x\d+b)$/i);
  if (moeMatch) {
    return moeMatch[1].toLowerCase();
  }

  // Pattern 2: Size after colon (Ollama format): model:14b, model:0.5b
  const colonMatch = lowerModel.match(/:(\d+\.?\d*b)$/i);
  if (colonMatch) {
    return colonMatch[1].toLowerCase();
  }

  // Pattern 3: Size at end with dash: llama3-70b, mistral-7b
  const dashMatch = lowerModel.match(/-(\d+\.?\d*b)$/i);
  if (dashMatch) {
    return dashMatch[1].toLowerCase();
  }

  // Pattern 4: Size at very end: model70b
  const endMatch = lowerModel.match(/(\d+\.?\d*b)$/i);
  if (endMatch) {
    return endMatch[1].toLowerCase();
  }

  return null;
}

/**
 * Format model size for display (add commas for large numbers)
 */
function formatModelSize(size: string): string {
  // Handle MoE models like 8x7b -> "8x7B"
  if (size.includes('x')) {
    return size.toUpperCase();
  }
  // Handle decimal sizes like 0.5b, 1.5b -> "0.5B"
  // Handle integer sizes like 7b, 14b, 70b -> "7B", "14B", "70B"
  return size.toUpperCase();
}

/**
 * Format context window size for display
 */
function formatContextSize(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(0)}K`;
  }
  return tokens.toString();
}

/**
 * Create a progress bar string
 */
function createProgressBar(
  percentage: number,
  width: number = 10,
): { filled: string; empty: string } {
  const filled = Math.round(percentage * width);
  return {
    filled: '█'.repeat(Math.min(filled, width)),
    empty: '░'.repeat(Math.max(0, width - filled)),
  };
}

interface HeaderProps {
  customAsciiArt?: string; // For user-defined ASCII art
  version: string;
  authType?: AuthType;
  model: string;
  baseUrl?: string;
  workingDirectory: string;
  sessionId?: string;
  contextWindowSize?: number; // Context window size in tokens
  promptTokenCount?: number; // Current prompt token count for usage display
}

function titleizeAuthType(value: string): string {
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => {
      if (part.toLowerCase() === 'ai') {
        return 'AI';
      }
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ');
}

// Format auth type for display
function formatAuthType(authType?: AuthType): string {
  if (!authType) {
    return 'Unknown';
  }

  switch (authType) {
    case AuthType.USE_OLLAMA:
      return 'Ollama';
    default:
      return titleizeAuthType(String(authType));
  }
}

export const Header: React.FC<HeaderProps> = memo(
  ({
    customAsciiArt,
    version,
    authType,
    model,
    baseUrl,
    workingDirectory,
    sessionId,
    contextWindowSize,
    promptTokenCount,
  }) => {
    const { columns: terminalWidth } = useTerminalSize();

    const displayLogo = customAsciiArt ?? shortAsciiLogo;
    const logoWidth = getAsciiArtWidth(displayLogo);
    const formattedAuthType = formatAuthType(authType);

    // Get model capabilities
    const capabilities = getModelCapabilities(model);
    const capabilityBadges: string[] = [];
    if (capabilities.tools) {
      capabilityBadges.push('🔧');
    }
    if (capabilities.thinking) {
      capabilityBadges.push('🧠');
    }
    if (capabilities.vision) {
      capabilityBadges.push('📷');
    }
    if (capabilities.structuredOutput) {
      capabilityBadges.push('📋');
    }
    const capabilitiesText =
      capabilityBadges.length > 0 ? ` ${capabilityBadges.join(' ')}` : '';

    // Get context window size (use provided or auto-detect from model)
    const contextSize = contextWindowSize ?? tokenLimit(model, 'input');
    const extractedSize = extractModelSize(model);
    const modelSize = extractedSize ? formatModelSize(extractedSize) : null;
    const contextSizeFormatted = formatContextSize(contextSize);

    // Calculate context usage if promptTokenCount is provided
    const contextUsagePercentage =
      promptTokenCount && contextSize
        ? Math.min(promptTokenCount / contextSize, 1)
        : 0;

    // Calculate available space properly:
    // First determine if logo can be shown, then use remaining space for path
    const containerMarginX = 2; // marginLeft + marginRight on the outer container
    const logoGap = 2; // Gap between logo and info panel
    const infoPanelPaddingX = 1;
    const infoPanelBorderWidth = 2; // left + right border
    const infoPanelChromeWidth = infoPanelBorderWidth + infoPanelPaddingX * 2;
    const minPathLength = 40; // Minimum readable path length
    const minInfoPanelWidth = minPathLength + infoPanelChromeWidth;

    const availableTerminalWidth = Math.max(
      0,
      terminalWidth - containerMarginX * 2,
    );

    // Check if we have enough space for logo + gap + minimum info panel
    const showLogo =
      availableTerminalWidth >= logoWidth + logoGap + minInfoPanelWidth;

    // Calculate available width for info panel (use all remaining space)
    // Cap at 60 when in two-column layout (with logo)
    const maxInfoPanelWidth = 60;
    const availableInfoPanelWidth = showLogo
      ? Math.min(
          availableTerminalWidth - logoWidth - logoGap,
          maxInfoPanelWidth,
        )
      : availableTerminalWidth;

    // Calculate max path length (subtract padding/borders from available space)
    const maxPathLength = Math.max(
      0,
      availableInfoPanelWidth - infoPanelChromeWidth,
    );

    const infoPanelContentWidth = Math.max(
      0,
      availableInfoPanelWidth - infoPanelChromeWidth,
    );

    // Calculate progress bar width to fill the panel
    // Reserve space for percentage text: " 100.0%" = 7 chars
    const progressBarWidth = Math.max(4, infoPanelContentWidth - 7);
    const progressBar = createProgressBar(
      contextUsagePercentage,
      progressBarWidth,
    );

    // Format server URL (show only host:port, hide http:// prefix for brevity)
    const displayBaseUrl = baseUrl
      ? baseUrl.replace(/^https?:\/\//, '')
      : 'localhost:11434';

    const authModelText = `${formattedAuthType} | ${displayBaseUrl} | ${model}${capabilitiesText}`;
    const modelHintText = ' (/model to change)';
    const showModelHint =
      infoPanelContentWidth > 0 &&
      getCachedStringWidth(authModelText + modelHintText) <=
        infoPanelContentWidth;

    // Now shorten the path to fit the available space
    const tildeifiedPath = tildeifyPath(workingDirectory);
    const shortenedPath = shortenPath(
      tildeifiedPath,
      Math.max(3, maxPathLength),
    );
    const displayPath =
      maxPathLength <= 0
        ? ''
        : shortenedPath.length > maxPathLength
          ? shortenedPath.slice(0, maxPathLength)
          : shortenedPath;

    // Use theme gradient colors if available, otherwise use text colors (excluding primary)
    const gradientColors = theme.ui.gradient || [
      theme.text.secondary,
      theme.text.link,
      theme.text.accent,
    ];

    return (
      <Box
        flexDirection="row"
        alignItems="center"
        marginX={containerMarginX}
        width={availableTerminalWidth}
      >
        {/* Left side: ASCII logo (only if enough space) */}
        {showLogo && (
          <>
            <Box flexShrink={0}>
              <Gradient colors={gradientColors}>
                <Text>{displayLogo}</Text>
              </Gradient>
            </Box>
            {/* Fixed gap between logo and info panel */}
            <Box width={logoGap} />
          </>
        )}

        {/* Right side: Info panel (flexible width, max 60 in two-column layout) */}
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={theme.border.default}
          paddingX={infoPanelPaddingX}
          flexGrow={showLogo ? 0 : 1}
          width={showLogo ? availableInfoPanelWidth : undefined}
        >
          {/* Title line: >_ Ollama Code (v{version}) */}
          <Text>
            <Text bold color={theme.text.accent}>
              &gt;_ Ollama Code
            </Text>
            <Text color={theme.text.secondary}> (v{version})</Text>
          </Text>
          {/* Empty line for spacing */}
          <Text> </Text>
          {/* Auth and Model line */}
          <Text>
            <Text color={theme.text.secondary}>{authModelText}</Text>
            {showModelHint && (
              <Text color={theme.text.secondary}>{modelHintText}</Text>
            )}
          </Text>
          {/* Context and Size info */}
          <Text>
            <Text color={theme.text.secondary}>{t('Context')}: </Text>
            <Text color={theme.text.accent}>{contextSizeFormatted}</Text>
            {modelSize && (
              <>
                <Text color={theme.text.secondary}> | {t('Size')}: </Text>
                <Text color={theme.text.accent}>{modelSize}</Text>
              </>
            )}
            <Text color={theme.text.secondary}> | {t('Language')}: </Text>
            <Text color={theme.text.accent}>{getCurrentLanguage().toUpperCase()}</Text>
          </Text>
          {/* Context usage progress bar - full width */}
          <Text>
            <Text
              color={
                contextUsagePercentage > 0.9
                  ? theme.status.warning
                  : theme.text.accent
              }
            >
              {progressBar.filled}
            </Text>
            <Text color={theme.text.secondary}>{progressBar.empty}</Text>
            <Text color={theme.text.secondary}>
              {' '}
              {promptTokenCount?.toLocaleString() ?? 0} / {contextSizeFormatted}{' '}
              ({(contextUsagePercentage * 100).toFixed(1)}%)
            </Text>
          </Text>
          {/* Session ID line (if available) */}
          {sessionId && (
            <Text color={theme.text.secondary}>
              Session:{' '}
              {sessionId.length > 12
                ? sessionId.slice(0, 12) + '...'
                : sessionId}
            </Text>
          )}
          {/* Directory line */}
          <Text color={theme.text.secondary}>{displayPath}</Text>
        </Box>
      </Box>
    );
  },
);
Header.displayName = 'Header';
