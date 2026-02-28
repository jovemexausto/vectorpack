import { Command } from 'commander'
import chalk from 'chalk'

export function pullCommand(): Command {
  return new Command('pull')
    .description('Pull a .vpack artifact from the registry')
    .argument('<ref>', 'registry reference, e.g. @community/react-docs:latest')
    .option('-o, --output <dir>', 'output directory', '.')
    .option('-r, --registry <url>', 'registry URL', 'https://registry.vpack.dev')
    .option('--section <id>', 'pull a specific section only (partial download)')
    .action(async (_ref: string, _opts) => {
      // TODO: registry pull protocol (RFC-0001 §11.1)
      console.log(chalk.yellow('vpack pull — coming soon (registry not yet implemented)'))
    })
}
