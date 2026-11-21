import { describe, expect, test, vi } from 'vitest'
import { siteEntry, siteIndex, sitePlugin } from './site-plugin.ts'

// A file of the bundle, as the hook reads it.
type File = { type: 'asset'; source: string } | { type: 'chunk'; code: string }

// Runs the hook of the plugin on a bundle with a fake context; gives the
// files that the hook emitted.
function run(bundle: Record<string, File>): unknown[] {
  const emitFile = vi.fn()
  const hook = sitePlugin().generateBundle as (this: unknown, options: unknown, bundle: Record<string, File>) => void
  hook.call({ emitFile }, {}, bundle)
  return emitFile.mock.calls.map(([file]) => file)
}

describe('sitePlugin', () => {
  test('the names', () => {
    expect(siteEntry).toBe('site.html')
    expect(siteIndex).toBe('index.html')
  })

  test('the entry of the site goes out of the bundle and comes back as index.html with the same text', () => {
    const chunk: File = { type: 'chunk', code: 'export {}' }
    const css: File = { type: 'asset', source: 'body{}' }
    const bundle: Record<string, File> = {
      'site.html': { type: 'asset', source: '<script src="./assets/site.js"></script>' },
      'assets/site.js': chunk,
      'assets/site.css': css,
    }
    expect(run(bundle)).toEqual([
      { type: 'asset', fileName: 'index.html', source: '<script src="./assets/site.js"></script>' },
    ])
    expect(Object.keys(bundle)).toEqual(['assets/site.js', 'assets/site.css'])
    expect(bundle['assets/site.js']).toBe(chunk)
    expect(bundle['assets/site.css']).toBe(css)
  })

  test('a bundle with no entry of the site does not change, and nothing is emitted', () => {
    const bundle: Record<string, File> = { 'frame.html': { type: 'asset', source: '<p></p>' } }
    expect(run(bundle)).toEqual([])
    expect(Object.keys(bundle)).toEqual(['frame.html'])
  })

  test('a chunk with the name of the entry is not touched', () => {
    const bundle: Record<string, File> = { 'site.html': { type: 'chunk', code: '' } }
    expect(run(bundle)).toEqual([])
    expect(Object.keys(bundle)).toEqual(['site.html'])
  })

  test('the plugin runs only in the build, after the other plugins', () => {
    const plugin = sitePlugin()
    expect(plugin.apply).toBe('build')
    expect(plugin.enforce).toBe('post')
  })
})
