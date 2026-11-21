// One run of a job at a time (`tokens-plugin.ts`): a request during a run
// starts one more run after it, and only one for any count of requests.
//
// `start` begins one run and calls its `finish` at the end. A run can call
// `finish` more than once (a process that cannot start can give both `error`
// and `close`): only the first call counts. `report` gets the result of each
// run, once.
export function createRunQueue<T>(start: (finish: (result: T) => void) => void, report: (result: T) => void): () => void {
  let running = false
  let again = false

  const run = () => {
    if (running) {
      again = true
      return
    }
    running = true
    again = false
    let finished = false
    start((result) => {
      if (finished) return
      finished = true
      running = false
      report(result)
      if (again) run()
    })
  }
  return run
}
