import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { toolAliases } from './tools/react-resolve.ts'

// The tests of a pack import the token module of the tool by its name,
// `canvas-editor/tokens` (`toolAliases`).
const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  resolve: { alias: toolAliases(root) },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tools/**/*.test.ts', 'packs/**/*.test.ts'],
  },
})
