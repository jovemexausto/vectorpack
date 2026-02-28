import { Command } from 'commander'
import chalk from 'chalk'
import { load } from '@vpack/client'

export function queryCommand(): Command {
  return new Command('query')
    .description('Query a local .vpack artifact')
    .argument('<pack>', 'path to .vpack file or registry reference')
    .argument('<query>', 'query text')
    .option('-k, --top-k <n>', 'number of results', '10')
    .option('--min-score <n>', 'minimum similarity score (0-1)', '0')
    .option('--json', 'output raw JSON')
    .action(async (pack: string, query: string, opts) => {
      try {
        const kb = await load(pack)
        const results = await kb.query(query, {
          topK: Number(opts.topK),
          minScore: Number(opts.minScore),
        })

        if (opts.json) {
          console.log(JSON.stringify(results, null, 2))
          return
        }

        console.log(chalk.dim(`Pack: ${pack}`))
        console.log(chalk.dim(`Query: "${query}"`))
        console.log(chalk.dim(`Results: ${results.length}`))
        for (const res of results) {
          const score = res.score.toFixed(3)
          const text = res.chunk.text.replace(/\s+/g, ' ').slice(0, 140)
          console.log(`${chalk.cyan(`#${res.rank + 1}`)} ${chalk.dim(score)} ${text}`)
        }
      } catch (err) {
        console.error(chalk.red((err as Error).message))
        process.exit(1)
      }
    })
}
