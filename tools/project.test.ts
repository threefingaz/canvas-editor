import { describe, expect, test } from 'vitest'
import {
  cacheMatcher,
  guidePathOf,
  hostProblem,
  hostRoot,
  isInside,
  isInstalled,
  noProjectProblem,
  folderProblem,
  projectRoot,
  projectVariable,
  slashes,
  toolRoot,
} from './project.ts'

// A file system of the paths in the list.
function files(...paths: string[]): (path: string) => boolean {
  const set = new Set(paths)
  return (path) => set.has(path)
}

describe('projectRoot', () => {
  const tool = '/tools/canvas-editor'

  test('the option first, relative to the current folder', () => {
    const env = { [projectVariable]: '/other' }
    expect(projectRoot('canvas', env, '/work/app', tool, files())).toBe('/work/app/canvas')
    expect(projectRoot('/abs/project/', env, '/work/app', tool, files())).toBe('/abs/project')
    expect(projectRoot('../app/canvas', {}, '/work/editor', tool, files())).toBe('/work/app/canvas')
  })

  test('then the variable, relative to the current folder', () => {
    expect(projectRoot(null, { [projectVariable]: '/work/app/canvas' }, '/x', tool, files())).toBe('/work/app/canvas')
    expect(projectRoot(null, { [projectVariable]: 'canvas' }, '/work/app', tool, files())).toBe('/work/app/canvas')
    // An empty variable counts as none.
    expect(projectRoot(null, { [projectVariable]: '' }, '/x', tool, files())).toBe(tool)
  })

  test('then the nearest folder upward with a config, or with canvas/ that has one', () => {
    const exists = files('/work/app/canvas/canvas.config.ts', '/work/other/canvas.config.ts')
    expect(projectRoot(null, {}, '/work/app', tool, exists)).toBe('/work/app/canvas')
    expect(projectRoot(null, {}, '/work/app/src/deep', tool, exists)).toBe('/work/app/canvas')
    expect(projectRoot(null, {}, '/work/app/canvas/screens', tool, exists)).toBe('/work/app/canvas')
    expect(projectRoot(null, {}, '/work/other/screens', tool, exists)).toBe('/work/other')
  })

  test('a folder with its own config wins over its canvas/ folder', () => {
    const exists = files('/work/app/canvas.config.ts', '/work/app/canvas/canvas.config.ts')
    expect(projectRoot(null, {}, '/work/app', tool, exists)).toBe('/work/app')
  })

  test('the tool when no folder upward has a config', () => {
    expect(projectRoot(null, {}, '/work/app', tool, files())).toBe(tool)
    expect(projectRoot(null, {}, '/work/app', `${tool}/`, files())).toBe(tool)
  })

  test('the tool repository finds itself', () => {
    expect(projectRoot(null, {}, toolRoot, toolRoot, files(`${toolRoot}/canvas.config.ts`))).toBe(toolRoot)
  })
})

describe('hostRoot', () => {
  test('a project with its own .git or package.json is its own host', () => {
    expect(hostRoot('/work/editor', files('/work/editor/.git'))).toBe('/work/editor')
    expect(hostRoot('/work/editor', files('/work/editor/package.json', '/work/package.json'))).toBe('/work/editor')
  })

  test('else the nearest folder above with .git or a package.json', () => {
    expect(hostRoot('/work/app/canvas', files('/work/app/package.json', '/work/.git'))).toBe('/work/app')
    expect(hostRoot('/work/app/design/canvas', files('/work/app/.git'))).toBe('/work/app')
  })

  test('the project when no folder has one', () => {
    expect(hostRoot('/work/app/canvas', files())).toBe('/work/app/canvas')
  })

  test('the root of a repository with packages, also from a package below it', () => {
    const repo = files('/work/repo/.git', '/work/repo/package.json', '/work/repo/apps/web/package.json')
    expect(hostRoot('/work/repo/apps/web/canvas', repo)).toBe('/work/repo')
    expect(hostRoot('/work/repo/canvas', repo)).toBe('/work/repo')
  })

  test('a home folder that is a repository with no package.json is no host above a package', () => {
    expect(hostRoot('/home/me/app/canvas', files('/home/me/.git', '/home/me/app/package.json'))).toBe('/home/me/app')
  })
})

