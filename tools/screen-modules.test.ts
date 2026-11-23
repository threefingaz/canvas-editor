import { describe, expect, test } from 'vitest'
import { screenModulesCode, tokensModuleCode } from './screen-modules.ts'

// Runs the text of a module with no imports of its own: each `import(path)`
// gives the path, thus a test can call a loader.
function evaluate(code: string): Record<string, unknown> {
  const body = code.replace('export const modules =', 'return').replace('export default', 'return').replaceAll('import(', 'load(')
  return new Function('load', body)((path: string) => path) as Record<string, unknown>
}

describe('screenModulesCode', () => {
  test('gives a loader for each screen by its id, with the absolute path of the file', () => {
    const code = screenModulesCode([
      { id: 'onboarding/welcome', path: '/work/app/canvas/screens/onboarding/welcome.tsx' },
      { id: 'home', path: '/work/app/canvas/screens/home.tsx' },
    ])
    expect(code).toContain('() => import("/work/app/canvas/screens/onboarding/welcome.tsx")')
    const modules = evaluate(code) as Record<string, () => string>
    expect(Object.keys(modules)).toEqual(['home', 'onboarding/welcome'])
    expect(modules['onboarding/welcome']()).toBe('/work/app/canvas/screens/onboarding/welcome.tsx')
  })

  test('gives an empty map with no screen', () => {
    expect(evaluate(screenModulesCode([]))).toEqual({})
  })

  test('keeps an id that is a name of the prototype of an object as an own key', () => {
    const modules = evaluate(screenModulesCode([{ id: '__proto__', path: '/p/screens/__proto__.tsx' }]))
    expect(Object.hasOwn(modules, '__proto__')).toBe(true)
  })

  test('writes a path with a quote or a backslash as a valid text', () => {
    const modules = evaluate(screenModulesCode([{ id: 'a', path: `/p/it's\\a.tsx` }])) as Record<string, () => string>
    expect(modules.a()).toBe(`/p/it's\\a.tsx`)
  })
})

describe('tokensModuleCode', () => {
  test('gives the text of the token file', () => {
    expect(evaluate(tokensModuleCode('{"tokens":[]}\n'))).toBe('{"tokens":[]}\n')
  })

  test('gives null with no file', () => {
    expect(evaluate(tokensModuleCode(null))).toBeNull()
  })
})
