/**
 * Type augmentation for AbortSignal.any() and URL.parse()
 * These are available in Node.js 20.5.0+ and 22.1.0+ respectively
 * but the TypeScript types may not expose them correctly due to conditional types
 */

declare global {
  interface AbortSignalConstructor {
    /**
     * Creates an AbortSignal that will be aborted when any of the provided signals are aborted.
     * @param signals An array of AbortSignals to monitor.
     * @returns An AbortSignal that will be aborted when any of the provided signals are aborted.
     * @since Node.js 20.5.0
     */
    any(signals: AbortSignal[]): AbortSignal;
  }

  interface URLConstructor {
    /**
     * Parses a string as a URL, returning null if the string is not a valid URL.
     * @param url The string to parse as a URL.
     * @param base The base URL to use for relative URLs.
     * @returns The parsed URL, or null if the string is not a valid URL.
     * @since Node.js 22.1.0
     */
    parse(url: string, base?: string | URL): URL | null;
  }
}

export {};
