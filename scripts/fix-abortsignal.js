#!/usr/bin/env node

/**
 * Script to replace AbortSignal.any() calls with abortSignalAny() utility function
 * This works around TypeScript type issues with AbortSignal.any in Node.js types
 */

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

const filesToFix = [
  'packages/core/src/tools/*.ts',
  'packages/core/src/core/*.ts',
  'packages/core/src/plugins/builtin/dev-tools/*/index.ts',
];

const importStatement = `import { abortSignalAny } from '../utils/nodePolyfills.js';`;
const importStatementPlugin = `import { abortSignalAny } from '../../../../utils/nodePolyfills.js';`;

function fixFile(filePath) {
  let content = readFileSync(filePath, 'utf-8');
  let modified = false;

  // Check if file uses AbortSignal.any
  if (!content.includes('AbortSignal.any')) {
    return false;
  }

  // Skip if already fixed
  if (content.includes('abortSignalAny')) {
    return false;
  }

  // Replace AbortSignal.any with abortSignalAny
  content = content.replace(/AbortSignal\.any\(/g, 'abortSignalAny(');
  modified = true;

  // Add import statement
  const isPlugin = filePath.includes('/plugins/');
  const importToAdd = isPlugin ? importStatementPlugin : importStatement;

  // Find the last import statement and add our import after it
  const importRegex = /^import .+?;?\s*$/gm;
  const imports = [...content.matchAll(importRegex)];

  if (imports.length > 0) {
    const lastImport = imports[imports.length - 1];
    const insertPos = lastImport.index + lastImport[0].length;
    content =
      content.slice(0, insertPos) +
      '\n' +
      importToAdd +
      content.slice(insertPos);
  } else {
    // Add at the beginning if no imports found
    content = importToAdd + '\n\n' + content;
  }

  if (modified) {
    writeFileSync(filePath, content);
    return true;
  }

  return false;
}

// Find all files matching the patterns
const allFiles = [];
for (const pattern of filesToFix) {
  const files = glob.sync(pattern);
  allFiles.push(...files);
}

console.log(`Found ${allFiles.length} files to check`);

let fixedCount = 0;
for (const file of allFiles) {
  if (fixFile(file)) {
    console.log(`Fixed: ${file}`);
    fixedCount++;
  }
}

console.log(`\nFixed ${fixedCount} files`);
