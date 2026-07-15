import { describe, expect, it } from 'vitest'
import type { CanonicalEvent } from './events.js'
import { createInitialState } from './model.js'
import { reduceEvent, replayEvents } from './reducer.js'
import { createSnapshot, importSnapshot } from './snapshot.js'

const event = (sequence: number, type: CanonicalEvent['type'], data: CanonicalEvent['data']): CanonicalEvent => ({
  schemaVersion: '0.1', eventId: `artifact:${sequence}`, type, threadId: 'thread-1', runId: 'run-1', sequence,
  timestamp: `2026-07-15T10:00:${String(sequence).padStart(2, '0')}Z`, data, source: 'artifact-test',
} as CanonicalEvent)

describe('Artifact lifecycle', () => {
  it('tracks immutable versions, provenance and availability metadata', () => {
    const state = replayEvents([
      event(1, 'run.started', {}),
      event(2, 'tool.started', { activityId: 'activity-1', toolCallId: 'tool-1', name: 'create_report' }),
      event(3, 'tool.completed', { toolCallId: 'tool-1', output: 'done' }),
      event(4, 'artifact.created', { artifactId: 'report-v1', name: 'report.pdf', kind: 'application/pdf', provenance: { type: 'tool', activityId: 'activity-1', toolCallId: 'tool-1', label: 'Report generator' } }),
      event(5, 'artifact.available', { artifactId: 'report-v1', uri: 'https://files.example/report.pdf', sizeBytes: 1024, checksum: { algorithm: 'sha256', value: 'abc' }, expiresAt: '2026-07-16T10:00:00Z' }),
      event(6, 'artifact.created', { artifactId: 'report-v2', name: 'report.pdf', kind: 'application/pdf', version: 2, previousArtifactId: 'report-v1' }),
      event(7, 'artifact.failed', { artifactId: 'report-v2', error: { code: 'render_failed', message: 'Render failed' } }),
    ], createInitialState())

    expect(state.artifacts['report-v1']).toMatchObject({ status: 'available', version: 1, sizeBytes: 1024, provenance: { type: 'tool', activityId: 'activity-1', toolCallId: 'tool-1' } })
    expect(state.artifacts['report-v2']).toMatchObject({ status: 'failed', version: 2, previousArtifactId: 'report-v1', error: { code: 'render_failed' } })
    const restored = importSnapshot(createSnapshot(state, 1))
    expect(restored.artifacts).toEqual(state.artifacts)
  })

  it('expires only available artifacts and preserves reducer immutability', () => {
    const started = reduceEvent(createInitialState(), event(1, 'run.started', {}))
    const generating = reduceEvent(started, event(2, 'artifact.created', { artifactId: 'a1', name: 'a.txt', kind: 'text/plain' }))
    expect(started.artifacts.a1).toBeUndefined()
    const invalidExpiry = reduceEvent(generating, event(3, 'artifact.expired', { artifactId: 'a1' }))
    expect(invalidExpiry.artifacts.a1?.status).toBe('generating')
    expect(invalidExpiry.diagnostics.at(-1)?.code).toBe('invalid_transition')
    const available = reduceEvent(generating, event(3, 'artifact.available', { artifactId: 'a1' }))
    const expired = reduceEvent(available, event(4, 'artifact.expired', { artifactId: 'a1' }))
    expect(expired.artifacts.a1).toMatchObject({ status: 'expired', endedAt: '2026-07-15T10:00:04Z' })
  })

  it('allows an available Artifact TTL to expire after its Run completed', () => {
    const state = replayEvents([
      event(1, 'run.started', {}),
      event(2, 'artifact.created', { artifactId: 'a1', name: 'a.txt', kind: 'text/plain' }),
      event(3, 'artifact.available', { artifactId: 'a1' }),
      event(4, 'run.completed', {}),
      event(5, 'artifact.expired', { artifactId: 'a1' }),
    ], createInitialState())
    expect(state.runs['run-1']?.status).toBe('completed')
    expect(state.artifacts.a1?.status).toBe('expired')
    expect(state.diagnostics).toEqual([])
  })

  it('keeps terminal sequence progress when an invalid event precedes Artifact expiry', () => {
    const state = replayEvents([
      event(1, 'run.started', {}),
      event(2, 'artifact.created', { artifactId: 'a1', name: 'a.txt', kind: 'text/plain' }),
      event(3, 'artifact.available', { artifactId: 'a1' }),
      event(4, 'run.completed', {}),
      event(5, 'source.observed', { sourceType: 'heartbeat' }),
      event(6, 'artifact.expired', { artifactId: 'a1' }),
    ], createInitialState())
    expect(state.artifacts.a1?.status).toBe('expired')
    expect(state.streams['run-1']?.lastSequence).toBe(6)
    expect(state.diagnostics).toHaveLength(1)
  })

  it('rejects broken provenance and version chains', () => {
    const started = reduceEvent(createInitialState(), event(1, 'run.started', {}))
    const badSource = reduceEvent(started, event(2, 'artifact.created', { artifactId: 'a1', name: 'a', kind: 'text', provenance: { type: 'tool', toolCallId: 'missing' } }))
    expect(badSource.artifacts.a1).toBeUndefined()
    const badProvenance = reduceEvent(started, event(2, 'artifact.created', { artifactId: 'a1', name: 'a', kind: 'text', provenance: { type: 'unknown' } } as never))
    expect(badProvenance.artifacts.a1).toBeUndefined()
    const skippedVersion = reduceEvent(started, event(2, 'artifact.created', { artifactId: 'a2', name: 'a', kind: 'text', version: 2 }))
    expect(skippedVersion.artifacts.a2).toBeUndefined()

    const available = replayEvents([
      event(1, 'run.started', {}),
      event(2, 'artifact.created', { artifactId: 'v1', name: 'a', kind: 'text' }),
      event(3, 'artifact.available', { artifactId: 'v1' }),
      event(4, 'artifact.created', { artifactId: 'v2', name: 'a', kind: 'text', previousArtifactId: 'v1' }),
    ], createInitialState())
    const fork = reduceEvent(available, event(5, 'artifact.created', { artifactId: 'v2-fork', name: 'a', kind: 'text', previousArtifactId: 'v1' }))
    expect(fork.artifacts['v2-fork']).toBeUndefined()
  })

  it('migrates pre-P3.5 snapshot artifact fields', () => {
    const state = replayEvents([
      event(1, 'run.started', {}),
      event(2, 'activity.started', { activityId: 'source', kind: 'workflow' }),
      event(3, 'artifact.created', { artifactId: 'legacy', name: 'legacy.txt', kind: 'text/plain', provenance: { type: 'agent', activityId: 'source' } }),
    ], createInitialState())
    const snapshot = createSnapshot(state, 1)
    const artifact = snapshot.entities.artifacts[0]!
    delete artifact.version
    delete artifact.createdAt
    delete artifact.provenance
    artifact.sourceActivityId = 'source'
    expect(importSnapshot(snapshot).artifacts.legacy).toMatchObject({ version: 1, provenance: { type: 'agent', activityId: 'source' }, createdAt: '2026-07-15T10:00:01Z' })
  })
})
