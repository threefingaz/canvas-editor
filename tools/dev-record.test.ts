import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import {
  devRecordPath,
  devRecordText,
  devUrl,
  ownsRecord,
  parseDevRecord,
  pidAlive,
  readDevServer,
  removeDevRecord,
  runningDevServer,
  writeDevRecord,
} from './dev-record.ts'
import { slashes } from './project.ts'

const record = { port: 5173, pid: 4242, url: 'http://localhost:5173/' }

describe('the record of the dev server', () => {
  test('the path is in the work folder of the project', () => {
    expect(devRecordPath('/h/canvas')).toBe('/h/canvas/.canvas/dev.json')
  })

  test('the address is the local address of the server, else localhost with the port', () => {
    expect(devUrl(5173, ['http://localhost:5173/', 'http://127.0.0.1:5173/'])).toBe('http://localhost:5173/')
    expect(devUrl(5180, [])).toBe('http://localhost:5180/')
    expect(devUrl(5180, undefined)).toBe('http://localhost:5180/')
  })

  test('the text reads back as the record', () => {
    expect(parseDevRecord(devRecordText(record))).toEqual(record)
    expect(JSON.parse(devRecordText(record))).toEqual(record)
  })

  test('no file and a text that is not a record give no record', () => {
    expect(parseDevRecord(null)).toBeNull()
    expect(parseDevRecord('{')).toBeNull()
    expect(parseDevRecord('null')).toBeNull()
    expect(parseDevRecord(JSON.stringify({ ...record, pid: '4242' }))).toBeNull()
    expect(parseDevRecord(JSON.stringify({ ...record, pid: 0 }))).toBeNull()
    expect(parseDevRecord(JSON.stringify({ ...record, port: 1.5 }))).toBeNull()
    expect(parseDevRecord(JSON.stringify({ port: 5173, pid: 4242 }))).toBeNull()
  })

  test('a dev server runs only when the process of its record is alive', () => {
    const text = devRecordText(record)
    expect(runningDevServer(text, (pid) => pid === 4242)).toEqual(record)
    expect(runningDevServer(text, () => false)).toBeNull()
    expect(runningDevServer(null, () => true)).toBeNull()
  })

  test('a process owns only the record with its id', () => {
    expect(ownsRecord(devRecordText(record), 4242)).toBe(true)
    expect(ownsRecord(devRecordText(record), 1)).toBe(false)
    expect(ownsRecord(null, 4242)).toBe(false)
  })
})

describe('the record on the disk', () => {
  const folders: string[] = []

  afterEach(() => {
    for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true })
  })

  function project(): string {
    const folder = slashes(mkdtempSync(join(tmpdir(), 'canvas-dev-record-')))
    folders.push(folder)
    return folder
  }

  test('this process is alive', () => {
    expect(pidAlive(process.pid)).toBe(true)
  })

  test('a written record of this process is a running dev server, and its removal ends that', () => {
    const folder = project()
    expect(readDevServer(folder)).toBeNull()
    const own = { ...record, pid: process.pid }
    writeDevRecord(folder, own)
    expect(readFileSync(devRecordPath(folder), 'utf8')).toBe(devRecordText(own))
    expect(readDevServer(folder)).toEqual(own)
    // The record of a different process stays.
    removeDevRecord(folder, process.pid + 1)
    expect(existsSync(devRecordPath(folder))).toBe(true)
    removeDevRecord(folder, process.pid)
    expect(existsSync(devRecordPath(folder))).toBe(false)
    expect(readDevServer(folder)).toBeNull()
    // No file: the removal does nothing.
    removeDevRecord(folder, process.pid)
  })
})
