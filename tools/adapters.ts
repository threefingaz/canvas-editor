// The adapters of the guide for each coding agent. The skills are plain
// Markdown in `guide/skills/<name>/SKILL.md`; an agent that loads a skill by
// its description scans a folder of its own. Into each such folder goes a
// stub of each skill: its `name`, its `description`, and one line that sends
// the agent to the skill in the guide. A stub has no content of its own, thus
// it does not drift. The instruction file of a host gets one marked block that
// sends the agent to the guide of the project.
// Pure functions; `canvas init`, `canvas sync` and `canvas agents` write the
// files (`init.ts`).

import { posix } from 'node:path'

// The folders that agents scan for skills, relative to the root.
export const skillFolders = ['.agents/skills', '.github/skills', '.claude/skills']

// The instruction files of a host root that get the block. `AGENTS.md` is
// made when it is not there; the other two only get the block when they exist.
export const instructionFiles = ['AGENTS.md', 'CLAUDE.md', '.github/copilot-instructions.md']

export const descriptionLimit = 1024

export type SkillHead = { name: string; description: string }

// A skill as its folder in the guide has it: the name of the folder and the
// text of `SKILL.md`.
export type SkillSource = { folder: string; text: string }

export type AdapterFile = { path: string; text: string }

// The `name` and the `description` of the head of a skill, as they are
// written. Throws when the head or one of the two is missing.
export function skillHead(text: string): SkillHead {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text.replaceAll('\r\n', '\n'))
  if (!match) throw new Error('The skill has no head between two lines of ---.')
  const fields = new Map<string, string>()
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':')
    if (colon > 0) fields.set(line.slice(0, colon).trim(), line.slice(colon + 1).trim())
  }
  const name = fields.get('name') ?? ''
  const description = fields.get('description') ?? ''
  if (!name) throw new Error('The head of the skill has no name.')
  if (!description) throw new Error(`The head of the skill ${name} has no description.`)
  return { name, description }
}

// The text of a stub. `skillPath` and `stubPath` are the paths of the two
// `SKILL.md` files relative to the root; the link is relative to the stub.
export function stubOf(head: SkillHead, skillPath: string, stubPath: string): string {
  const link = posix.relative(posix.dirname(stubPath), skillPath)
  return [
    '---',
    `name: ${head.name}`,
    `description: ${head.description}`,
    '---',
    '',
    `# ${head.name}`,
    '',
    `This is a stub. The skill is \`${skillPath}\`, relative to the root of this repository (the folder that holds the skill folder of this stub): [${skillPath}](${link}). Read that file now, and follow it.`,
    '',
  ].join('\n')
}

// True for the text of a stub that the tool wrote (`stubOf`, and the older
// form with no heading): the head, and one line that sends the agent to the
// skill. A skill of the user that quotes that line is not a stub.
export function isStub(text: string): boolean {
  return /^---\nname: [^\n]*\ndescription: [^\n]*\n---\n\n(?:# [^\n]*\n\n)?This is a stub\. The skill is [^\n]*\n?$/.test(text.replaceAll('\r\n', '\n'))
}

// The stub of each skill in each folder. `guidePath` is the folder of the
// guide relative to the root (`guide` in the tool, `canvas/guide` in a host).
// Throws when a skill has a name that is not the name of its folder, or a
// description over the limit: an agent would not load it.
export function adapterFiles(skills: SkillSource[], folders: string[], guidePath: string): AdapterFile[] {
  const heads = [...skills]
    .sort((a, b) => a.folder.localeCompare(b.folder))
    .map((skill) => {
      const head = skillHead(skill.text)
      if (head.name !== skill.folder) {
        throw new Error(`The skill in ${skill.folder} has the name ${head.name}; it must be the name of its folder.`)
      }
      if (head.description.length > descriptionLimit) {
        throw new Error(`The description of ${head.name} has ${head.description.length} characters; the limit is ${descriptionLimit}.`)
      }
      return head
    })
  const project = posix.dirname(guidePath)
  return folders.flatMap((folder) =>
    heads.map((head) => {
      const path = posix.join(folder, head.name, 'SKILL.md')
      const described = { ...head, description: rootedDescription(head.description, project) }
      return { path, text: stubOf(described, posix.join(guidePath, 'skills', head.name, 'SKILL.md'), path) }
    }),
  )
}

// A description with each path of the project in it (`guide/…`, `screens/…`
// in back quotes) relative to the root of the stubs: the description of a
// skill names the paths from the folder of the project, and the stubs of a
// host are at the host root. `project` is the folder of the project relative
// to that root (`.` in the tool, `canvas` in a host).
export function rootedDescription(description: string, project: string): string {
  if (project === '.' || project === '') return description
  return description.replace(/`(guide|screens)\//g, (_, folder: string) => `\`${project}/${folder}/`)
}

export const blockStart = '<!-- canvas-editor:start -->'
export const blockEnd = '<!-- canvas-editor:end -->'

// The marked block for an instruction file of the host. `projectPath` is the
// folder of the project relative to the host root (`canvas`).
export function hostBlock(projectPath: string): string {
  const folder = projectPath.replace(/\/+$/, '')
  return [
    blockStart,
    `This project has a canvas of screen prototypes in \`${folder}/\`. Before any work there, and when the user speaks of the canvas, screens, flows or canvas requests, read \`${folder}/AGENTS.md\` and follow it.`,
    blockEnd,
  ].join('\n')
}

// The text of an instruction file with the block: added at the end when the
// file has none, put in the place of an older block, and the block alone for
// a file that does not exist (null). A text that has the same block stays the
// same, thus a second run changes nothing.
export function withBlock(text: string | null, block: string): string {
  if (text === null || text.trim() === '') return `${block}\n`
  // A file with `\r\n` keeps it.
  const newline = text.includes('\r\n') ? '\r\n' : '\n'
  const lines = block.replaceAll('\n', newline)
  // The last block with its two lines. A start line with no end after it (the
  // user deleted the end line) is text of the user: a block is never put over
  // the text between such a line and a later block.
  const end = text.lastIndexOf(blockEnd)
  const start = end < 0 ? -1 : text.lastIndexOf(blockStart, end)
  if (start >= 0) return text.slice(0, start) + lines + text.slice(end + blockEnd.length)
  const body = text.endsWith('\n') ? text : `${text}${newline}`
  return `${body}${newline}${lines}${newline}`
}
