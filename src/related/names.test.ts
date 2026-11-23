import { describe, expect, test } from 'vitest'
import { flowOfId, flowProblem, idOf, memberName, nameOfId, nameProblem } from './names.ts'

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
