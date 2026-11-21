// The check that the core of the tool is clean: the code in `src/` and
// `tools/` (with the tests), the root config files and the two HTML entries
// import no path in `packs/` and no package that the root `package.json` does
// not declare. A pack brings its packages through its own `package.json`, and
// npm can place them, and the packages that they use, next to the packages of
// the core; only the root list says what the core has. The tool reads the pack
// only through its neutral entries (`virtual:canvas-library` and the token
// entry, which the token script loads by a computed path), thus the tool
// builds and runs with no pack. The test of this check is `core-clean.test.ts`;
// it reads the files and the package list.

import { builtinModules } from 'node:module'
import { parseSync, Visitor } from 'vite'
import { isRecord } from '../src/tokens/format.ts'
import { packsFolder } from './pack.ts'

// One import that the core must not have. `line` is 1-based.
export type PackImport = {
  line: number
  // The module text as the file writes it: '@scope/name/Button', '../packs/x/a.ts'.
  source: string
  // `package`: a package that the root `package.json` does not declare, or a
  // path below it; `pack-path`: a path in `packs/`.
  kind: 'package' | 'pack-path'
}

const packPath = new RegExp(`(^|/)${packsFolder}(/|$)`)

function lineOf(code: string, offset: number): number {
  return code.slice(0, offset).split('\n').length
}

// The package of a bare module text: '@scope/name' or 'name'. Null for a
// path, a URL, a module with a scheme (`node:fs`, `virtual:…`) and a subpath
// import (`#…`).
export function packageOf(source: string): string | null {
  if (/^[./\\#]/.test(source) || source.includes(':') || source.startsWith('\0')) return null
  const parts = source.split('/')
  return source.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

// The kind of a module text, or null when the core may import it. `declared`
// is the list of the packages that the root `package.json` declares.
function kindOf(source: string, declared: readonly string[]): PackImport['kind'] | null {
  if (packPath.test(source.replaceAll('\\', '/'))) return 'pack-path'
  const name = packageOf(source)
  if (name === null || declared.includes(name) || builtinModules.includes(name)) return null
  return 'package'
}

type SourceNode = { type: string; start: number; value?: unknown; quasis?: unknown[]; elements?: unknown[] }

// The texts of a module source node: a string literal, a template literal
// with no expression, or (for `import.meta.glob`) an array of them. Empty for
// a computed source, which the check cannot read.
function sourceTexts(node: SourceNode | null | undefined): string[] {
  if (!node) return []
  if (node.type === 'Literal' && typeof node.value === 'string') return [node.value]
  if (node.type === 'TemplateLiteral' && node.quasis?.length === 1) {
    const quasi = node.quasis[0] as { value: { cooked: string | null } }
    return quasi.value.cooked === null ? [] : [quasi.value.cooked]
  }
  if (node.type === 'ArrayExpression') return (node.elements ?? []).flatMap((item) => sourceTexts(item as SourceNode))
  return []
}

type CallNode = {
  callee: { type: string; name?: string; object?: { type: string }; property?: { type: string; name?: string } }
  arguments: SourceNode[]
}

// True for `require(…)` and `import.meta.glob(…)`.
function isModuleCall(node: CallNode): boolean {
  const { callee } = node
  if (callee.type === 'Identifier') return callee.name === 'require'
  return (
    callee.type === 'MemberExpression' &&
    callee.object?.type === 'MetaProperty' &&
    callee.property?.type === 'Identifier' &&
    callee.property.name === 'glob'
  )
}

// Each import of a path in `packs/`, and each import of a package that is not
// in `declared` (or of a path below one), in the code of one file: static
// imports, re-exports, dynamic `import()`, type imports (`import('…').Name`),
// `require(…)`, `import x = require(…)` and `import.meta.glob(…)`, each with a
// literal source. A name in a comment or in another string does not count.
// `file` gives the parser the language (`.ts`, `.tsx`). A file that does not
// parse throws.
export function packImports(code: string, file: string, declared: readonly string[]): PackImport[] {
  const { program, errors } = parseSync(file, code)
  if (errors.length > 0) throw new Error(`${file} cannot be parsed: ${errors[0].message}`)

  const found: PackImport[] = []
  const check = (node: SourceNode | null | undefined) => {
    if (!node) return
    for (const text of sourceTexts(node)) {
      // A negative pattern of `import.meta.glob` names a path too.
      const kind = kindOf(text.replace(/^!/, ''), declared)
      if (kind) found.push({ line: lineOf(code, node.start), source: text, kind })
    }
  }

  new Visitor({
    ImportDeclaration(node) {
      check(node.source)
    },
    ExportNamedDeclaration(node) {
      check(node.source)
    },
    ExportAllDeclaration(node) {
      check(node.source)
    },
    ImportExpression(node) {
      check(node.source as SourceNode)
    },
    TSImportType(node) {
      check(node.source as SourceNode)
    },
    TSExternalModuleReference(node) {
      check(node.expression)
    },
    CallExpression(node) {
      const call = node as unknown as CallNode
      if (isModuleCall(call)) check(call.arguments[0])
    },
  }).visit(program)

  return found.sort((a, b) => a.line - b.line)
}

// Each `src` and `href` of an HTML entry that names a path in `packs/` or a
// package that is not in `declared`.
export function htmlPackImports(html: string, declared: readonly string[]): PackImport[] {
  const found: PackImport[] = []
  for (const match of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)) {
    const source = match[1]
    const kind = kindOf(source, declared)
    if (kind) found.push({ line: lineOf(html, match.index), source, kind })
  }
  return found
}

// The packages that a `package.json` declares: each package that it lists.
// Throws for a file that is not valid JSON.
export function declaredPackages(packageJson: string): string[] {
  const data: unknown = JSON.parse(packageJson)
  if (!isRecord(data)) return []
  const names = new Set<string>()
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const list = data[field]
    if (isRecord(list)) {
      for (const name of Object.keys(list)) names.add(name)
    }
  }
  return [...names].sort()
}
