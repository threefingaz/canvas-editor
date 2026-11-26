import { describe, expect, test } from 'vitest'
import { flowOfId, flowProblem, idOf, memberName, nameOfId, nameProblem, renameClashes } from './names.ts'

describe('names', () => {
  test('a name and a flow use letters, digits, - and _, with a letter or a digit first', () => {
    expect(nameProblem('welcome-2_b')).toBeNull()
    expect(nameProblem('-welcome')).toMatch(/is not a valid name/)
    expect(nameProblem('a.b')).toMatch(/is not a valid name/)
    expect(flowProblem('')).toBeNull()
    expect(flowProblem('app/settings')).toBeNull()
    expect(flowProblem('app/')).toMatch(/is not a valid flow/)
  })

  test('the id, the flow and the name', () => {
    expect(idOf('a/b', 'c')).toBe('a/b/c')
    expect(idOf('', 'c')).toBe('c')
    expect(flowOfId('a/b/c')).toBe('a/b')
    expect(flowOfId('c')).toBe('')
    expect(nameOfId('a/b/c')).toBe('c')
  })

  test('a member whose name starts with the name of its base follows the new name', () => {
    expect(memberName('welcome-option-2', 'welcome', 'hello')).toBe('hello-option-2')
    expect(memberName('welcomed', 'welcome', 'hello')).toBe('welcomed')
    expect(memberName('error', 'welcome', 'hello')).toBe('error')
  })
})

describe('renameClashes', () => {
  const ids = ['onboarding/welcome', 'onboarding/done', 'start']
  test('gives no clash for a free id and for a change of the case of the own id', () => {
    expect(renameClashes(ids, [['onboarding/welcome', 'onboarding/hello']], 'onboarding')).toEqual([])
    expect(renameClashes(ids, [['onboarding/welcome', 'onboarding/Welcome']], 'onboarding')).toEqual([])
  })

  test('two screens whose ids differ only in their case: the case of one id cannot become the other', () => {
    const pair = ['a/Welcome', 'a/welcome']
    expect(renameClashes(pair, [['a/welcome', 'a/Welcome']], 'a')).toEqual(["a screen with the id 'a/Welcome' exists"])
    expect(renameClashes(pair, [['a/Welcome', 'a/welcome']], 'a')).toEqual(["a screen with the id 'a/welcome' exists"])
  })

  test('names an id or a flow that differs only in its case, and two screens with one new id', () => {
    expect(renameClashes(ids, [['onboarding/welcome', 'onboarding/Done']], 'onboarding')).toEqual(["a screen with the id 'onboarding/done' exists"])
    expect(renameClashes(ids, [['onboarding/welcome', 'Onboarding/hello']], 'Onboarding')[0]).toMatch(/^the flow 'onboarding' exists/)
    // A folder above a nested flow is the same folder too, in each direction.
    expect(renameClashes(ids, [['start', 'Onboarding/forms/start']], 'Onboarding/forms')[0]).toMatch(/^the flow 'onboarding' exists/)
    const nested = ['onboarding/forms/step1', 'start']
    expect(renameClashes(nested, [['start', 'Onboarding/start']], 'Onboarding')[0]).toMatch(/^the folder 'onboarding' of a flow exists/)
    expect(renameClashes(nested, [['start', 'onboarding/start']], 'onboarding')).toEqual([])
    expect(renameClashes(nested, [['start', 'onboarding/Forms/start']], 'onboarding/Forms')[0]).toMatch(/^the flow 'onboarding\/forms' exists/)
    expect(
      renameClashes(
        ids,
        [
          ['onboarding/welcome', 'onboarding/a'],
          ['onboarding/done', 'onboarding/A'],
        ],
        'onboarding',
      ),
    ).toEqual(["two screens would get the id 'onboarding/A'"])
  })
})
