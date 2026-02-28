import { Command } from 'commander'
import chalk from 'chalk'
import { readManifest } from '../manifest.js'

export function validateCommand(): Command {
  return new Command('validate')
    .description('Validate a vpack.yml manifest')
    .option('-m, --manifest <path>', 'path to vpack.yml', 'vpack.yml')
    .action(async (opts) => {
      try {
        const manifest = await readManifest(opts.manifest)
        console.log(chalk.green(`✓ ${manifest.name}@${manifest.version} — manifest is valid`))
      } catch (err) {
        console.error(chalk.red(`✗ Invalid manifest: ${(err as Error).message}`))
        process.exit(1)
      }
    })
}
