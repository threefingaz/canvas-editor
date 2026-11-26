import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { config } from '../canvas.config.ts'
import { agentSentence, guidePath } from '../src/editor/requests/agent-sentence.ts'
import { partMarker } from './part.ts'

// The guide for the agent: the short `AGENTS.md`, the references in `guide/`
// and the skills in `guide/skills/`. An agent follows a relative link from one
// file to the next, thus each link must lead to a file. `AGENTS.md` is the
// entry that each agent reads: it stays short and names no one agent.

const root = fileURLToPath(new URL('../', import.meta.url))

function markdownFiles(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name)
    if (statSync(path).isDirectory()) return markdownFiles(path)
    return name.endsWith('.md') ? [path] : []
  })
}

function read(path: string): string {
  return readFileSync(path, 'utf8').replaceAll('\r\n', '\n')
}

// The targets of the Markdown links of a text that point to a file: no web
// address, no anchor in the same file. An anchor after a path is cut.
function relativeLinks(text: string): string[] {
  const links = [...text.matchAll(/\]\(([^)\s]+)\)/g)].map((match) => match[1])
  return links
    .filter((link) => !/^[a-z]+:/i.test(link) && !link.startsWith('#'))
    .map((link) => link.replace(/#.*$/, ''))
}

// The rows of the table under a `##` heading: each line that starts with `|`,
// with no header row and no separator row.
function tableRows(text: string, heading: string): string[] {
  const start = text.indexOf(`\n## ${heading}\n`)
  if (start < 0) return []
  const rest = text.slice(start + heading.length + 5)
  const end = rest.indexOf('\n## ')
  const lines = (end < 0 ? rest : rest.slice(0, end)).split('\n').filter((line) => line.startsWith('|'))
  return lines.slice(2)
}

const agents = join(root, 'AGENTS.md')
const stubFolders = ['.agents/skills', '.github/skills', '.claude/skills']
const files = [agents, ...markdownFiles(join(root, 'guide')), ...stubFolders.flatMap((folder) => markdownFiles(join(root, folder)))]

describe('relativeLinks', () => {
  test('gives the paths of the links and leaves out web addresses and anchors', () => {
    const text = '[a](./a.md) [b](../b/SKILL.md#step-3) [c](https://example.com) [d](#top) `[e](f)`'
    expect(relativeLinks(text)).toEqual(['./a.md', '../b/SKILL.md', 'f'])
  })
})

describe('tableRows', () => {
  test('gives the rows of the table under its heading', () => {
    const text = '# T\n\n## One\n\n| A | B |\n|---|---|\n| x | y |\n| z | w |\n\n## Two\n\n| C |\n|---|\n| v |\n'
    expect(tableRows(text, 'One')).toEqual(['| x | y |', '| z | w |'])
    expect(tableRows(text, 'Two')).toEqual(['| v |'])
    expect(tableRows(text, 'Three')).toEqual([])
  })
})

describe('the guide', () => {
  test.each(files.map((file) => relative(root, file)))('each relative link of %s leads to a file', (name) => {
    const file = join(root, name)
    for (const link of relativeLinks(read(file))) {
      expect(existsSync(join(dirname(file), link)), `${name}: ${link}`).toBe(true)
    }
  })

  test('each row of the table in AGENTS.md links a file that exists', () => {
    const rows = tableRows(read(agents), 'What to read')
    expect(rows.length).toBeGreaterThan(5)
    for (const row of rows) {
      const links = relativeLinks(row)
      expect(links.length, row).toBeGreaterThan(0)
      for (const link of links) expect(existsSync(join(root, link)), link).toBe(true)
    }
  })

  // A pack of an older version points to these names of the guide.
  test.each(['How to create a screen', 'Screen files', 'Requests'])('the table in AGENTS.md has a row named "%s"', (name) => {
    expect(tableRows(read(agents), 'What to read').some((row) => row.includes(`**${name}:**`))).toBe(true)
  })

  test('AGENTS.md has 90 lines or less', () => {
    expect(read(agents).trimEnd().split('\n').length).toBeLessThanOrEqual(90)
  })

  // The fixed sentence names only the guide; the guide names the folder of the
  // request files in the work folder of the config.
  test('the row of the requests in AGENTS.md has the fixed sentence', () => {
    const row = tableRows(read(agents), 'What to read').find((line) => line.includes('**Requests:**'))
    expect(row).toContain(agentSentence(guidePath))
  })

  test.each(['guide/requests.md', 'guide/skills/canvas-apply/SKILL.md'])('%s names the folder of the request files', (name) => {
    expect(read(join(root, name))).toContain(`${config.work}/requests/<screen id>.json`)
  })

  test('guide/requests.md has the fixed sentence', () => {
    expect(read(join(root, 'guide/requests.md'))).toContain(agentSentence(guidePath))
  })

  // The agent writes the marker of the block of an option as the parser
  // reads it (`part.ts`).
  test.each(['guide/requests.md', 'guide/screen-files.md', 'guide/skills/canvas-apply/SKILL.md'])(
    '%s writes the marker of the block of an option',
    (name) => {
      expect(read(join(root, name))).toContain(`{/* ${partMarker} */}`)
    },
  )

  test('AGENTS.md names no agent and no code editor', () => {
    expect(read(agents)).not.toMatch(/copilot|vs ?code|visual studio|claude|code chat/i)
  })

  // A row of the table of a skill names the sections of a reference file
  // after the colon of its link, by their headings, with ` · ` between them
  // (`all` for the whole file). An agent reads only what the row names.
  test.each(['canvas-screen-design', 'canvas-information-display'])('each section that the table of %s names is a heading of its file', (skill) => {
    const folder = join(root, 'guide/skills', skill)
    const text = read(join(folder, 'SKILL.md'))
    const missing: string[] = []
    for (const match of text.matchAll(/\]\((\.\/references\/[^)]+\.md)\):\s*(.+?)(?=<br>|\s\|)/g)) {
      const headings = new Set([...read(join(folder, match[1])).matchAll(/^## (.+)$/gm)].map((heading) => heading[1].trim()))
      for (const name of match[2].split(' · ').map((part) => part.trim())) {
        if (name !== 'all' && !headings.has(name)) missing.push(`${match[1]}: ${name}`)
      }
    }
    expect(missing).toEqual([])
  })
})
