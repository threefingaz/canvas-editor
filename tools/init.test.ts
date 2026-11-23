import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, posix } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { formatTokens } from '../src/tokens/format.ts'
import { blockStart } from './adapters.ts'
import {
  applyInit,
  commandLinePrefix,
  developerLinePrefix,
  diskOf,
  filesBelow,
  fill,
  guideVersion,
  initPlan,
  initProject,
  inputOf,
  libraryCandidates,
  packNameOf,
  parseLibrary,
  planReport,
  projectGuide,
  runOf,
  stylesheetOf,
  syncPlan,
  agentsPlan,
  toolFolderRow,
  type InitInput,
} from './init.ts'
import { slashes, toolRoot } from './project.ts'

const folders: string[] = []

afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true })
})

function tempFolder(): string {
  const folder = slashes(mkdtempSync(join(tmpdir(), 'canvas-init-')))
  folders.push(folder)
  return folder
}

function write(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text)
}

function writeJson(path: string, data: unknown): void {
  write(path, `${JSON.stringify(data, null, 2)}\n`)
}

// A host with React, a library with React as a peer dependency and a
// stylesheet, and a package that is no library.
function makeHost(dependencies: Record<string, string> = { '@acme/ui': '^1.0.0', react: '^19.0.0', 'react-dom': '^19.0.0', 'left-pad': '^1.0.0' }): string {
  const host = tempFolder()
  writeJson(join(host, 'package.json'), { name: 'host', dependencies, devDependencies: { '@acme/test-kit': '^1.0.0' } })
  writeJson(join(host, 'node_modules/@acme/ui/package.json'), {
    name: '@acme/ui',
    peerDependencies: { react: '>=18' },
    exports: { '.': './index.js', './styles.css': './dist/styles.css' },
  })
  writeJson(join(host, 'node_modules/@acme/test-kit/package.json'), { name: '@acme/test-kit', peerDependencies: { react: '>=18' } })
  writeJson(join(host, 'node_modules/react-dom/package.json'), { name: 'react-dom', peerDependencies: { react: '^19.0.0' } })
  writeJson(join(host, 'node_modules/left-pad/package.json'), { name: 'left-pad' })
  return host
}

// The host mode reads the real tool (the guide, the templates) and writes
// only into the temporary host.
function hostInput(host: string, library: string | null = null, project = posix.join(host, 'canvas')): InitInput {
  return { disk: diskOf(), tool: toolRoot, host, project, library }
}

function read(path: string): string {
  return readFileSync(path, 'utf8')
}

// A small copy of the tool for the standalone mode: its project is the tool,
// thus a test never writes into the tool repository.
function makeTool(): string {
  const tool = tempFolder()
  for (const file of ['AGENTS.md', 'package.json', 'canvas.config.ts']) cpSync(join(toolRoot, file), join(tool, file))
  cpSync(join(toolRoot, 'tools/templates'), join(tool, 'tools/templates'), { recursive: true })
  cpSync(join(toolRoot, 'guide'), join(tool, 'guide'), { recursive: true })
  return tool
}

