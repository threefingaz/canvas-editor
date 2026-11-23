import { describe, expect, it } from 'vitest'
import { distProblem, tscPath, typeCheckOf } from './build.ts'

describe('typeCheckOf', () => {
  const tool = '/work/host/node_modules/canvas-editor'

  it('checks all code of the tool in standalone', () => {
    expect(typeCheckOf(tool, tool, () => false)).toEqual({ args: ['-b'], cwd: tool })
    expect(typeCheckOf(`${tool}/`, tool, () => false)).toEqual({ args: ['-b'], cwd: tool })
  })

  it('checks the tsconfig.json of a project outside the tool, with no output', () => {
    const exists = (path: string) => path === '/work/host/canvas/tsconfig.json'
    expect(typeCheckOf('/work/host/canvas', tool, exists)).toEqual({
      args: ['-p', '/work/host/canvas/tsconfig.json', '--noEmit'],
      cwd: '/work/host/canvas',
    })
  })

  it('gives no type check for a project with no tsconfig.json', () => {
    expect(typeCheckOf('/work/host/canvas', tool, () => false)).toBeNull()
  })
})

describe('tscPath', () => {
  it('reads the tsc script of the bin field', () => {
    expect(tscPath('/t/typescript/package.json', JSON.stringify({ bin: { tsc: './bin/tsc' } }))).toBe('/t/typescript/bin/tsc')
    expect(() => tscPath('/t/typescript/package.json', JSON.stringify({}))).toThrow('names no tsc script')
  })
})

describe('distProblem', () => {
  const site = '<script type="module" crossorigin src="./assets/site-DQ_UIpWG.js"></script>'

  it('takes no folder, an empty folder, and a site of an earlier build', () => {
    expect(distProblem('/h/canvas/dist', false, null, null)).toBeNull()
    expect(distProblem('/h/canvas/dist', false, [], null)).toBeNull()
    expect(distProblem('/h/canvas/dist', false, ['assets', 'index.html'], site)).toBeNull()
  })

  it('refuses a folder with other files in a host, not in the tool', () => {
    expect(distProblem('/h/dist', false, ['main.js'], null)).toContain('The folder /h/dist has files that are not a site')
    expect(distProblem('/h/dist', false, ['index.html'], '<html></html>')).not.toBeNull()
    expect(distProblem('/t/dist', true, ['main.js'], null)).toBeNull()
  })
})
