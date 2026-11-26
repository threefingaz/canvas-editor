// The record of a running dev server: `.canvas/dev.json` of the project,
// `{ "port", "pid", "url" }`. `canvas dev` writes it when the server listens
// and removes it when the process ends; `canvas status` reads it and says
// where the dev server runs. A record of a process that is gone (the process
// was killed) counts as no record.
//
// The decisions are pure; `writeDevRecord`, `removeDevRecord`,
// `readDevServer` and `pidAlive` do the work on the disk and the process.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { posix } from 'node:path'
import { config } from '../canvas.config.ts'
import { readText, slashes } from './project.ts'

export type DevRecord = { port: number; pid: number; url: string }

export const devRecordName = 'dev.json'

// The path of the record of a project.
export function devRecordPath(project: string): string {
  return posix.join(slashes(project), config.work, devRecordName)
}

// The address of a dev server: the local address that Vite resolved, else
// `localhost` with the port.
export function devUrl(port: number, local: readonly string[] | undefined): string {
  return local?.[0] ?? `http://localhost:${port}/`
}

export function devRecordText(record: DevRecord): string {
  return `${JSON.stringify({ port: record.port, pid: record.pid, url: record.url }, null, 2)}\n`
}

// The record of a text, or null for no file and for a text that is not a
// record.
export function parseDevRecord(text: string | null): DevRecord | null {
  if (text === null) return null
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof data !== 'object' || data === null) return null
  const { port, pid, url } = data as Record<string, unknown>
  if (typeof port !== 'number' || !Number.isInteger(port) || port <= 0) return null
  if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0) return null
  if (typeof url !== 'string' || url === '') return null
  return { port, pid, url }
}

// The dev server that runs: the record of the text when its process is alive.
export function runningDevServer(text: string | null, alive: (pid: number) => boolean): DevRecord | null {
  const record = parseDevRecord(text)
  return record !== null && alive(record.pid) ? record : null
}

// A process removes only its own record: a second dev server of the project
// wrote a new one, and that one stays.
export function ownsRecord(text: string | null, pid: number): boolean {
  return parseDevRecord(text)?.pid === pid
}

// Whether a process with this id runs. A process of a different user gives
// `EPERM`: it runs.
export function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

export function readDevServer(project: string): DevRecord | null {
  return runningDevServer(readText(devRecordPath(project)), pidAlive)
}

// Writes the record. The record is a help for `canvas status`, thus a folder
// that cannot be written does not stop the dev server.
export function writeDevRecord(project: string, record: DevRecord): void {
  const path = devRecordPath(project)
  try {
    mkdirSync(posix.dirname(path), { recursive: true })
    writeFileSync(path, devRecordText(record))
  } catch {
    // No record: the status then says nothing of the dev server.
  }
}

// Removes the record of this process. It is synchronous: it also runs in the
// `exit` event of the process.
export function removeDevRecord(project: string, pid: number): void {
  const path = devRecordPath(project)
  if (!ownsRecord(readText(path), pid)) return
  try {
    rmSync(path, { force: true })
  } catch {
    // The status reads the process id, thus a record that stays is harmless.
  }
}
