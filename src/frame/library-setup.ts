// The sentence that the user gives to an agent when no library is connected.
// The frame shows it in place of a screen (`no-library.tsx`), and the editor
// shows it on the canvas with a copy button. AGENTS.md and README.md write it
// out too. A test checks that the skill exists and that the two files have the
// sentence.

// The skill that connects a library: `.github/skills/<name>/SKILL.md`.
export const librarySetupSkill = 'canvas-library-setup'

export const connectSentence = `Connect a library as the skill ${librarySetupSkill} says.`
