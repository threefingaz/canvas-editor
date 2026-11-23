import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { connectSentence } from '../src/frame/library-setup.ts'
import {
  copyFiles,
  exportedFiles,
  exportReport,
  lockProblem,
  parseFileList,
  placeholders,
  targetProblem,
} from './export.ts'

describe('exportedFiles', () => {
  test('leaves out the pack, the screens, the lock file and the plans', () => {
    const tracked = [
      'AGENTS.md',
      'package.json',
      'package-lock.json',
      'packs/.gitkeep',
      'packs/demo/pack.json',
      'packs/demo/library/provider.tsx',
      'screens/.gitkeep',
      'screens/onboarding/welcome.tsx',
      'docs/plans/20261120-library-packs.md',
      'docs/plans/completed/20261116-canvas-read-only-path.md',
      'docs/canvas-tool-plan.md',
      'src/editor/main.tsx',
    ]
    expect(exportedFiles(tracked)).toEqual([
      'AGENTS.md',
      'docs/canvas-tool-plan.md',
      'package.json',
      'packs/.gitkeep',
      'screens/.gitkeep',
      'src/editor/main.tsx',
    ])
  })

  test('keeps the two tracked placeholder files of the left-out folders', () => {
    expect(placeholders).toEqual(['packs/.gitkeep', 'screens/.gitkeep'])
    expect(exportedFiles(['screens/.gitkeep', 'README.md', 'packs/.gitkeep'])).toEqual([
      'README.md',
      'packs/.gitkeep',
      'screens/.gitkeep',
    ])
    expect(exportedFiles([])).toEqual([])
  })

  test('a file with packs or screens in its name outside those folders stays', () => {
    const tracked = [
      'tools/pack.ts',
      'tools/packs.ts',
      'src/packs/a.ts',
      'packs.md',
      'my-packs/a.ts',
      'tools/screens.ts',
      'src/screens.d.ts',
      'docs/plans.md',
      'tools/package-lock.json',
    ]
    expect(exportedFiles(tracked)).toEqual([...tracked].sort())
  })
})

describe('parseFileList', () => {
  test('splits the list at each NUL character', () => {
    expect(parseFileList('a.ts\0docs/b c.md\0')).toEqual(['a.ts', 'docs/b c.md'])
    expect(parseFileList('')).toEqual([])
  })
})

describe('exportReport', () => {
  test('names the folder, the steps and the sentence for the agent', () => {
    const text = exportReport('/out/tool', 12, null, 0)
    expect(text).toContain('/out/tool: 12 files')
    expect(text).toContain('A new package-lock.json is written.')
    expect(text).toContain('npm install')
    expect(text).toContain('npm run dev')
    expect(text).toContain(connectSentence)
    expect(text).not.toContain('not committed')
  })

  test('names the command that connects a library before the dev server', () => {
    const text = exportReport('/out/tool', 12, null, 0)
    const init = text.indexOf('npm run init -- --library <package>@<range>')
    expect(init).toBeGreaterThan(text.indexOf('npm install'))
    expect(init).toBeLessThan(text.indexOf('npm run dev'))
    expect(text).toContain('npm run status')
  })

  test('names the three things to do next, in their sequence', () => {
    const text = exportReport('/out/tool', 12, null, 0)
    const connect = text.indexOf('1. Connect a library')
    const screen = text.indexOf('2. Create a screen')
    const site = text.indexOf('3. Build the site')
    expect(connect).toBeGreaterThan(-1)
    expect(screen).toBeGreaterThan(connect)
    expect(site).toBeGreaterThan(screen)
    expect(text.indexOf(connectSentence)).toBeGreaterThan(connect)
    expect(text.indexOf(connectSentence)).toBeLessThan(screen)
    expect(text).toContain('the skill canvas-screen, which AGENTS.md names')
    expect(text).toContain('npm run build writes it into dist/, and npm run preview serves it.')
  })

  test('says why no lock file is written', () => {
    expect(exportReport('/out/tool', 12, 'npm could not start (spawn npm ENOENT)', 0)).toContain(
      'No package-lock.json is written: npm could not start (spawn npm ENOENT). `npm install` in that folder writes it.',
    )
  })

  test('counts the exported files with changes that are not committed', () => {
    expect(exportReport('/out/tool', 12, null, 1)).toContain('1 exported file has changes that are not committed')
    expect(exportReport('/out/tool', 12, null, 3)).toContain('3 exported files have changes that are not committed')
  })
})

