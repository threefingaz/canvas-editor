import { defineConfig } from 'vitest/config'
import { toolRoot } from './tools/project.ts'
import { toolAliases } from './tools/react-resolve.ts'

// The tests of a pack import the token module of the tool by its name,
// `canvas-editor/tokens` (`toolAliases`), from the folder of the tool with
// `/` between the parts.
const root = toolRoot

export default defineConfig({
  resolve: { alias: toolAliases(root) },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tools/**/*.test.ts', 'packs/**/*.test.ts'],
  },
})
