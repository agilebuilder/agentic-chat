import { describe, expect, it, vi } from 'vitest'
import { createRendererRegistry } from './renderers.js'

const renderer = () => null

describe('renderer registry', () => {
  it('keeps registrations isolated per registry instance', () => {
    const first = createRendererRegistry()
    const second = createRendererRegistry()

    first.tool('query', renderer)
    first.result('report', renderer)
    first.artifact('text/csv', renderer)
    first.artifactPreview('text/csv', renderer)
    first.message('markdown', renderer)

    expect(first.resolveTool('query')).toBe(renderer)
    expect(first.resolveResult('report')).toBe(renderer)
    expect(first.resolveArtifact('text/csv')).toBe(renderer)
    expect(first.resolveArtifactPreview('text/csv')).toBe(renderer)
    expect(first.resolveMessage('markdown')).toBe(renderer)
    expect(second.resolveTool('query')).toBeUndefined()
  })

  it('supports wildcard fallback, replacement, and safe unregister', () => {
    const registry = createRendererRegistry()
    const fallback = () => null
    const replacement = () => null
    const listener = vi.fn()
    registry.subscribe(listener)

    const unregisterFallback = registry.tool('*', fallback)
    const unregisterExact = registry.tool('query', renderer)
    registry.tool('query', replacement)
    unregisterExact()

    expect(registry.resolveTool('query')).toBe(replacement)
    expect(registry.resolveTool('unknown')).toBe(fallback)
    unregisterFallback()
    expect(registry.resolveTool('unknown')).toBeUndefined()
    expect(listener).toHaveBeenCalledTimes(4)
  })
})