describe('guidePathOf', () => {
  test('relative to the host', () => {
    expect(guidePathOf('/work/editor', '/work/editor')).toBe('AGENTS.md')
    expect(guidePathOf('/work/app/canvas', '/work/app')).toBe('canvas/AGENTS.md')
    expect(guidePathOf('/work/app/design/canvas', '/work/app')).toBe('design/canvas/AGENTS.md')
  })
})

describe('cacheMatcher', () => {
  const ignored = cacheMatcher('/work/app/canvas', '.canvas')

  test('takes the caches of the dependency step in the work folder', () => {
    expect(ignored('/work/app/canvas/.canvas/vite')).toBe(true)
    expect(ignored('/work/app/canvas/.canvas/vite/deps/react.js')).toBe(true)
    expect(ignored('/work/app/canvas/.canvas/vite-editor/deps/_metadata.json')).toBe(true)
    expect(ignored('/work/app/canvas/.canvas/vite-frame')).toBe(true)
    expect(ignored('C:\\work\\app\\canvas\\.canvas\\vite-frame'.replace('C:', ''))).toBe(true)
  })

  test('leaves the other files of the work folder and of the project', () => {
    expect(ignored('/work/app/canvas/.canvas/requests/onboarding/welcome.json')).toBe(false)
    expect(ignored('/work/app/canvas/.canvas/vitest/x')).toBe(false)
    expect(ignored('/work/app/canvas/screens/vite/a.tsx')).toBe(false)
    expect(ignored('/work/app/other/.canvas/vite/x')).toBe(false)
  })
})

describe('isInside', () => {
  test('the folder and each path in it, not a folder with the same start', () => {
    expect(isInside('/a/b', '/a/b')).toBe(true)
    expect(isInside('/a/b/c', '/a/b')).toBe(true)
    expect(isInside('/a/b/c', '/a/b/')).toBe(true)
    expect(isInside('/a/bc', '/a/b')).toBe(false)
  })
})

describe('slashes and folderProblem', () => {
  test('slashes gives / between the parts and no / at the end', () => {
    expect(slashes('C:\\work\\app\\')).toBe('C:/work/app')
    expect(slashes('/work/app/')).toBe('/work/app')
    expect(slashes('/')).toBe('/')
    expect(toolRoot.endsWith('/')).toBe(false)
  })

  test('a project that is not a folder is a problem', () => {
    expect(folderProblem('/work/app', () => true)).toBeNull()
    expect(folderProblem('/work/none', () => false)).toBe('The project folder /work/none does not exist or is not a folder.')
  })
})

describe('an installed tool and a host that is too wide', () => {
  test('a tool below node_modules is installed', () => {
    expect(isInstalled('/w/app/node_modules/canvas-editor')).toBe(true)
    expect(isInstalled('C:\\w\\node_modules\\canvas-editor')).toBe(true)
    expect(isInstalled('/w/canvas-editor')).toBe(false)
  })

  test('the lookup that ends at an installed tool found no project', () => {
    const tool = '/w/app/node_modules/canvas-editor'
    expect(noProjectProblem(tool, tool, '/w/app')).toContain('Run canvas init in the host first')
    expect(noProjectProblem('/w/app/canvas', tool, '/w/app')).toBeNull()
    expect(noProjectProblem('/w/canvas-editor', '/w/canvas-editor', '/w/canvas-editor')).toBeNull()
  })

  test('a clone of the tool run from a different folder found no project there', () => {
    const tool = '/w/canvas-editor'
    expect(noProjectProblem(tool, tool, '/w/app')).toContain('Run canvas init in the host first')
    expect(noProjectProblem(tool, tool, '/w/canvas-editor/tools')).toBeNull()
    expect(noProjectProblem('/w/app/canvas', tool, '/w/app')).toBeNull()
  })

  test('the home folder and the root of the file system are no host', () => {
    expect(hostProblem('/Users/me', '/Users/me')).toContain('The host would be /Users/me')
    expect(hostProblem('/', '/Users/me')).toContain('The host would be /')
    expect(hostProblem('/Users/me/app', '/Users/me')).toBeNull()
  })
})
