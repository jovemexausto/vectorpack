import type { VPackSource, RawDocument, SourceDescription, BuildContext } from '@vpack/core'

export interface NotionSourceConfig {
  database_id?: string        // fetch all pages in a database
  page_id?: string            // fetch a single page and its children
  filter?: {
    property: string
    equals: string
  }
}

// TODO: implement using @notionhq/client
// Docs: https://developers.notion.com/reference/intro

export const NotionSource: VPackSource<NotionSourceConfig> = {
  async *fetch(_config: NotionSourceConfig, _ctx: BuildContext): AsyncIterable<RawDocument> {
    throw new Error('@vpack/source-notion is not yet implemented. Contributions welcome!')
  },

  async fingerprint(_config: NotionSourceConfig): Promise<string> {
    throw new Error('@vpack/source-notion is not yet implemented.')
  },

  describe(_config: NotionSourceConfig): SourceDescription {
    return {
      plugin: '@vpack/source-notion',
      version: '0.1.0',
      last_fetched_at: new Date().toISOString(),
    }
  },
}

export default NotionSource
