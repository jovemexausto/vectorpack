import { describe, it, expect } from 'vitest'
import { VPackError, Errors } from './index.js'

describe('VPackError', () => {
  it('is an instance of Error', () => {
    const err = Errors.emptyIndex()
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(VPackError)
  })

  it('carries the correct error code', () => {
    expect(Errors.emptyIndex().code).toBe('EMPTY_INDEX')
    expect(Errors.dimensionMismatch(128, 64).code).toBe('DIMENSION_MISMATCH')
    expect(Errors.modelMismatch('a', 'b').code).toBe('MODEL_MISMATCH')
    expect(Errors.modelHashMismatch('m', 'abc', 'def').code).toBe('MODEL_HASH_MISMATCH')
  })

  it('dimensionMismatch includes expected and got in message', () => {
    const err = Errors.dimensionMismatch(768, 384)
    expect(err.message).toContain('768')
    expect(err.message).toContain('384')
  })

  it('modelMismatch message emphasises it is a hard error', () => {
    const err = Errors.modelMismatch('nomic-embed-text', 'bge-small-en-v1.5')
    expect(err.message).toContain('nomic-embed-text')
    expect(err.message).toContain('bge-small-en-v1.5')
    expect(err.message.toLowerCase()).toContain('hard error')
  })

  it('modelHashMismatch includes model name and both hashes', () => {
    const err = Errors.modelHashMismatch('nomic-embed-text', 'sha256:abc', 'sha256:xyz')
    expect(err.message).toContain('nomic-embed-text')
    expect(err.message).toContain('sha256:abc')
    expect(err.message).toContain('sha256:xyz')
  })

  it('name is VPackError, not just Error', () => {
    expect(Errors.emptyIndex().name).toBe('VPackError')
  })
})
