import assert from 'node:assert/strict'
import { createRuntime, selectLatestRunId, selectRunActivities } from '@agentic-chat/runtime'
import { chatBiSuccessfulRun } from '@agentic-chat/testkit'

let commandCalls = 0
const runtime = createRuntime({
  capabilities: {
    send: false,
    sequence: 'strict-per-run',
    replay: 'completed-history',
    cancel: true,
    resume: false,
    retry: false,
    intervention: false,
    artifacts: false,
  },
  commands: {
    async cancelRun(runId) {
      commandCalls += 1
      assert.equal(runId, 'run-1')
    },
  },
})

for (const event of chatBiSuccessfulRun) runtime.dispatch(event)
assert.equal(selectLatestRunId(runtime.getState()), 'run-1')
assert.equal(selectRunActivities(runtime.getState(), 'run-1').length, 1)
assert.equal(runtime.getState().runs['run-1']?.status, 'completed')

await runtime.executeCommand('cancel', () => runtime.commands.cancelRun('run-1'))
assert.equal(commandCalls, 1)
assert.equal(runtime.getSnapshot().commands.cancel.status, 'succeeded')

console.log('Node harness replay, selectors, and command mock passed.')
