import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { readManifest } from '../manifest.js'
import { buildPack } from '@vpack/build'
import { createBuildReporter } from './build-progress.js'

export function buildCommand(): Command {
  return new Command('build')
    .description('Build a .vpack artifact from a manifest')
    .option('-m, --manifest <path>', 'path to vpack.yml', 'vpack.yml')
    .option('-o, --output <path>', 'output path for the .vpack file', './dist/pack.vpack')
    .option('--no-cache', 'ignore source fingerprint cache, force full rebuild')
    .action(async (opts) => {
      const isInteractive = Boolean(process.stdout.isTTY) && process.env.TERM !== 'dumb'
      const spinner = ora({ isEnabled: isInteractive })
      const reporter = createBuildReporter({
        isInteractive,
        log: (message) => console.log(message),
        spinner: {
          start: (message) => void spinner.start(message),
          succeed: (message) => void spinner.succeed(message),
          fail: (message) => void spinner.fail(message),
          setText: (message) => {
            spinner.text = message
          },
        },
      })

      try {
        console.log(chalk.bold('\nvpack build\n'))

        reporter.start('Reading manifest...')
        const manifest = await readManifest(opts.manifest)
        reporter.succeed(`Manifest: ${chalk.cyan(manifest.name)}@${manifest.version}`)

        const stats = await buildPack({
          manifest,
          manifestPath: opts.manifest,
          output: opts.output,
          cache: opts.cache,
          reporter,
        })
        void stats

        console.log(chalk.green(`\n→ ${opts.output}\n`))
      } catch (err) {
        reporter.fail(chalk.red('Build failed'))
        console.error(chalk.red((err as Error).message))
        process.exit(1)
      }
    })
}
