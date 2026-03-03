/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import vitest from '@vitest/eslint-plugin';
import globals from 'globals';
// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from 'eslint-plugin-storybook';

export default tseslint.config(
  {
    // Global ignores
    ignores: [
      'node_modules/*',
      'packages/**/dist/**',
      'bundle/**',
      'package/bundle/**',
      '.integration-tests/**',
      'packages/**/.integration-test/**',
      'dist/**',
      'docs-site/.next/**',
      'docs-site/out/**',
      'packages/web-app/.next/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs['recommended-latest'],
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat['jsx-runtime'], // Add this if you are using React 17+
  {
    // Settings for eslint-plugin-react
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  {
    // Import specific config
    files: ['packages/cli/src/**/*.{ts,tsx}'], // Target only TS/TSX in the cli package
    plugins: {
      import: importPlugin,
    },
    settings: {
      'import/resolver': {
        node: true,
      },
    },
    rules: {
      ...importPlugin.configs.recommended.rules,
      ...importPlugin.configs.typescript.rules,
      'import/no-default-export': 'warn',
      'import/no-unresolved': 'off', // Disable for now, can be noisy with monorepos/paths
    },
  },
  {
    // General overrides and rules for the project (TS/TSX files)
    files: ['packages/*/src/**/*.{ts,tsx}'], // Target only TS/TSX in the cli package
    plugins: {
      import: importPlugin,
    },
    settings: {
      'import/resolver': {
        node: true,
      },
    },
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
        // Additional Node.js globals
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly',
        Buffer: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      // We use TypeScript for React components; prop-types are unnecessary
      'react/prop-types': 'off',
      // General Best Practice Rules (subset adapted for flat config)
      '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
      'arrow-body-style': ['error', 'as-needed'],
      curly: ['error', 'multi-line'],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'as' },
      ],
      '@typescript-eslint/explicit-member-accessibility': [
        'error',
        { accessibility: 'no-public' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn', // Change to warn instead of error
      '@typescript-eslint/no-inferrable-types': [
        'error',
        { ignoreParameters: true, ignoreProperties: true },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { disallowTypeAnnotations: false },
      ],
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // Enforce bracket notation for index signature access (matches noPropertyAccessFromIndexSignature)
      '@typescript-eslint/dot-notation': [
        'error',
        {
          allowIndexSignaturePropertyAccess: false,
          allowPrivateClassPropertyAccess: false,
          allowProtectedClassPropertyAccess: false,
        },
      ],
      'import/no-internal-modules': 'off', // Disable this rule as it causes too many issues
      'import/no-relative-packages': 'error',
      'no-cond-assign': 'error',
      'no-debugger': 'error',
      'no-duplicate-case': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CallExpression[callee.name="require"]',
          message: 'Avoid using require(). Use ES6 imports instead.',
        },
        {
          selector: 'ThrowStatement > Literal:not([value=/^\\w+Error:/])',
          message:
            'Do not throw string literals or non-Error objects. Throw new Error("...") instead.',
        },
      ],
      'no-unsafe-finally': 'error',
      'no-console': 'error',
      'no-unused-expressions': 'off', // Disable base rule
      '@typescript-eslint/no-unused-expressions': [
        // Enable TS version
        'error',
        { allowShortCircuit: true, allowTernary: true },
      ],
      'no-var': 'error',
      'object-shorthand': 'error',
      'one-var': ['error', 'never'],
      'prefer-arrow-callback': 'error',
      'prefer-const': ['error', { destructuring: 'all' }],
      radix: 'error',
      'default-case': 'error',
    },
  },
  {
    files: ['packages/*/src/**/*.test.{ts,tsx}', 'packages/**/test/**/*.test.{ts,tsx}'],
    plugins: {
      vitest,
    },
    rules: {
      ...vitest.configs.recommended.rules,
      'vitest/expect-expect': 'off',
      'vitest/no-commented-out-tests': 'off',
      'no-console': 'off', // Allow console in tests
      'no-empty': 'off', // Allow empty blocks in tests
      'default-case': 'off', // Allow no default case in tests
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_|^beforeEach$|^afterEach$|^describe$|^it$|^expect$|^jest$', // Only allow common test globals
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // Enforce bracket notation for index signature access in tests too
      '@typescript-eslint/dot-notation': [
        'error',
        {
          allowIndexSignaturePropertyAccess: false,
          allowPrivateClassPropertyAccess: false,
          allowProtectedClassPropertyAccess: false,
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off', // Allow any in tests
      'arrow-body-style': 'off', // Allow arrow function bodies in tests
    },
  },
  // extra settings for scripts that we run directly with node
  {
    files: ['./scripts/**/*.js', 'esbuild.config.js', 'packages/*/scripts/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        process: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      'no-console': 'off', // Allow console in scripts
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  // Config files in packages
  {
    files: ['packages/*/*.config.js', 'packages/*/test-setup.js', 'packages/*/*.config.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-undef': 'off',
    },
  },
  // SDK package - compiled JS files
  {
    files: ['packages/sdk-typescript/**/*.js', 'packages/sdk-typescript/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
        process: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        AbortController: 'readonly',
      },
    },
    rules: {
      'no-undef': 'off',
      'no-console': 'off',
    },
  },
  // Example files - relaxed rules
  {
    files: ['**/*.example.ts', '**/example.ts', '**/test-ollama-api.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: {
      globals: {
        ...globals.node,
        module: 'readonly',
        require: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-undef': 'off',
    },
  },
  // ==================== no-console allowlist ====================
  // The following files/packages are allowed to use console.*

  // WebUI package - UI component library with Storybook
  {
    files: ['packages/webui/**/*.ts', 'packages/webui/**/*.tsx', 'packages/webui/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: { 
      'no-console': 'off',
      'no-undef': 'off',
      'import/no-internal-modules': 'off',
      'react/prop-types': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  // Web App package - Next.js web application
  {
    files: ['packages/web-app/**/*.ts', 'packages/web-app/**/*.tsx'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: { 
      'no-console': 'off',
      'no-undef': 'off',
      'import/no-internal-modules': 'off',
      'react/prop-types': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'default-case': 'off', // Not all switch statements need default
      'arrow-body-style': 'off', // Allow arrow function bodies
      '@typescript-eslint/consistent-type-imports': 'warn', // Change to warn
    },
  },
  // Specific CLI files that intentionally wrap console usage
  {
    files: [
      'packages/cli/src/acp-integration/acpAgent.ts',      // console infrastructure for ACP mode
      'packages/cli/src/utils/stdioHelpers.ts',            // wraps console.clear()
      'packages/cli/src/commands/plugins-marketplace.ts',  // CLI output for plugin commands
      'packages/cli/src/ui/stores/eventBus.ts',            // event bus logging
      'packages/core/src/observability/telemetryService.ts', // telemetry logging
      'packages/core/src/plugins/plugin-cli.ts',           // plugin CLI tool
      'packages/core/src/prompts/templates/index.ts',      // template loading warnings
    ],
    rules: { 'no-console': 'off' },
  },
  // Settings for export-html assets
  {
    files: ['packages/cli/assets/export-html/**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
  },
  // Prettier config must be last
  prettierConfig,
  // extra settings for scripts that we run directly with node
  {
    files: ['./integration-tests/**/*.{js,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
        process: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      'no-console': 'off', // Allow console in integration tests
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  // Settings for docs-site directory
  {
    files: ['docs-site/**/*.{js,jsx,mjs}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      // Allow relaxed rules for documentation site
      '@typescript-eslint/no-unused-vars': 'off',
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'no-undef': 'off',
    },
  },
  // Settings for packages/cli/index.js entry point
  {
    files: ['packages/cli/index.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-undef': 'off',
      'no-console': 'off',
    },
  },
  // Settings for integration tests JS files
  {
    files: ['integration-tests/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      'no-undef': 'off',
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  // Settings for CLI assets with browser globals
  {
    files: ['packages/cli/assets/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'no-undef': 'off',
      'no-console': 'off',
    },
  },
  // Disable import/no-internal-modules for packages that don't have the plugin
  {
    files: ['packages/webui/**/*', 'packages/web-app/**/*'],
    rules: {
      'import/no-internal-modules': 'off',
    },
  },
  storybook.configs['flat/recommended'],
);
