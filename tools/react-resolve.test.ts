import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, test } from 'vitest'
import { frameMode, frameRoute, nodeResolver, reactAliases, reactModules, roleOf, toolAliases, type Resolver } from './react-resolve.ts'

describe('roleOf', () => {
  test('the build of the site and the frame server have the rule of the frames', () => {
    expect(roleOf('build', 'production')).toBe('frame')
    expect(roleOf('serve', frameMode)).toBe('frame')
  })

  test('the editor server, plain vite and the preview have the rule of the editor', () => {
    expect(roleOf('serve', 'development')).toBe('editor')
    expect(roleOf('serve', 'production')).toBe('editor')
  })
})

describe('reactAliases', () => {
  const project: Resolver = (id) => (id === 'react-dom/client' ? null : `/host/node_modules/${id}.js`)
  const tool: Resolver = (id) => `/tool/node_modules/${id}.js`

  test('gives each module of React to the file of the first resolver that finds react and react-dom', () => {
    const aliases = reactAliases([project, tool])
    expect(aliases.map((alias) => alias.replacement)).toEqual([
      '/host/node_modules/react.js',
      '/host/node_modules/react/jsx-runtime.js',
      '/host/node_modules/react/jsx-dev-runtime.js',
      '/host/node_modules/react-dom.js',
    ])
  })

  test('a project with react and no react-dom takes the two from the tool', () => {
    const library: Resolver = (id) => (id.startsWith('react-dom') ? null : `/host/node_modules/${id}.js`)
    expect(reactAliases([library, tool]).map((alias) => alias.replacement)).toEqual(
      reactModules.map((id) => `/tool/node_modules/${id}.js`),
    )
  })

  test('an alias takes the exact id only', () => {
    const [react] = reactAliases([tool])
    expect(react.find.test('react')).toBe(true)
    expect(react.find.test('react/jsx-runtime')).toBe(false)
    expect(react.find.test('react-is')).toBe(false)
    expect(react.find.test('preact')).toBe(false)
  })

  test('a module that no resolver finds has no alias', () => {
    expect(reactAliases([() => null])).toEqual([])
    expect(reactAliases([])).toEqual([])
  })
})

describe('nodeResolver', () => {
  let folder = ''
  afterEach(() => rmSync(folder, { recursive: true, force: true }))

  test('finds a module of the folder, and null for a missing one', () => {
    folder = realpathSync(mkdtempSync(join(tmpdir(), 'canvas-resolve-')))
    const react = join(folder, 'node_modules', 'react')
    mkdirSync(react, { recursive: true })
    writeFileSync(join(react, 'package.json'), JSON.stringify({ name: 'react', main: 'index.js' }))
    writeFileSync(join(react, 'index.js'), '')
    writeFileSync(join(react, 'jsx-runtime.js'), '')
    const resolve = nodeResolver(folder)
    expect(resolve('react')).toBe(`${folder.replaceAll('\\', '/')}/node_modules/react/index.js`)
    expect(resolve('react/jsx-runtime')).toBe(`${folder.replaceAll('\\', '/')}/node_modules/react/jsx-runtime.js`)
    expect(resolve('react-dom')).toBeNull()
  })

  test('the tool finds each module of React', () => {
    folder = ''
    const resolve = nodeResolver(fileURLToPath(new URL('..', import.meta.url)))
    for (const id of reactModules) expect(resolve(id), id).not.toBeNull()
  })
})

describe('toolAliases', () => {
  test('canvas-editor/tokens is the token module of the tool', () => {
    const [alias] = toolAliases('/tool')
    expect(alias.find.test('canvas-editor/tokens')).toBe(true)
    expect(alias.find.test('canvas-editor/tokens/x')).toBe(false)
    expect(alias.replacement).toBe('/tool/src/tokens/index.ts')
  })

  // The name is an alias in three places: the Vite config and the command
  // (`toolAliases`), `vitest.config.ts`, and `paths` of the type check of a
  // pack. Change them together.
  test('the module exists, and the type check and the tests have the same alias', () => {
    const tool = fileURLToPath(new URL('..', import.meta.url))
    expect(existsSync(join(tool, 'src/tokens/index.ts'))).toBe(true)
    expect(readFileSync(join(tool, 'tsconfig.app.json'), 'utf8')).toContain('"canvas-editor/tokens": ["./src/tokens/index.ts"]')
    expect(readFileSync(join(tool, 'vitest.config.ts'), 'utf8')).toContain('alias: toolAliases(root)')
  })
})

describe('frameRoute', () => {
  test('gives each address below the frame server to it', () => {
    expect(frameRoute('/__frame/frame.html?screen=a')).toEqual({ kind: 'frame' })
    expect(frameRoute('/__frame/@vite/client')).toEqual({ kind: 'frame' })
  })

  test('sends the old address of the site to the frame server', () => {
    expect(frameRoute('/site.html')).toEqual({ kind: 'site', location: '/__frame/site.html' })
    expect(frameRoute('/site.html?x=1')).toEqual({ kind: 'site', location: '/__frame/site.html?x=1' })
  })

  test('keeps each other address', () => {
    expect(frameRoute('/')).toBeNull()
    expect(frameRoute('/src/editor/main.tsx')).toBeNull()
    expect(frameRoute('/__framework')).toBeNull()
    expect(frameRoute('/site.htmlx')).toBeNull()
    expect(frameRoute('/__canvas/requests/a')).toBeNull()
  })
})
