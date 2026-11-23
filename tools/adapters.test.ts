import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { adapterFiles, blockEnd, blockStart, hostBlock, rootedDescription, skillFolders, skillHead, stubOf, withBlock } from './adapters.ts'
import { agentsPlan, diskOf } from './init.ts'
import { slashes } from './project.ts'

const skill = (name: string, description = `Read ${name} when it fits.`) => `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n\nThe body.\n`

describe('skillHead', () => {
  test('gives the name and the description as they are written', () => {
    expect(skillHead(skill('canvas-x', 'Read it: when "a" says so.'))).toEqual({ name: 'canvas-x', description: 'Read it: when "a" says so.' })
  })

  test('reads a file with \\r\\n', () => {
    expect(skillHead(skill('canvas-x').replaceAll('\n', '\r\n')).name).toBe('canvas-x')
  })

  test('throws for a file with no head, no name or no description', () => {
    expect(() => skillHead('# No head\n')).toThrow(/no head/)
    expect(() => skillHead('---\ndescription: d\n---\n')).toThrow(/no name/)
    expect(() => skillHead('---\nname: canvas-x\n---\n')).toThrow(/no description/)
  })
})

describe('stubOf', () => {
  test('copies the head and links the skill relative to the stub', () => {
    const text = stubOf({ name: 'canvas-x', description: 'D.' }, 'guide/skills/canvas-x/SKILL.md', '.agents/skills/canvas-x/SKILL.md')
    expect(text).toMatch(/^---\nname: canvas-x\ndescription: D\.\n---\n/)
    expect(text).toContain('[guide/skills/canvas-x/SKILL.md](../../../guide/skills/canvas-x/SKILL.md)')
    expect(text).toContain('Read that file now, and follow it.')
  })

  test('links a guide in a sub folder of the host', () => {
    const text = stubOf({ name: 'canvas-x', description: 'D.' }, 'canvas/guide/skills/canvas-x/SKILL.md', '.github/skills/canvas-x/SKILL.md')
    expect(text).toContain('](../../../canvas/guide/skills/canvas-x/SKILL.md)')
  })
})

describe('adapterFiles', () => {
  const skills = [
    { folder: 'canvas-b', text: skill('canvas-b') },
    { folder: 'canvas-a', text: skill('canvas-a') },
  ]

  test('gives the stub of each skill in each folder, by folder and then by name', () => {
    const files = adapterFiles(skills, ['.agents/skills', '.claude/skills'], 'guide')
    expect(files.map((file) => file.path)).toEqual([
      '.agents/skills/canvas-a/SKILL.md',
      '.agents/skills/canvas-b/SKILL.md',
      '.claude/skills/canvas-a/SKILL.md',
      '.claude/skills/canvas-b/SKILL.md',
    ])
    expect(skillHead(files[0].text)).toEqual(skillHead(skill('canvas-a')))
    expect(files[0].text).toContain('](../../../guide/skills/canvas-a/SKILL.md)')
  })

  test('refuses a skill whose name is not the name of its folder', () => {
    expect(() => adapterFiles([{ folder: 'canvas-a', text: skill('canvas-z') }], ['.agents/skills'], 'guide')).toThrow(/name of its folder/)
  })

  test('takes a description of 1024 characters and refuses a longer one', () => {
    const at = { folder: 'canvas-a', text: skill('canvas-a', 'x'.repeat(1024)) }
    expect(adapterFiles([at], ['.agents/skills'], 'guide')).toHaveLength(1)
    const over = { folder: 'canvas-a', text: skill('canvas-a', 'x'.repeat(1025)) }
    expect(() => adapterFiles([over], ['.agents/skills'], 'guide')).toThrow(/1025 characters/)
  })
})

