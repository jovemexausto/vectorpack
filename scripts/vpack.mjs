import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const initCwd = process.env.INIT_CWD ?? process.cwd()
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cliPath = resolve(rootDir, 'packages/cli/dist/cli.js')

process.env['VPACK_WORKSPACE_ROOT'] ??= rootDir
process.chdir(initCwd)
await import(pathToFileURL(cliPath).href)
