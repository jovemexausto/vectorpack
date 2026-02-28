#!/usr/bin/env node
// vpack CLI — entry point

import { Command } from 'commander'
import { buildCommand } from './commands/build.js'
import { queryCommand } from './commands/query.js'
import { inspectCommand } from './commands/inspect.js'
import { validateCommand } from './commands/validate.js'
import { pushCommand } from './commands/push.js'
import { pullCommand } from './commands/pull.js'

const program = new Command()

program
  .name('vpack')
  .description('Build, query, and distribute knowledge artifacts')
  .version('0.1.0')

program.addCommand(buildCommand())
program.addCommand(queryCommand())
program.addCommand(inspectCommand())
program.addCommand(validateCommand())
program.addCommand(pushCommand())
program.addCommand(pullCommand())

program.parse()
