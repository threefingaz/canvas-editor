import { describe, expect, test } from 'vitest'
import { createRunQueue } from './run-queue.ts'

// A job whose runs end when the test calls their `finish`.
function setup() {
  const runs: ((result: string) => void)[] = []
  const reports: string[] = []
  const run = createRunQueue<string>(
    (finish) => runs.push(finish),
    (result) => reports.push(result),
  )
  return { run, runs, reports }
}

describe('createRunQueue', () => {
  test('one run at a time', () => {
    const { run, runs } = setup()
    run()
    run()
    expect(runs).toHaveLength(1)
  })

  test('requests during a run give exactly one more run after it', () => {
    const { run, runs, reports } = setup()
    run()
    run()
    run()
    runs[0]('first')
    expect(runs).toHaveLength(2)
    runs[1]('second')
    expect(runs).toHaveLength(2)
    expect(reports).toEqual(['first', 'second'])
  })

  test('a run that finishes two times is reported and followed once', () => {
    const { run, runs, reports } = setup()
    run()
    run()
    runs[0]('error')
    runs[0]('close')
    expect(reports).toEqual(['error'])
    expect(runs).toHaveLength(2)
  })

  test('a request after the end of a run starts a new run', () => {
    const { run, runs } = setup()
    run()
    runs[0]('done')
    run()
    expect(runs).toHaveLength(2)
  })
})
