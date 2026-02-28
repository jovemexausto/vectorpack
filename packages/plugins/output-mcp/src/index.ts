import type { VPackOutput, VPackIndex, OutputDescription } from '@vpack/core'

export interface McpOutputConfig {
  /** Port to expose the MCP resource server on. Default: 3333 */
  port?: number
  /** Resource name exposed via MCP. Default: pack name from manifest */
  resource_name?: string
}

// TODO: implement MCP resource server using the MCP SDK
// The sink should expose the pack as an MCP resource endpoint
// that agents and LLM tools can query via the standard MCP protocol.

export const McpOutput: VPackOutput<McpOutputConfig> = {
  async push(_index: VPackIndex, _config: McpOutputConfig): Promise<void> {
    throw new Error('@vpack/output-mcp is not yet implemented. Contributions welcome!')
  },

  describe(_config: McpOutputConfig): OutputDescription {
    return {
      plugin: '@vpack/output-mcp',
      version: '0.1.0',
    }
  },
}

export default McpOutput
