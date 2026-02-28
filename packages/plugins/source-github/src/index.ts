import type { VPackSource, RawDocument, SourceDescription, BuildContext } from '@vpack/core'

export interface GithubSourceConfig {
  repo: string               // e.g. "owner/repo"
  ref?: string               // branch or tag, default: "main"
  include?: string[]         // glob patterns for file paths
  include_issues?: boolean   // include resolved issues (default: true)
  include_prs?: boolean      // include merged PR descriptions (default: false)
}

// TODO: implement using @octokit/rest
// Docs: https://octokit.github.io/rest.js

export const GithubSource: VPackSource<GithubSourceConfig> = {
  async *fetch(_config: GithubSourceConfig, _ctx: BuildContext): AsyncIterable<RawDocument> {
    throw new Error('@vpack/source-github is not yet implemented. Contributions welcome!')
  },

  async fingerprint(_config: GithubSourceConfig): Promise<string> {
    throw new Error('@vpack/source-github is not yet implemented.')
  },

  describe(_config: GithubSourceConfig): SourceDescription {
    return {
      plugin: '@vpack/source-github',
      version: '0.1.0',
      last_fetched_at: new Date().toISOString(),
    }
  },
}

export default GithubSource
