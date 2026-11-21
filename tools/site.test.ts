import { describe, expect, test } from 'vitest'
import { siteEntry, siteFileName, siteIndex } from './site.ts'

describe('siteFileName', () => {
  test('the entry of the site becomes index.html', () => {
    expect(siteFileName('site.html')).toBe('index.html')
    expect(siteFileName(siteEntry)).toBe(siteIndex)
  })

  test('a different HTML file keeps its name', () => {
    expect(siteFileName('frame.html')).toBe('frame.html')
    expect(siteFileName('index.html')).toBe('index.html')
    expect(siteFileName('docs/site.html')).toBe('docs/site.html')
  })

  test('an asset keeps its name', () => {
    expect(siteFileName('assets/site-B_NEkaQa.js')).toBe('assets/site-B_NEkaQa.js')
    expect(siteFileName('assets/site-DarR0eD7.css')).toBe('assets/site-DarR0eD7.css')
    expect(siteFileName('favicon.svg')).toBe('favicon.svg')
  })
})
