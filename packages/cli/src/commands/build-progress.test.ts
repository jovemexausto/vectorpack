import { describe, it, expect } from 'vitest'
import { createBuildReporter, renderBar } from './build-progress.js'

describe('build progress helpers', () => {
  it('renders a fixed-width bar', () => {
    expect(renderBar(0, 0, 10)).toBe('[----------]')
    expect(renderBar(5, 10, 10)).toBe('[#####-----]')
  })

  it('logs progress when not interactive', () => {
    const messages: string[] = []
    const reporter = createBuildReporter({
      isInteractive: false,
      log: (msg) => messages.push(msg),
      spinner: {
        start() {},
        succeed() {},
        fail() {},
        setText(_text: string) {},
      },
    })

    reporter.onChunkProgress?.({ source: '@vpack/source-fs', docs: 2, chunks: 10 })
    reporter.onEmbedProgress?.({ current: 25, total: 100 })

    expect(messages[0]).toBe('Chunking... 2 docs / 10 chunks')
    expect(messages[1]).toContain('Embedding... [')
    expect(messages[1]).toContain('25% (25/100)')
  })

  it('updates spinner text when interactive', () => {
    let text = ''
    const reporter = createBuildReporter({
      isInteractive: true,
      log: () => {},
      spinner: {
        start() {},
        succeed() {},
        fail() {},
        setText(value: string) {
          text = value
        },
      },
    })

    reporter.onChunkProgress?.({ source: '@vpack/source-fs', docs: 1, chunks: 3 })
    expect(text).toBe('Chunking... 1 docs / 3 chunks')
  })
})
