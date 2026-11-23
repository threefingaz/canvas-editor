// The two sentences that the user gives to an agent for the setup of a
// library (`levelOf` in `tools/pack.ts`):
//
// - `connectSentence`, when no library is connected. The frame shows it in
//   place of a screen (`no-library.tsx`), and the editor shows it on the
//   canvas with a copy button. AGENTS.md and README.md write it out too.
// - `tokensSentence`, at the level `connected`: the library is there and its
//   tokens are not set up. The editor shows it on the canvas with a copy
//   button; the screens render and the work goes on meanwhile. AGENTS.md
//   writes it out.
//
// A test checks that the skill exists and that the files have the sentences.

// The skill that connects a library: `guide/skills/<name>/SKILL.md`.
export const librarySetupSkill = 'canvas-library-setup'

export const connectSentence = `Connect a library as the skill ${librarySetupSkill} says.`

export const tokensSentence = `Set up the tokens of the library as the skill ${librarySetupSkill} says.`
