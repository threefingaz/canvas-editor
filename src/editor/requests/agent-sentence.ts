// The one sentence that the user gives to an agent. It names the guide of the
// project, the `AGENTS.md` that the agent reads first; the agent finds the
// rest there: the folder of the request files, the skill `canvas-apply` and
// the full guide `guide/requests.md`. The path of the guide is relative to the
// folder where the agent works (`AGENTS.md` when the project is that folder,
// `canvas/AGENTS.md` in a host). The skill `canvas-apply` has the form in its
// description (a test checks it).
export function agentSentence(guide: string): string {
  return `Apply the canvas requests as ${guide} says.`
}

// The path of the guide when the project is the folder where the agent works,
// as in the tool repository. The dev server gives the editor the path of each
// project (`guidePathOf` in `tools/project.ts`, `project.guide` of
// `virtual:canvas-screens`).
export const guidePath = 'AGENTS.md'

// The sentence of an older version of the tool, which named the folder of the
// requests. A user can still type it, thus the skill `canvas-apply` takes it
// too (a test checks it).
export const olderAgentSentence = 'Apply the canvas requests in .canvas/requests/ as AGENTS.md says.'
