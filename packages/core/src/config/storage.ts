/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { getProjectHash, OLLAMA_DIR } from '../utils/paths.js';

// Re-export OLLAMA_DIR for other modules
export { OLLAMA_DIR };

export const GOOGLE_ACCOUNTS_FILENAME = 'google_accounts.json';
export const OAUTH_FILE = 'oauth_creds.json';
export const SSH_CREDENTIALS_FILE = 'ssh_credentials.json';
const TMP_DIR_NAME = 'tmp';
const BIN_DIR_NAME = 'bin';
const PROJECT_DIR_NAME = 'projects';
const IDE_DIR_NAME = 'ide';
const DEBUG_DIR_NAME = 'debug';

export class Storage {
  private readonly targetDir: string;

  constructor(targetDir: string) {
    this.targetDir = targetDir;
  }

  static getGlobalOllamaDir(): string {
    const homeDir = os.homedir();
    if (!homeDir) {
      return path.join(os.tmpdir(), '.ollama-code');
    }
    return path.join(homeDir, OLLAMA_DIR);
  }

  static getMcpOAuthTokensPath(): string {
    return path.join(Storage.getGlobalOllamaDir(), 'mcp-oauth-tokens.json');
  }

  static getGlobalSettingsPath(): string {
    return path.join(Storage.getGlobalOllamaDir(), 'settings.json');
  }

  static getInstallationIdPath(): string {
    return path.join(Storage.getGlobalOllamaDir(), 'installation_id');
  }

  static getGoogleAccountsPath(): string {
    return path.join(Storage.getGlobalOllamaDir(), GOOGLE_ACCOUNTS_FILENAME);
  }

  static getUserCommandsDir(): string {
    return path.join(Storage.getGlobalOllamaDir(), 'commands');
  }

  static getGlobalMemoryFilePath(): string {
    return path.join(Storage.getGlobalOllamaDir(), 'memory.md');
  }

  static getGlobalTempDir(): string {
    return path.join(Storage.getGlobalOllamaDir(), TMP_DIR_NAME);
  }

  static getGlobalDebugDir(): string {
    return path.join(Storage.getGlobalOllamaDir(), DEBUG_DIR_NAME);
  }

  static getDebugLogPath(sessionId: string): string {
    return path.join(Storage.getGlobalDebugDir(), `${sessionId}.txt`);
  }

  static getGlobalIdeDir(): string {
    return path.join(Storage.getGlobalOllamaDir(), IDE_DIR_NAME);
  }

  static getGlobalBinDir(): string {
    return path.join(Storage.getGlobalOllamaDir(), BIN_DIR_NAME);
  }

  getOllamaDir(): string {
    return path.join(this.targetDir, OLLAMA_DIR);
  }

  getProjectDir(): string {
    const projectId = this.sanitizeCwd(this.getProjectRoot());
    const projectsDir = path.join(
      Storage.getGlobalOllamaDir(),
      PROJECT_DIR_NAME,
    );
    return path.join(projectsDir, projectId);
  }

  getProjectTempDir(): string {
    const hash = getProjectHash(this.getProjectRoot());
    const tempDir = Storage.getGlobalTempDir();
    const targetDir = path.join(tempDir, hash);
    return targetDir;
  }

  ensureProjectTempDirExists(): void {
    fs.mkdirSync(this.getProjectTempDir(), { recursive: true });
  }

  static getOAuthCredsPath(): string {
    return path.join(Storage.getGlobalOllamaDir(), OAUTH_FILE);
  }

  getProjectRoot(): string {
    return this.targetDir;
  }

  getHistoryDir(): string {
    const hash = getProjectHash(this.getProjectRoot());
    const historyDir = path.join(Storage.getGlobalOllamaDir(), 'history');
    const targetDir = path.join(historyDir, hash);
    return targetDir;
  }

  getWorkspaceSettingsPath(): string {
    return path.join(this.getOllamaDir(), 'settings.json');
  }

  getProjectCommandsDir(): string {
    return path.join(this.getOllamaDir(), 'commands');
  }

  getProjectTempCheckpointsDir(): string {
    return path.join(this.getProjectTempDir(), 'checkpoints');
  }

  getExtensionsDir(): string {
    return path.join(this.getOllamaDir(), 'extensions');
  }

  getExtensionsConfigPath(): string {
    return path.join(this.getExtensionsDir(), 'ollama-extension.json');
  }

  getUserSkillsDir(): string {
    return path.join(Storage.getGlobalOllamaDir(), 'skills');
  }

  getHistoryFilePath(): string {
    return path.join(this.getProjectTempDir(), 'shell_history');
  }

  // ============================================================================
  // SSH Credentials Storage
  // ============================================================================

  /**
   * Get the path to SSH credentials file
   */
  static getSSHCredentialsPath(): string {
    return path.join(Storage.getGlobalOllamaDir(), SSH_CREDENTIALS_FILE);
  }

  /**
   * Load SSH credentials from storage
   */
  static loadSSHCredentials(): SSHCredentialsStore {
    const filePath = Storage.getSSHCredentialsPath();
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content) as SSHCredentialsStore;
      }
    } catch (error) {
      // Return empty store if file doesn't exist or is corrupted
    }
    return { hosts: {} };
  }

  /**
   * Save SSH credentials to storage
   */
  static saveSSHCredentials(store: SSHCredentialsStore): void {
    const filePath = Storage.getSSHCredentialsPath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf-8');
  }

  /**
   * Get SSH host configuration by name
   */
  static getSSHHost(name: string): SSHHostConfig | undefined {
    const store = Storage.loadSSHCredentials();
    return store.hosts[name];
  }

  /**
   * Add or update SSH host configuration
   */
  static setSSHHost(name: string, config: SSHHostConfig): void {
    const store = Storage.loadSSHCredentials();
    store.hosts[name] = {
      ...config,
      createdAt: config.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    Storage.saveSSHCredentials(store);
  }

  /**
   * Remove SSH host configuration
   */
  static removeSSHHost(name: string): boolean {
    const store = Storage.loadSSHCredentials();
    if (store.hosts[name]) {
      delete store.hosts[name];
      Storage.saveSSHCredentials(store);
      return true;
    }
    return false;
  }

  /**
   * List all SSH host configurations
   */
  static listSSHHosts(): Record<string, SSHHostConfig> {
    const store = Storage.loadSSHCredentials();
    return store.hosts;
  }

  private sanitizeCwd(cwd: string): string {
    // On Windows, normalize to lowercase for case-insensitive matching
    const normalizedCwd = os.platform() === 'win32' ? cwd.toLowerCase() : cwd;
    return normalizedCwd.replace(/[^a-zA-Z0-9]/g, '-');
  }
}

/**
 * SSH Host Configuration
 */
export interface SSHHostConfig {
  /** Hostname or IP address */
  host: string;
  /** Username for SSH */
  user: string;
  /** SSH port (default: 22) */
  port?: number;
  /** Path to SSH private key file */
  identity_file?: string;
  /** Password (not recommended, use identity_file instead) */
  password?: string;
  /** SSH options */
  options?: Record<string, string>;
  /** Description of the host */
  description?: string;
  /** Tags for organization */
  tags?: string[];
  /** Creation timestamp */
  createdAt?: string;
  /** Last update timestamp */
  updatedAt?: string;
}

/**
 * SSH Credentials Store
 */
export interface SSHCredentialsStore {
  /** Named host configurations */
  hosts: Record<string, SSHHostConfig>;
}
