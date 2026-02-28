import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'

describe('CJS interop', () => {
  it('can require @vpack/core from CJS', () => {
    const require = createRequire(__filename)
    const core = require('@vpack/core')
    expect(core).toBeTruthy()
  })
})
