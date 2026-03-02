/**
 * Type declaration for the 'ignore' package
 * This fixes the module resolution issue with ESM and verbatimModuleSyntax
 */

declare module 'ignore' {
  export interface Ignore {
    /**
     * Adds one or several rules to the current manager.
     */
    add(patterns: string | Ignore | ReadonlyArray<string | Ignore>): this;

    /**
     * Filters the given array of pathnames, and returns the filtered array.
     */
    filter(pathnames: readonly string[]): string[];

    /**
     * Creates a filter function which could filter
     * an array of paths with Array.prototype.filter.
     */
    createFilter(): (pathname: string) => boolean;

    /**
     * Returns Boolean whether pathname should be ignored.
     */
    ignores(pathname: string): boolean;

    /**
     * Returns whether pathname should be ignored or unignored
     */
    test(pathname: string): {
      ignored: boolean;
      unignored: boolean;
    };
  }

  export interface Options {
    ignorecase?: boolean;
    ignoreCase?: boolean;
    allowRelativePaths?: boolean;
  }

  function ignore(options?: Options): Ignore;

  export default ignore;
}