describe('the pure parts', () => {
  test('packNameOf: the scope, the name, or the folder, as a pack name', () => {
    expect(packNameOf('@mui/material')).toBe('mui')
    expect(packNameOf('@chakra-ui/react')).toBe('chakra-ui')
    expect(packNameOf('antd')).toBe('antd')
    expect(packNameOf('My_Lib.js')).toBe('my-lib-js')
    expect(packNameOf('./src/design-system/')).toBe('design-system')
    expect(packNameOf('@/x')).toBe('library')
  })

  test('parseLibrary: a package with or without a range, and a folder', () => {
    expect(parseLibrary('@mui/material@^9')).toEqual({ source: '@mui/material', range: '^9' })
    expect(parseLibrary('@mui/material')).toEqual({ source: '@mui/material', range: null })
    expect(parseLibrary('antd@5.1.0')).toEqual({ source: 'antd', range: '5.1.0' })
    expect(parseLibrary('antd@')).toEqual({ source: 'antd', range: null })
    expect(parseLibrary('./src/ui')).toEqual({ source: './src/ui', range: null })
  })

  test('libraryCandidates: the dependencies with React as a peer, not React itself and not the development ones', () => {
    const packages: Record<string, unknown> = {
      '@acme/ui': { peerDependencies: { react: '>=18' } },
      'react-dom': { peerDependencies: { react: '^19' } },
      router: { peerDependencies: { react: '>=17', 'react-dom': '>=17' } },
      'left-pad': {},
      '@acme/test-kit': { peerDependencies: { react: '>=18' } },
      '@acme/styled': { peerDependencies: { react: '>=18' } },
    }
    const host = { dependencies: { router: '1', '@acme/ui': '1', react: '19', 'react-dom': '19', 'left-pad': '1', missing: '1' }, devDependencies: { '@acme/test-kit': '1' } }
    expect(libraryCandidates(host, (name) => packages[name] ?? null)).toEqual(['@acme/ui', 'router'])
    // A peer dependency of a different candidate is a part of that library.
    packages['@acme/ui'] = { peerDependencies: { react: '>=18', '@acme/styled': '1' } }
    const withStyled = { dependencies: { '@acme/ui': '1', '@acme/styled': '1', react: '19' } }
    expect(libraryCandidates(withStyled, (name) => packages[name] ?? null)).toEqual(['@acme/ui'])
    expect(libraryCandidates(null, () => null)).toEqual([])
  })

  test('stylesheetOf: a path of exports that ends with .css, else the field style', () => {
    expect(stylesheetOf('@acme/ui', { exports: { '.': './i.js', './styles.css': './dist/s.css', './theme.css': './t.css' } })).toBe('@acme/ui/styles.css')
    expect(stylesheetOf('lib', { exports: { '.': './i.js' }, style: 'dist/lib.css' })).toBeNull()
    expect(stylesheetOf('lib', { exports: { '.': './i.js', './*': './*' }, style: './dist/lib.css' })).toBe('lib/dist/lib.css')
    expect(stylesheetOf('lib', { style: 'dist/lib.css' })).toBe('lib/dist/lib.css')
    expect(stylesheetOf('lib', { exports: { './*.css': './css/*.css' } })).toBeNull()
    expect(stylesheetOf('lib', { main: 'i.js' })).toBeNull()
    expect(stylesheetOf('lib', null)).toBeNull()
  })

  test('runOf: npx below node_modules, else the script of the clone from the project', () => {
    expect(runOf('/h/node_modules/canvas-editor', '/h/canvas', '/h')).toEqual({ command: 'npx canvas', where: '' })
    expect(runOf('/w/canvas-editor', '/w/app/canvas', '/w/app')).toEqual({ command: 'node ../../canvas-editor/bin/canvas.js', where: ', in the folder of this file' })
    // A project in a different folder than canvas/: the lookup finds it only
    // from its own folder.
    expect(runOf('/h/node_modules/canvas-editor', '/h/canvas-proto', '/h')).toEqual({ command: 'npx canvas', where: ', in the folder of this file' })
  })

  test('fill: each part, and a part with no value throws', () => {
    expect(fill('a {{x}} b {{y}}', { x: '1', y: '' })).toBe('a 1 b ')
    expect(() => fill('{{z}}', {})).toThrow('no value for z')
  })

  test('projectGuide: the version line, the command line, and no line about the code of the tool', () => {
    const agents = read(join(toolRoot, 'AGENTS.md'))
    expect(agents).toContain(toolFolderRow)
    const text = projectGuide(agents, '1.2.3', { command: 'npx canvas', where: '' }, 'canvas/AGENTS.md')
    // The fixed sentence names the guide as the editor gives it in the host.
    expect(text).toContain('`Apply the canvas requests as canvas/AGENTS.md says.`')
    expect(text).not.toContain('`Apply the canvas requests as AGENTS.md says.`')
    expect(guideVersion(text)).toBe('1.2.3')
    expect(guideVersion(agents)).toBeNull()
    expect(text).not.toContain(toolFolderRow)
    expect(text).not.toContain(developerLinePrefix)
    expect(text).not.toContain('docs/development.md')
    expect(text).not.toContain('npm run')
    const line = text.split('\n').find((item) => item.startsWith(commandLinePrefix))
    expect(line).toBe(`${commandLinePrefix} \`canvas <command>\` runs as \`npx canvas <command>\`: \`canvas check -- onboarding/welcome\` is \`npx canvas check -- onboarding/welcome\`.`)
    expect(text).not.toMatch(/\n\n\n/)
    expect(text.endsWith('\n')).toBe(true)
    // Each relative link of the copy leads to a file of the copy.
    for (const [, target] of text.matchAll(/\]\(([^)#]+)\)/g)) {
      if (/^[a-z]+:/.test(target)) continue
      expect(existsSync(join(toolRoot, target)), target).toBe(true)
      expect(target.startsWith('guide/'), target).toBe(true)
    }
    expect(() => projectGuide('# Other\n', '1', { command: 'x', where: '' }, 'AGENTS.md')).toThrow('has no title')
  })
})

describe('initPlan in a host', () => {
  test('the project, the pack of level 1, the copy of the guide, the stubs and the block; a second run changes nothing', () => {
    const host = makeHost(Object.fromEntries([['@acme/ui', '^1.0.0'], ['react', '^19.0.0'], ['react-dom', '^19.0.0'], ['left-pad', '1']]))
    const plan = initPlan(hostInput(host))
    expect(plan.refusals).toEqual([])
    applyInit(plan)
    const project = posix.join(host, 'canvas')
    expect(read(join(project, 'canvas.config.ts'))).toContain('widths: [1440, 1024, 390]')
    expect(read(join(project, 'canvas.config.ts'))).toContain("agent: 'auto'")
    const tsconfig = JSON.parse(read(join(project, 'tsconfig.json')))
    expect(posix.resolve(project, tsconfig.compilerOptions.paths['canvas-editor/tokens'][0])).toBe(posix.join(toolRoot, 'src/tokens/index.ts'))
    expect(read(join(project, '.gitignore'))).toContain('.canvas/')
    expect(JSON.parse(read(join(project, 'packs/acme/pack.json')))).toEqual({ name: 'acme', sources: ['@acme/ui'] })
    expect(existsSync(join(project, 'packs/acme/package.json'))).toBe(false)
    const provider = read(join(project, 'packs/acme/library/provider.tsx'))
    expect(provider).toContain("import '@acme/ui/styles.css'\n")
    expect(provider).toContain('export function LibraryProvider')
    expect(read(join(project, 'packs/acme/library/tokens.ts'))).toContain("from 'canvas-editor/tokens'")
    expect(read(join(project, 'tokens.json'))).toBe(formatTokens([]))
    // The copy of the guide.
    expect(guideVersion(read(join(project, 'AGENTS.md')))).toBe(JSON.parse(read(join(toolRoot, 'package.json'))).version)
    const guide = filesBelow(diskOf(), posix.join(toolRoot, 'guide'))
    expect(filesBelow(diskOf(), posix.join(project, 'guide'))).toEqual(guide)
    for (const file of guide) expect(read(join(project, 'guide', file))).toBe(read(join(toolRoot, 'guide', file)))
    // The stubs: only `.agents/skills/`, because the host has no `.github/` and no `.claude/`.
    const stub = read(join(host, '.agents/skills/canvas-apply/SKILL.md'))
    expect(stub).toContain('canvas/guide/skills/canvas-apply/SKILL.md')
    expect(stub).toContain('](../../../canvas/guide/skills/canvas-apply/SKILL.md)')
    expect(existsSync(join(host, '.github'))).toBe(false)
    expect(existsSync(join(host, '.claude'))).toBe(false)
    // The block: `AGENTS.md` is made, `CLAUDE.md` is not.
    expect(read(join(host, 'AGENTS.md'))).toContain('read `canvas/AGENTS.md` and follow it')
    expect(existsSync(join(host, 'CLAUDE.md'))).toBe(false)
    expect(plan.notes.join('\n')).toContain('the one dependency of the host with React as a peer dependency')
    expect(plan.next.join('\n')).toMatch(/canvas(\.js)? dev/)

    const again = initPlan(hostInput(host))
    expect(again).toMatchObject({ writes: [], removes: [], refusals: [] })
  })

  test('the instruction files and the skill folders that the host has get the block and the stubs', () => {
    const host = makeHost({ '@acme/ui': '1' })
    write(join(host, 'AGENTS.md'), '# Host\n\nThe rules of the host.\n')
    write(join(host, 'CLAUDE.md'), '@AGENTS.md\n')
    mkdirSync(join(host, '.github'))
    applyInit(initPlan(hostInput(host)))
    const agents = read(join(host, 'AGENTS.md'))
    expect(agents.startsWith('# Host\n\nThe rules of the host.\n\n')).toBe(true)
    expect(agents).toContain(blockStart)
    expect(read(join(host, 'CLAUDE.md'))).toContain(blockStart)
    expect(existsSync(join(host, '.github/copilot-instructions.md'))).toBe(false)
    expect(existsSync(join(host, '.github/skills/canvas-screen/SKILL.md'))).toBe(true)
    expect(existsSync(join(host, '.claude/skills'))).toBe(false)
  })

  test('a folder that is not empty and is no project is a refusal, and so is the host root', () => {
    const host = makeHost()
    write(join(host, 'canvas/notes.txt'), 'mine')
    const plan = initPlan(hostInput(host, '@acme/ui'))
    expect(plan.refusals[0]).toContain('is not empty and is no canvas project')
    expect(plan.writes).toEqual([])
    expect(initPlan(hostInput(host, '@acme/ui', host)).refusals[0]).toContain('is the root of the host')
  })

  test('more than one candidate: a refusal with the commands; --library chooses', () => {
    const host = makeHost()
    writeJson(join(host, 'node_modules/left-pad/package.json'), { name: 'left-pad', peerDependencies: { react: '*' } })
    const plan = initPlan(hostInput(host))
    expect(plan.refusals[0]).toContain('canvas init --library @acme/ui')
    expect(plan.refusals[0]).toContain('canvas init --library left-pad')
    expect(plan.writes).toEqual([])
    const chosen = initPlan(hostInput(host, '@acme/ui@^2'))
    expect(chosen.refusals).toEqual([])
    expect(chosen.notes[0]).toContain('The range ^2 is left out')
  })

  test('no candidate, and a library that the host does not have, are refusals', () => {
    const host = makeHost({ react: '19', 'left-pad': '1' })
    expect(initPlan(hostInput(host)).refusals[0]).toContain('is installed with React as a peer dependency')
    expect(initPlan(hostInput(host, '@other/ui')).refusals[0]).toContain('npm install @other/ui')
  })

  test('a package of a repository with workspaces: installed in the root, and named with --library', () => {
    // The root lists no library; the package `apps/web` does, and npm put it
    // into the root node_modules.
    const repo = makeHost({ react: '19' })
    const web = posix.join(repo, 'apps/web')
    writeJson(join(web, 'package.json'), { name: 'web', dependencies: { '@acme/ui': '^1.0.0' } })
    // From the package: the candidate is found in node_modules of the root.
    const fromWeb = initPlan(hostInput(web, null, posix.join(web, 'canvas')))
    expect(fromWeb.refusals).toEqual([])
    expect(fromWeb.notes[0]).toContain('@acme/ui')
    // From the root: --library takes a package that the root does not list.
    const fromRoot = initPlan(hostInput(repo, '@acme/ui'))
    expect(fromRoot.refusals).toEqual([])
    expect(fromRoot.writes.some((write) => write.path.endsWith('provider.tsx') && write.text.includes("import '@acme/ui/styles.css'"))).toBe(true)
  })

  test('a folder of the host as the library', () => {
    const host = makeHost()
    write(join(host, 'src/ui/button.tsx'), 'export {}\n')
    const plan = initPlan(hostInput(host, './src/ui'))
    expect(plan.refusals).toEqual([])
    applyInit(plan)
    expect(JSON.parse(read(join(host, 'canvas/packs/ui/pack.json')))).toEqual({ name: 'ui', sources: ['./src/ui'] })
    expect(read(join(host, 'canvas/packs/ui/library/provider.tsx'))).not.toContain("import '")
    expect(initPlan(hostInput(makeHost(), './src/missing')).refusals[0]).toContain('does not exist')
  })

  test('a pack that is there stays; another library is a note; two packs are a refusal', () => {
    const host = makeHost()
    applyInit(initPlan(hostInput(host, '@acme/ui')))
    const plan = initPlan(hostInput(host, 'left-pad'))
    expect(plan.writes).toEqual([])
    expect(plan.notes.join('\n')).toContain('--library left-pad is left out')
    writeJson(join(host, 'canvas/packs/two/pack.json'), { name: 'two', sources: ['x'] })
    expect(initPlan(hostInput(host)).refusals[0]).toContain('more than one library pack')
  })
})

describe('syncPlan and agentsPlan', () => {
  test('sync writes the guide, the stubs and the block again, and removes what the guide no longer has', () => {
    const host = makeHost()
    applyInit(initPlan(hostInput(host, '@acme/ui')))
    write(join(host, 'canvas/guide/requests.md'), 'changed by hand\n')
    write(join(host, 'canvas/guide/old.md'), 'an older file\n')
    write(join(host, '.agents/skills/canvas-old/SKILL.md'), '---\nname: canvas-old\ndescription: x\n---\n\nThis is a stub. The skill is `canvas/guide/skills/canvas-old/SKILL.md`.\n')
    write(join(host, '.agents/skills/canvas-team/SKILL.md'), '---\nname: canvas-team\ndescription: a skill of the team\n---\n')
    write(join(host, 'AGENTS.md'), '# Host\n')
    const plan = syncPlan(hostInput(host))
    expect(plan.refusals).toEqual([])
    expect(plan.writes.map((item) => posix.relative(host, item.path)).sort()).toEqual(['AGENTS.md', 'canvas/guide/requests.md'])
    expect(plan.removes.map((path) => posix.relative(host, path)).sort()).toEqual(['.agents/skills/canvas-old', 'canvas/guide/old.md'])
    applyInit(plan)
    expect(read(join(host, 'canvas/guide/requests.md'))).toBe(read(join(toolRoot, 'guide/requests.md')))
    expect(existsSync(join(host, '.agents/skills/canvas-team/SKILL.md'))).toBe(true)
    expect(syncPlan(hostInput(host))).toMatchObject({ writes: [], removes: [] })
  })

  test('sync of a folder with no project is a refusal; agents writes only the stubs', () => {
    const host = makeHost()
    expect(syncPlan(hostInput(host)).refusals[0]).toContain('Run canvas init first')
    const plan = agentsPlan(hostInput(host))
    expect(plan.writes.length).toBeGreaterThan(0)
    expect(plan.writes.every((item) => item.path.startsWith(`${host}/.agents/skills/`))).toBe(true)
  })
})

describe('initPlan standalone', () => {
  test('the pack with its package.json and the install to run; nothing else of the tool changes', () => {
    const tool = makeTool()
    const input = (library: string | null): InitInput => ({ disk: diskOf(), tool, host: tool, project: tool, library })
    expect(initPlan(input(null)).refusals[0]).toContain('canvas init --library <package>@<range>')
    const plan = initPlan(input('@acme/ui@^2.1.0'))
    expect(plan.refusals).toEqual([])
    expect(plan.writes.map((item) => posix.relative(tool, item.path)).sort()).toEqual([
      'packs/acme/library/provider.tsx',
      'packs/acme/library/tokens.ts',
      'packs/acme/pack.json',
      'packs/acme/package.json',
      'tokens.json',
    ])
    applyInit(plan)
    expect(JSON.parse(read(join(tool, 'packs/acme/package.json')))).toMatchObject({ private: true, type: 'module', dependencies: { '@acme/ui': '^2.1.0' } })
    expect(plan.next[0]).toContain('npm install')
    expect(initPlan(input('@acme/ui'))).toMatchObject({ writes: [], removes: [] })
    // A package with no range gets the latest version.
    const other = makeTool()
    applyInit(initPlan({ disk: diskOf(), tool: other, host: other, project: other, library: 'antd' }))
    expect(JSON.parse(read(join(other, 'packs/antd/package.json'))).dependencies).toEqual({ antd: 'latest' })
  })
})

describe('planReport', () => {
  test('each file, the files of a group as one line, the removes, the notes and the next steps; a refusal alone', () => {
    const plan = {
      writes: [
        { path: '/h/canvas/a.ts', text: '' },
        { path: '/h/canvas/guide/x.md', text: '' },
        { path: '/h/canvas/guide/y/z.md', text: '' },
        { path: '/h/.agents/skills/s/SKILL.md', text: '' },
      ],
      removes: ['/h/canvas/guide/old.md'],
      notes: ['a note'],
      refusals: [],
      next: ['npx canvas dev'],
    }
    expect(planReport(plan, '/h', 'done', ['/h/canvas/guide', '/h/.agents/skills'])).toBe(
      ['wrote canvas/a.ts', 'wrote canvas/guide/ (2 files)', 'wrote .agents/skills/ (1 file)', 'removed canvas/guide/old.md', 'a note', '', 'Next:', '  npx canvas dev'].join('\n'),
    )
    expect(planReport({ ...plan, writes: [], removes: [], next: [] }, '/h', 'done')).toBe('done\na note')
    expect(planReport({ ...plan, refusals: ['no'] }, '/h', 'done')).toBe('no')
  })
})

describe('a repository with workspaces, from a package', () => {
  // The repository root has .git and a package.json with no library; the
  // package apps/web lists it.
  function makeRepo(): { repo: string; web: string } {
    const repo = makeHost({ react: '19' })
    mkdirSync(join(repo, '.git'))
    const web = posix.join(repo, 'apps/web')
    writeJson(join(web, 'package.json'), { name: 'web', dependencies: { '@acme/ui': '^1.0.0' } })
    return { repo, web }
  }

  test('the project, the host and the library agree, with the library in the root node_modules', () => {
    const { repo, web } = makeRepo()
    const project = initProject(null, {}, web, toolRoot, existsSync)
    expect(project).toBe(posix.join(repo, 'canvas'))
    const input = inputOf(toolRoot, project, null, web)
    expect(input.host).toBe(repo)
    expect(input.workspace).toBe(web)
    expect(runOf(posix.join(repo, 'node_modules/canvas-editor'), project, input.host).where).toBe('')
    const plan = initPlan(input)
    expect(plan.refusals).toEqual([])
    expect(plan.notes[0]).toContain('@acme/ui')
    expect(plan.writes.some((write) => write.path.startsWith(posix.join(repo, 'canvas/packs/')) && write.path.endsWith('/pack.json'))).toBe(true)
    expect(plan.writes.some((write) => write.path === posix.join(repo, '.agents/skills/canvas-apply/SKILL.md'))).toBe(true)
    expect(plan.writes.some((write) => write.path === posix.join(repo, 'AGENTS.md'))).toBe(true)
    expect(plan.writes.some((write) => write.path.startsWith(`${web}/`))).toBe(false)
  })

  test('a library installed only in the package: a refusal that names --project; a project in the package finds it', () => {
    const { repo, web } = makeRepo()
    rmSync(join(repo, 'node_modules/@acme/ui'), { recursive: true })
    writeJson(join(web, 'node_modules/@acme/ui/package.json'), { name: '@acme/ui', peerDependencies: { react: '>=18' } })
    const project = initProject(null, {}, web, toolRoot, existsSync)
    const refused = initPlan(inputOf(toolRoot, project, null, web))
    expect(refused.refusals[0]).toContain('--project <package>/canvas')
    const inPackage = initProject('canvas', {}, web, toolRoot, existsSync)
    const input = inputOf(toolRoot, inPackage, null, web)
    expect(input.host).toBe(repo)
    expect(initPlan(input).refusals).toEqual([])
  })
})

describe('initProject', () => {
  test('the option, the variable, the tool in its own repository, else canvas/ of the host', () => {
    const exists = (marks: string[]) => (path: string) => marks.includes(path)
    expect(initProject('app/canvas', {}, '/w', '/t', exists([]))).toBe('/w/app/canvas')
    expect(initProject(null, { CANVAS_PROJECT: '../p' }, '/w/a', '/t', exists([]))).toBe('/w/p')
    expect(initProject(null, {}, '/t/src', '/t', exists(['/t/package.json']))).toBe('/t')
    expect(initProject(null, {}, '/h/src/app', '/t', exists(['/h/package.json']))).toBe('/h/canvas')
    expect(initProject(null, {}, '/e', '/t', exists([]))).toBe('/e/canvas')
    // A package of a repository with workspaces: canvas/ of the repository.
    expect(initProject(null, {}, '/r/apps/web', '/t', exists(['/r/.git', '/r/package.json', '/r/apps/web/package.json']))).toBe('/r/canvas')
    // A repository of its own inside a different one keeps its project.
    expect(initProject(null, {}, '/r/sub', '/t', exists(['/r/.git', '/r/package.json', '/r/sub/.git', '/r/sub/package.json']))).toBe('/r/sub/canvas')
  })
})
