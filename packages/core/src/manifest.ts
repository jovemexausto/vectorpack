import { z } from 'zod'
import type { PackManifest, VPackPluginConfig } from './index.js'

const PluginKindSchema = z.enum([
  'source',
  'transformer',
  'chunker',
  'embedder',
  'output',
  'middleware',
])

const PluginConfigSchema = z
  .object({
    kind: PluginKindSchema,
    use: z.string(),
    stage: z.enum(['pre-chunk', 'post-chunk']).optional(),
  })
  .passthrough()

const ManifestInputSchema = z
  .object({
    vpack: z.string(),
    name: z.string().regex(/^@[a-z0-9-]+\/[a-z0-9-]+$/, 'name must be scoped: @scope/name'),
    version: z.string().regex(/^\d+\.\d+\.\d+/, 'version must be semver'),
    description: z.string().optional(),
    license: z.string().optional(),
    homepage: z.string().url().optional(),
    plugins: z.array(PluginConfigSchema).optional(),
  })
  .passthrough()

function formatIssues(issues: z.ZodIssue[]): string {
  return issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
}

function normalizePlugin(plugin: VPackPluginConfig): VPackPluginConfig {
  if (plugin.stage === undefined) {
    const { stage, ...rest } = plugin
    return rest
  }
  return plugin
}

export function parseManifest(input: unknown): PackManifest {
  const result = ManifestInputSchema.safeParse(input)
  if (!result.success) {
    throw new Error(`Invalid manifest:\n${formatIssues(result.error.issues)}`)
  }

  const data = result.data as Record<string, unknown>
  const deprecatedFields = ['sources', 'chunk', 'outputs', 'filters', 'embed']
  const present = deprecatedFields.filter((field) => field in data)
  if (present.length > 0) {
    throw new Error(
      `Invalid manifest: deprecated top-level fields: ${present.join(', ')}. Use plugins instead.`,
    )
  }

  const plugins: VPackPluginConfig[] = [...((data.plugins as VPackPluginConfig[] | undefined) ?? [])].map(normalizePlugin)

  const sourceCount = plugins.filter((p) => p.kind === 'source').length
  const chunkerCount = plugins.filter((p) => p.kind === 'chunker').length
  const embedderCount = plugins.filter((p) => p.kind === 'embedder').length

  if (sourceCount === 0) {
    throw new Error('Invalid manifest: at least one source plugin is required')
  }
  if (chunkerCount !== 1) {
    throw new Error('Invalid manifest: exactly one chunker plugin is required')
  }
  if (embedderCount !== 1) {
    throw new Error('Invalid manifest: exactly one embedder plugin is required')
  }

  const manifest: PackManifest = {
    vpack: data.vpack as string,
    name: data.name as string,
    version: data.version as string,
    plugins,
  }

  if (data.description !== undefined) manifest.description = data.description as string
  if (data.license !== undefined) manifest.license = data.license as string
  if (data.homepage !== undefined) manifest.homepage = data.homepage as string

  return manifest
}
