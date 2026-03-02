/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Utility functions to work around TypeScript type issues with newer Node.js APIs
 * like AbortSignal.any() and URL.parse()
 */

/**
 * Creates an AbortSignal that will be aborted when any of the provided signals are aborted.
 * This is a wrapper for AbortSignal.any() which is available in Node.js 20.5.0+
 * but may not be recognized by TypeScript types due to conditional type definitions.
 */
export function abortSignalAny(signals: AbortSignal[]): AbortSignal {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (AbortSignal as any).any(signals);
}

/**
 * Parses a string as a URL, returning null if the string is not a valid URL.
 * This is a wrapper for URL.parse() which is available in Node.js 22.1.0+
 * but may not be recognized by TypeScript types due to conditional type definitions.
 */
export function urlParse(url: string, base?: string | URL): URL | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (URL as any).parse(url, base);
}
