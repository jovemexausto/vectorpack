import { Command } from 'commander'
import chalk from 'chalk'

export function pushCommand(): Command {
  return new Command('push')
    .description('Push a .vpack artifact to the registry')
    .argument('<pack>', 'path to .vpack file')
    .argument('<ref>', 'registry reference, e.g. @scope/name:1.0.0')
    .option('-r, --registry <url>', 'registry URL', 'https://registry.vpack.dev')
    .action(async (_pack: string, _ref: string, _opts) => {
      // TODO: registry push protocol (RFC-0001 §11.2)
      console.log(chalk.yellow('vpack push — coming soon (registry not yet implemented)'))
    })
}
