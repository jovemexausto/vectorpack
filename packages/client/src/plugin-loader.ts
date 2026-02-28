import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

function unwrapModule(mod: unknown): unknown {
  if (mod && typeof mod === 'object' && 'default' in mod) {
    const def = (mod as { default: unknown }).default
    if (def && typeof def === 'object' && 'default' in def) {
      return (def as { default: unknown }).default
    }
    return def
  }
  return mod
}

function resolveWorkspacePluginPath(pluginName: string, workspaceRoot: string): string | null {
  const match = pluginName.match(
    /^@vpack\/(source|output|chunker|embedder|transformer|middleware)-(.+)$/,
  )
  if (!match) return null

  const kind = match[1]
  const name = match[2]
  const baseDir = 'packages/plugins'
  const dirName = `${kind}-${name}`
  const candidate = resolve(workspaceRoot, baseDir, dirName, 'dist', 'index.js')

  return existsSync(candidate) ? candidate : null
}

function resolveFromDir(pluginName: string, baseDir: string): string | null {
  try {
    const requireFromDir = createRequire(resolve(baseDir, 'package.json'))
    return requireFromDir.resolve(pluginName)
  } catch {
    return null
  }
}

export async function loadPlugin<T = unknown>(
  pluginName: string,
  manifestDir?: string,
): Promise<T> {
  try {
    if (manifestDir) {
      const resolved = resolveFromDir(pluginName, manifestDir)
      if (resolved) {
        const mod = await import(pathToFileURL(resolved).href)
        return unwrapModule(mod) as T
      }
    }
    const mod = await import(pluginName)
    return unwrapModule(mod) as T
  } catch {
    const workspaceRoot = process.env['VPACK_WORKSPACE_ROOT']
    if (workspaceRoot) {
      const localPath = resolveWorkspacePluginPath(pluginName, workspaceRoot)
      if (localPath) {
        const mod = await import(pathToFileURL(localPath).href)
        return unwrapModule(mod) as T
      }
    }
    throw new Error(
      `Plugin '${pluginName}' not found. Install it: pnpm add ${pluginName}`,
    )
  }
}
