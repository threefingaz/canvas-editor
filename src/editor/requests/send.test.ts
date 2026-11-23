import { describe, expect, test } from 'vitest'
import { agentAddress } from '../../requests/api.ts'
import { agentWay, answerOf, clipboardWay, copyLabel, copyStatus, copyText, idle, noAnswer, sendLabel, sendStatus, sendText, sendToAgent, stateAfter, wayOf, type Fetch } from './send.ts'

const sentence = 'Apply the requests.'

describe('answerOf', () => {
  test('the two answers of the dev server', () => {
    expect(answerOf({ started: true })).toEqual({ started: true })
    expect(answerOf({ started: false, reason: 'the command "code" was not found' })).toEqual({
      started: false,
      reason: 'the command "code" was not found',
    })
  })

  test('a different form is a failure', () => {
    for (const value of [null, 'ok', 1, {}, { started: 'yes' }, { started: false }, { started: false, reason: '' }]) {
      expect(answerOf(value)).toEqual({ started: false, reason: noAnswer })
    }
  })
})

describe('sendToAgent', () => {
  test('a POST with no content to the address of the agent', async () => {
    const calls: unknown[] = []
    const fetch: Fetch = async (address, init) => {
      calls.push([address, init])
      return { ok: true, status: 200, json: async () => ({ started: true }) }
    }
    expect(await sendToAgent(fetch)).toEqual({ started: true })
    expect(calls).toEqual([[agentAddress, { method: 'POST' }]])
  })

  test('an error status, a text that is not JSON and a failed call are answers with a reason', async () => {
    const status: Fetch = async () => ({ ok: false, status: 404, json: async () => ({}) })
    expect(await sendToAgent(status)).toEqual({ started: false, reason: `${noAnswer}, status 404` })
    const text: Fetch = async () => ({ ok: true, status: 200, json: () => Promise.reject(new SyntaxError('no JSON')) })
    expect(await sendToAgent(text)).toEqual({ started: false, reason: noAnswer })
    const failed: Fetch = () => Promise.reject(new TypeError('Failed to fetch'))
    expect(await sendToAgent(failed)).toEqual({ started: false, reason: noAnswer })
  })
})

describe('the texts of the button', () => {
  const failed = stateAfter({ started: false, reason: 'the command "code" was not found' })

  test('stateAfter', () => {
    expect(stateAfter({ started: true })).toEqual({ kind: 'sent' })
    expect(failed).toEqual({ kind: 'failed', reason: 'the command "code" was not found' })
  })

  test('the short text', () => {
    expect(sendText(idle)).toBe('Send to the agent')
    expect(sendText({ kind: 'sending' })).toBe('Sending…')
    expect(sendText({ kind: 'sent' })).toBe('Sent to the agent')
    expect(sendText(failed, 'failed')).toBe('Not sent')
    expect(sendText(failed, 'copied')).toBe('Copied: paste it in the chat')
    expect(sendText(failed)).toBe('Copied: paste it in the chat')
  })

  test('a sent sentence says where the chat opens', () => {
    expect(sendLabel({ kind: 'sent' }, 'idle', sentence)).toBe(
      'Sent to the agent. The chat of the agent opens with the sentence.',
    )
  })

  test('a failure has the reason and says that the sentence is copied', () => {
    expect(sendLabel(failed, 'copied', sentence)).toBe(
      'The agent command did not start (the command "code" was not found). The sentence is copied: paste it into the chat of the agent.',
    )
  })

  test('a failure with a failed copy gives the sentence', () => {
    expect(sendLabel(failed, 'failed', sentence)).toBe(
      `The agent command did not start (the command "code" was not found). Cannot copy to the clipboard. Give the agent: ${sentence}`,
    )
  })

  test('only a result is announced', () => {
    expect(sendStatus(idle, 'idle', sentence)).toBe('')
    expect(sendStatus({ kind: 'sending' }, 'idle', sentence)).toBe('')
    expect(sendStatus({ kind: 'sent' }, 'idle', sentence)).toBe(sendLabel({ kind: 'sent' }, 'idle', sentence))
    expect(sendStatus(failed, 'copied', sentence)).toBe(sendLabel(failed, 'copied', sentence))
  })
})

describe('the way', () => {
  test('wayOf reads the two answers, and a different form is the clipboard', () => {
    expect(wayOf({ way: 'command', preset: 'vscode' })).toEqual({ way: 'command', preset: 'vscode' })
    expect(wayOf({ way: 'command', preset: null })).toEqual({ way: 'command', preset: null })
    expect(wayOf({ way: 'command' })).toEqual({ way: 'command', preset: null })
    expect(wayOf({ way: 'clipboard' })).toEqual(clipboardWay)
    for (const value of [null, 'command', 1, {}, { way: 'other' }]) expect(wayOf(value)).toEqual(clipboardWay)
  })

  test('agentWay is a GET with no content; an error is the clipboard', async () => {
    const calls: unknown[] = []
    const fetch: Fetch = async (address, init) => {
      calls.push([address, init])
      return { ok: true, status: 200, json: async () => ({ way: 'command', preset: 'vscode' }) }
    }
    expect(await agentWay(fetch)).toEqual({ way: 'command', preset: 'vscode' })
    expect(calls).toEqual([[agentAddress, { method: 'GET' }]])
    expect(await agentWay(async () => ({ ok: false, status: 404, json: async () => ({ way: 'command' }) }))).toEqual(clipboardWay)
    expect(await agentWay(() => Promise.reject(new TypeError('Failed to fetch')))).toEqual(clipboardWay)
  })

  test('the idle label names the preset, or the command of the config', () => {
    expect(sendLabel(idle, 'idle', sentence, 'vscode')).toBe('Open the chat of the agent with the sentence for the agent, by the preset vscode')
    expect(sendLabel(idle, 'idle', sentence)).toBe('Open the chat of the agent with the sentence for the agent, by the command of canvas.config.ts')
  })

  test('the texts of the one button of the clipboard', () => {
    expect(copyText('idle')).toBe('Copy for the agent')
    expect(copyText('copied')).toBe('Copied: paste it in the chat of the agent')
    expect(copyText('failed')).toBe('Not copied')
    expect(copyLabel('failed', sentence)).toBe(`Cannot copy to the clipboard. Give the agent: ${sentence}`)
    expect(copyStatus('idle', sentence)).toBe('')
    expect(copyStatus('copied', sentence)).toBe(copyLabel('copied', sentence))
  })
})
