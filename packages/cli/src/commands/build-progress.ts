import type { BuildReporter } from '@vpack/build'

type SpinnerLike = {
  start(message: string): void
  succeed(message: string): void
  fail(message: string): void
  setText(message: string): void
}

type ReporterOptions = {
  isInteractive: boolean
  log: (message: string) => void
  spinner: SpinnerLike
}

export function renderBar(current: number, total: number, width = 20): string {
  const safeTotal = Math.max(total, 1)
  const ratio = Math.min(1, Math.max(0, current / safeTotal))
  const filled = Math.round(ratio * width)
  return `[${'#'.repeat(filled)}${'-'.repeat(width - filled)}]`
}

export function formatChunkProgress(docs: number, chunks: number): string {
  return `Chunking... ${docs} docs / ${chunks} chunks`
}

export function formatEmbedProgress(current: number, total: number): string {
  const bar = renderBar(current, total)
  const percent = total === 0 ? 0 : Math.round((current / total) * 100)
  return `Embedding... ${bar} ${percent}% (${current}/${total})`
}

export function createBuildReporter(options: ReporterOptions): BuildReporter {
  const { isInteractive, log, spinner } = options

  const start = (message: string) => {
    if (isInteractive) {
      spinner.start(message)
      return
    }
    log(`- ${message}`)
  }

  const succeed = (message: string) => {
    if (isInteractive) {
      spinner.succeed(message)
      return
    }
    log(`✔ ${message}`)
  }

  const fail = (message: string) => {
    if (isInteractive) {
      spinner.fail(message)
      return
    }
    log(`✖ ${message}`)
  }

  const setText = (message: string) => {
    if (isInteractive) {
      spinner.setText(message)
      return
    }
    log(message)
  }

  return {
    start,
    succeed,
    fail,
    setText,
    onChunkProgress: ({ docs, chunks }) => {
      setText(formatChunkProgress(docs, chunks))
    },
    onEmbedProgress: ({ current, total }) => {
      setText(formatEmbedProgress(current, total))
    },
  }
}
