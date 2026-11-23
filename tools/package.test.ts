import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { htmlPackImports, packImports } from './core-clean.ts'

// The tool as a package: a host installs it as a development dependency, from
// a file of `npm pack` or from a Git address. npm then installs only the
// `dependencies` of the tool and only the files of `files`. Each module that
// the tool runs (the command, the plugins, the editor, the frame, the site)
// must thus be packed, and each package that it imports must be a regular
// dependency. The tests here read `package.json` and the code of the tool.

const root = fileURLToPath(new URL('../', import.meta.url))
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  name: string
  files: string[]
  exports: Record<string, string>
  bin: Record<string, string>
  scripts: Record<string, string>
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
}

// True when npm packs the file (a path relative to the tool, with `/`): an
// entry of `files` is the file itself or a folder above it; a negative entry
// `!**/*<end>` leaves out each file whose name ends with `<end>`. The test
// below allows no other form of an entry, thus this reading is complete.
function packed(path: string, files: readonly string[]): boolean {
  const left = files.filter((entry) => entry.startsWith('!')).map((entry) => entry.slice('!**/*'.length))
  if (left.some((end) => path.endsWith(end))) return false
  return files.some((entry) => !entry.startsWith('!') && (path === entry || path.startsWith(`${entry}/`)))
}

// The code files below a folder of the tool, with no test file.
function codeFiles(folder: string): string[] {
  return readdirSync(join(root, folder)).flatMap((name) => {
    const path = `${folder}/${name}`
    if (statSync(join(root, path)).isDirectory()) return codeFiles(path)
    return /\.(ts|tsx|js)$/.test(name) && !name.endsWith('.test.ts') ? [path] : []
  })
}

// The modules that the tool runs: the command, the scripts and the plugins,
// the editor, the frame and the site, and the config files that the command
// gives Vite.
const runtime = [...codeFiles('bin'), ...codeFiles('tools'), ...codeFiles('src'), 'vite.config.ts', 'canvas.config.ts']
const entries = ['index.html', 'frame.html', 'site.html']

// The relative module texts of a code file, each as a path from the tool root.
function relativeImports(file: string): string[] {
  const code = readFileSync(join(root, file), 'utf8')
  const texts = [...code.matchAll(/(?:from|import)\s*\(?\s*'(\.{1,2}\/[^']+)'/g)].map((match) => match[1])
  return texts.map((text) => relative(root, join(root, dirname(file), text)).replaceAll('\\', '/'))
}

describe('the package of the tool', () => {
  test('each entry of files is a path of the tool or leaves out an end of a name', () => {
    for (const entry of manifest.files) {
      if (entry.startsWith('!')) expect(entry).toMatch(/^!\*\*\/\*\.[\w.]+$/)
      else expect(existsSync(join(root, entry)), entry).toBe(true)
    }
  })

  test('packs the files that the tool reads at run time, and no test', () => {
    for (const path of [...runtime, ...entries, 'public/favicon.svg', 'AGENTS.md', 'guide/requests.md', 'src/editor/editor.css']) {
      expect(packed(path, manifest.files), path).toBe(true)
    }
    expect(packed('src/editor/ui/LICENSE.md', manifest.files)).toBe(true)
    expect(packed('tools/package.test.ts', manifest.files)).toBe(false)
    for (const path of ['screens/onboarding/welcome.tsx', 'packs/mui/pack.json', 'docs/development.md', 'vitest.config.ts']) {
      expect(packed(path, manifest.files), path).toBe(false)
    }
  })

  test('each relative import of a packed module is packed', () => {
    const missing = runtime.flatMap((file) =>
      relativeImports(file)
        .filter((path) => !packed(path, manifest.files))
        .map((path) => `${file} → ${path}`),
    )
    expect(missing).toEqual([])
  })

  test('the bin and the exports name packed files', () => {
    for (const path of [...Object.values(manifest.bin), ...Object.values(manifest.exports)]) {
      const file = path.replace(/^\.\//, '')
      expect(existsSync(join(root, file)), file).toBe(true)
      expect(file === 'package.json' || packed(file, manifest.files), file).toBe(true)
    }
    expect(manifest.exports['./tokens']).toBe('./src/tokens/index.ts')
  })

  test('each package that the tool runs is a regular dependency, not a development one', () => {
    const regular = [manifest.name, ...Object.keys(manifest.dependencies)]
    const found = runtime.flatMap((file) =>
      packImports(readFileSync(join(root, file), 'utf8'), file, regular).map((item) => `${file}:${item.line} ${item.source}`),
    )
    const html = entries.flatMap((file) =>
      htmlPackImports(readFileSync(join(root, file), 'utf8'), regular).map((item) => `${file}:${item.line} ${item.source}`),
    )
    expect([...found, ...html]).toEqual([])
    for (const name of ['vite', '@vitejs/plugin-react', '@tailwindcss/vite', 'tailwindcss', 'magic-string', 'typescript']) {
      expect(manifest.dependencies[name], name).toBeDefined()
      expect(manifest.devDependencies[name], name).toBeUndefined()
    }
  })

  // npm 11 asks for an approval of each install script, and a version of npm
  // that runs `prepare` for a Git dependency first does a full install of the
  // tool with its development packages (the spike of 2026-11-23).
  test('has no install script', () => {
    for (const name of ['preinstall', 'install', 'postinstall', 'prepare', 'prepack', 'postpack']) {
      expect(manifest.scripts[name], name).toBeUndefined()
    }
  })
})