describe('lockProblem', () => {
  test('no problem for the exit code 0', () => {
    expect(lockProblem({ status: 0, signal: null })).toBeNull()
  })

  test('names the error of a run that could not start', () => {
    expect(lockProblem({ status: null, signal: null, error: new Error('spawn npm ENOENT') })).toBe(
      'npm could not start (spawn npm ENOENT)',
    )
  })

  test('names the exit code or the signal of a failed run', () => {
    expect(lockProblem({ status: 1, signal: null })).toContain('ended with the exit code 1')
    expect(lockProblem({ status: null, signal: 'SIGTERM' })).toContain('ended with the signal SIGTERM')
  })
})

describe('the copy', () => {
  let folder: string
  let source: string
  let target: string

  beforeEach(() => {
    folder = mkdtempSync(join(tmpdir(), 'canvas-export-'))
    source = join(folder, 'source')
    target = join(folder, 'target')
    const files: Record<string, string> = {
      'package.json': '{}',
      'packs/.gitkeep': '',
      'screens/.gitkeep': '',
      'src/editor/main.tsx': 'main',
      'packs/demo/pack.json': '{"name":"demo"}',
      'screens/a/b.tsx': 'screen',
    }
    for (const [file, text] of Object.entries(files)) {
      mkdirSync(dirname(join(source, file)), { recursive: true })
      writeFileSync(join(source, file), text)
    }
  })

  afterEach(() => {
    rmSync(folder, { recursive: true, force: true })
  })

  test('copies the exported files with their folders and the placeholders', () => {
    const files = exportedFiles([
      'package.json',
      'packs/.gitkeep',
      'packs/demo/pack.json',
      'screens/.gitkeep',
      'screens/a/b.tsx',
      'src/editor/main.tsx',
    ])
    expect(targetProblem(target, source)).toBeNull()
    copyFiles(source, target, files)
    expect(readFileSync(join(target, 'package.json'), 'utf8')).toBe('{}')
    expect(readFileSync(join(target, 'src/editor/main.tsx'), 'utf8')).toBe('main')
    expect(readFileSync(join(target, 'packs/.gitkeep'), 'utf8')).toBe('')
    expect(readFileSync(join(target, 'screens/.gitkeep'), 'utf8')).toBe('')
    expect(existsSync(join(target, 'packs/demo'))).toBe(false)
    expect(existsSync(join(target, 'screens/a'))).toBe(false)
  })

  test('an empty folder can take the export', () => {
    mkdirSync(target)
    expect(targetProblem(target, source)).toBeNull()
  })

  test('refuses a folder that is not empty', () => {
    mkdirSync(target)
    writeFileSync(join(target, 'old.txt'), 'old')
    expect(targetProblem(target, source)).toBe(`${target} is not empty: choose a new or an empty folder`)
  })

  test('refuses a file in the place of the folder', () => {
    writeFileSync(target, 'file')
    expect(targetProblem(target, source)).toBe(`${target} is not a folder`)
  })

  test('refuses the project folder and a folder in it', () => {
    const problem = `is in the project: choose a folder outside ${source}`
    expect(targetProblem(source, source)).toBe(`${source} ${problem}`)
    expect(targetProblem(join(source, 'out'), source)).toBe(`${join(source, 'out')} ${problem}`)
    expect(targetProblem(join(folder, 'source-2'), source)).toBeNull()
  })

  test('a file that is missing in the source stops the copy before it starts', () => {
    expect(() => copyFiles(source, target, ['package.json', 'missing.ts', 'gone/b.ts'])).toThrow(
      'tracked files are missing on the disk: missing.ts, gone/b.ts',
    )
    expect(existsSync(target)).toBe(false)
  })

  test.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'an error during the copy removes what it wrote, and the target can take the export again',
    () => {
      const locked = join(source, 'src/editor/main.tsx')
      chmodSync(locked, 0o000)
      try {
        expect(() => copyFiles(source, target, ['package.json', 'src/editor/main.tsx'])).toThrow()
        expect(existsSync(target)).toBe(false)
        mkdirSync(target)
        expect(() => copyFiles(source, target, ['package.json', 'src/editor/main.tsx'])).toThrow()
        expect(readdirSync(target)).toEqual([])
        expect(targetProblem(target, source)).toBeNull()
      } finally {
        chmodSync(locked, 0o644)
      }
    },
  )
})
