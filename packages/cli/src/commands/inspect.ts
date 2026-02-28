import { Command } from 'commander'
import chalk from 'chalk'
import { engine } from '@vpack/engine'
import { readFileSync } from 'node:fs'

export function inspectCommand(): Command {
  return new Command('inspect')
    .description('Inspect the contents of a .vpack artifact')
    .argument('<pack>', 'path to .vpack file')
    .option('--section <id>', 'inspect a specific section')
    .option('--chunk <id>', 'inspect a specific chunk by ID')
    .action(async (pack: string, opts) => {
      try {
        const bytes = readFileSync(pack)
        const index = engine.deserialize(new Uint8Array(bytes))
        const manifest = index.manifest()
        const embedder = manifest.plugins.find((p: typeof manifest.plugins[number]) => p.kind === 'embedder')
        const chunker = manifest.plugins.find((p: typeof manifest.plugins[number]) => p.kind === 'chunker')
        const sourceCount = manifest.plugins.filter((p: typeof manifest.plugins[number]) => p.kind === 'source').length

        console.log(chalk.bold(`\n${manifest.name}@${manifest.version}\n`))
        console.log(`  ${chalk.dim('chunks:')}     ${index.chunkCount()}`)
        console.log(`  ${chalk.dim('dimensions:')} ${index.dimensions()}`)
        console.log(`  ${chalk.dim('model:')}      ${embedder?.['model'] ?? 'unknown'}`)
        console.log(`  ${chalk.dim('chunker:')}    ${chunker?.use ?? 'unknown'}`)
        console.log(`  ${chalk.dim('sources:')}    ${sourceCount}`)
        console.log()
      } catch (err) {
        console.error(chalk.red((err as Error).message))
        process.exit(1)
      }
    })
}
