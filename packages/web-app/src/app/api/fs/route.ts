/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Filesystem API Route
 *
 * Provides secure file system access for the web UI.
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

/**
 * Base directory for file operations (project root)
 */
const BASE_DIR = process.env.PROJECT_DIR || process.cwd();

/**
 * Security: Resolve path and ensure it's within BASE_DIR
 */
function resolveSecurePath(requestPath: string): string | null {
  try {
    const resolved = path.resolve(BASE_DIR, requestPath);
    if (!resolved.startsWith(BASE_DIR)) {
      return null; // Path traversal attempt
    }
    return resolved;
  } catch {
    return null;
  }
}

/**
 * GET /api/fs?path=...
 *
 * List directory contents or read file
 */
export async function GET(request: NextRequest) {
  const requestPath = request.nextUrl.searchParams.get('path') || '/';
  const securePath = resolveSecurePath(requestPath);

  if (!securePath) {
    return NextResponse.json(
      { error: 'Invalid path' },
      { status: 400 }
    );
  }

  try {
    const stats = await fs.stat(securePath);

    if (stats.isDirectory()) {
      const entries = await fs.readdir(securePath, { withFileTypes: true });
      const items = await Promise.all(
        entries.map(async (entry) => {
          const entryPath = path.join(securePath, entry.name);
          const relativePath = path.relative(BASE_DIR, entryPath);

          let size = 0;
          try {
            if (entry.isFile()) {
              const stat = await fs.stat(entryPath);
              size = stat.size;
            }
          } catch {
            // Ignore errors
          }

          return {
            name: entry.name,
            path: `/${relativePath}`,
            type: entry.isDirectory() ? 'directory' : 'file',
            size,
          };
        })
      );

      // Sort: directories first, then files alphabetically
      items.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      return NextResponse.json({
        path: requestPath,
        type: 'directory',
        items,
      });
    } else {
      // Read file
      const content = await fs.readFile(securePath, 'utf-8');

      return NextResponse.json({
        path: requestPath,
        type: 'file',
        name: path.basename(securePath),
        content,
        size: stats.size,
        extension: path.extname(securePath),
      });
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json(
        { error: 'File or directory not found' },
        { status: 404 }
      );
    }
    console.error('Filesystem error:', error);
    return NextResponse.json(
      { error: 'Failed to access path' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/fs?path=...
 *
 * Write file content
 */
export async function PUT(request: NextRequest) {
  const requestPath = request.nextUrl.searchParams.get('path');
  if (!requestPath) {
    return NextResponse.json(
      { error: 'Path is required' },
      { status: 400 }
    );
  }

  const securePath = resolveSecurePath(requestPath);
  if (!securePath) {
    return NextResponse.json(
      { error: 'Invalid path' },
      { status: 400 }
    );
  }

  try {
    const { content } = await request.json();
    await fs.writeFile(securePath, content, 'utf-8');

    return NextResponse.json({ success: true, path: requestPath });
  } catch (error) {
    console.error('Write error:', error);
    return NextResponse.json(
      { error: 'Failed to write file' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fs?path=...
 *
 * Create directory
 */
export async function POST(request: NextRequest) {
  const requestPath = request.nextUrl.searchParams.get('path');
  if (!requestPath) {
    return NextResponse.json(
      { error: 'Path is required' },
      { status: 400 }
    );
  }

  const securePath = resolveSecurePath(requestPath);
  if (!securePath) {
    return NextResponse.json(
      { error: 'Invalid path' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const { type = 'file' } = body;

    if (type === 'directory') {
      await fs.mkdir(securePath, { recursive: true });
    } else {
      await fs.writeFile(securePath, '', 'utf-8');
    }

    return NextResponse.json({ success: true, path: requestPath });
  } catch (error) {
    console.error('Create error:', error);
    return NextResponse.json(
      { error: 'Failed to create' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/fs?path=...
 *
 * Delete file or directory
 */
export async function DELETE(request: NextRequest) {
  const requestPath = request.nextUrl.searchParams.get('path');
  if (!requestPath) {
    return NextResponse.json(
      { error: 'Path is required' },
      { status: 400 }
    );
  }

  const securePath = resolveSecurePath(requestPath);
  if (!securePath) {
    return NextResponse.json(
      { error: 'Invalid path' },
      { status: 400 }
    );
  }

  try {
    const stats = await fs.stat(securePath);

    if (stats.isDirectory()) {
      await fs.rm(securePath, { recursive: true });
    } else {
      await fs.unlink(securePath);
    }

    return NextResponse.json({ success: true, path: requestPath });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete' },
      { status: 500 }
    );
  }
}
