// MCP Tools Plugin - Index
// Re-export all public API from mcp-client
export { McpClient } from './mcp-client/index.js';
export type { SendSdkMcpMessage, DiscoveredMCPPrompt } from './mcp-client/index.js';
export {
  MCPServerStatus,
  MCPDiscoveryState,
  getMCPServerStatus,
  getMCPDiscoveryState,
  getAllMCPServerStatuses,
  updateMCPServerStatus,
  addMCPStatusChangeListener,
  removeMCPStatusChangeListener,
  discoverMcpTools,
  connectAndDiscover,
  discoverTools,
  discoverPrompts,
  connectToMcpServer,
  createTransport,
  hasNetworkTransport,
  isEnabled,
  mcpServerRequiresOAuth,
} from './mcp-client/index.js';
export { DiscoveredMCPTool } from './mcp-tool/index.js';
export { McpClientManager } from './mcp-client-manager/index.js';
export { SdkControlClientTransport } from './sdk-control-client-transport/index.js';

// Plugin definition
import type { PluginDefinition } from '../../types.js';

const mcpToolsPlugin: PluginDefinition = {
  metadata: {
    id: 'mcp-tools',
    name: 'MCP Tools',
    version: '1.0.0',
    description: 'Model Context Protocol tools for external tool integration',
    author: 'Ollama Code Team',
    tags: ['core', 'builtin', 'mcp', 'protocol'],
    enabledByDefault: true,
  },
  
  toolClasses: [], // MCP tools are discovered dynamically
  
  hooks: {
    onLoad: async (context) => {
      context.logger.info('MCP Tools plugin loaded');
    },
    
    onEnable: async (context) => {
      context.logger.info('MCP Tools plugin enabled');
    },
  },
};

export default mcpToolsPlugin;