describe('rootedDescription', () => {
  test('the paths of the project get the folder of the project in a host, and stay in the tool', () => {
    const text = 'The guide `guide/requests.md`, the screens in `screens/`, and AGENTS.md.'
    expect(rootedDescription(text, 'canvas')).toBe('The guide `canvas/guide/requests.md`, the screens in `canvas/screens/`, and AGENTS.md.')
    expect(rootedDescription(text, '.')).toBe(text)
  })

  test('a stub in a host names the path from the host root', () => {
    const skills = [{ folder: 'canvas-a', text: skill('canvas-a', 'Read `guide/requests.md`.') }]
    expect(adapterFiles(skills, ['.agents/skills'], 'canvas/guide')[0].text).toContain('description: Read `canvas/guide/requests.md`.')
  })
})

describe('hostBlock and withBlock', () => {
  const block = hostBlock('canvas')

  test('the block names the guide of the project between its two marker lines', () => {
    const lines = block.split('\n')
    expect(lines[0]).toBe(blockStart)
    expect(lines.at(-1)).toBe(blockEnd)
    expect(block).toContain('read `canvas/AGENTS.md` and follow it.')
    expect(hostBlock('canvas/')).toBe(block)
  })

  test('a file that does not exist gets the block alone', () => {
    expect(withBlock(null, block)).toBe(`${block}\n`)
    expect(withBlock('', block)).toBe(`${block}\n`)
  })

  test('a file with no block gets it at the end, after a blank line', () => {
    expect(withBlock('# Host\n\nRules.\n', block)).toBe(`# Host\n\nRules.\n\n${block}\n`)
    expect(withBlock('# Host', block)).toBe(`# Host\n\n${block}\n`)
  })

  test('a file with the block stays the same', () => {
    const once = withBlock('# Host\n', block)
    expect(withBlock(once, block)).toBe(once)
  })

  test('an older block is replaced in its place', () => {
    const older = `# Host\n\n${blockStart}\nRead old/AGENTS.md.\n${blockEnd}\n\n## More\n`
    expect(withBlock(older, block)).toBe(`# Host\n\n${block}\n\n## More\n`)
  })

  test('a start line with no end line is text of the user', () => {
    const lost = `# Host\n\n${blockStart}\nMy rules.\n`
    const once = withBlock(lost, block)
    expect(once).toBe(`${lost}\n${block}\n`)
    expect(withBlock(once, block)).toBe(once)
    expect(withBlock(once, hostBlock('app/canvas'))).toBe(`${lost}\n${hostBlock('app/canvas')}\n`)
  })

  test('a file with \\r\\n keeps it', () => {
    expect(withBlock('# Host\r\n', block)).toBe(`# Host\r\n\r\n${block.replaceAll('\n', '\r\n')}\r\n`)
  })
})

// The tracked stubs are what `npm run agents` writes: run it after a change of
// the head of a skill.
describe('the stubs of this repository', () => {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const guideSkills = join(root, 'guide/skills')
  const skills = readdirSync(guideSkills)
    .filter((folder) => existsSync(join(guideSkills, folder, 'SKILL.md')))
    .map((folder) => ({ folder, text: readFileSync(join(guideSkills, folder, 'SKILL.md'), 'utf8') }))
  const files = adapterFiles(skills, skillFolders, 'guide')

  test.each(files.map((file) => [file.path, file.text]))('%s is equal to what npm run agents writes', (path, text) => {
    expect(readFileSync(join(root, path), 'utf8').replaceAll('\r\n', '\n')).toBe(text)
  })

  test('npm run agents (canvas agents) would write and remove nothing', () => {
    const tool = slashes(root)
    const plan = agentsPlan({ disk: diskOf(), tool, host: tool, project: tool, library: null })
    expect(plan.writes.map((write) => write.path)).toEqual([])
    expect(plan.removes).toEqual([])
  })

  test.each(skillFolders)('%s has no other stub', (folder) => {
    const present = readdirSync(join(root, folder)).filter((name) => name.startsWith('canvas-')).sort()
    expect(present).toEqual(skills.map((skill) => skill.folder).sort())
  })
})
