import type { VPackSource, RawDocument, SourceDescription, BuildContext } from '@vpack/core'
import { readFileSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve, relative, extname } from 'node:path'
import { glob } from 'glob'

// ── Config ────────────────────────────────────────────────────────────────────

export interface FsSourceConfig {
  path: string
  include?: string[]       // glob patterns, default: ['**/*.md', '**/*.txt']
  exclude?: string[]       // glob patterns, default: ['**/node_modules/**']
  encoding?: BufferEncoding
}

const DEFAULT_INCLUDE = ['**/*.md', '**/*.txt', '**/*.html']
const DEFAULT_EXCLUDE = ['**/node_modules/**', '**/dist/**', '**/.git/**']

// ── Plugin ────────────────────────────────────────────────────────────────────

export const FsSource: VPackSource<FsSourceConfig> = {
  async *fetch(config: FsSourceConfig, _ctx: BuildContext): AsyncIterable<RawDocument> {
    const root = resolve(config.path)
    const include = config.include ?? DEFAULT_INCLUDE
    const ignore = config.exclude ?? DEFAULT_EXCLUDE
    const encoding = config.encoding ?? 'utf-8'

    const files = await glob(include, { cwd: root, ignore, absolute: true })

    for (const filePath of files.sort()) {
      try {
        const content = readFileSync(filePath, encoding)
        const stat = statSync(filePath)
        const relPath = relative(root, filePath)

        yield {
          id: relPath,                    // stable: relative path is the identifier
          content,
          metadata: {
            _plugin: '@vpack/source-fs',
            file_path: filePath,
            rel_path: relPath,
            extension: extname(filePath),
            size_bytes: stat.size,
          },
          updated_at: stat.mtime,
        }
      } catch {
        // Skip unreadable files silently — log at debug level in future
      }
    }
  },

  async fingerprint(config: FsSourceConfig): Promise<string> {
    // Fingerprint = hash of all {relPath + mtime + size} tuples, sorted.
    // If nothing changed, fingerprint is identical → build cache hit.
    const root = resolve(config.path)
    const include = config.include ?? DEFAULT_INCLUDE
    const ignore = config.exclude ?? DEFAULT_EXCLUDE

    const files = await glob(include, { cwd: root, ignore, absolute: true })
    const hash = createHash('sha256')

    for (const filePath of files.sort()) {
      try {
        const stat = statSync(filePath)
        const rel = relative(root, filePath)
        hash.update(`${rel}:${stat.mtimeMs}:${stat.size}`)
      } catch {
        // skip
      }
    }

    return hash.digest('hex')
  },

  describe(config: FsSourceConfig): SourceDescription {
    return {
      plugin: '@vpack/source-fs',
      version: '0.1.0',
      last_fetched_at: new Date().toISOString(),
    }
  },
}

export default FsSource
