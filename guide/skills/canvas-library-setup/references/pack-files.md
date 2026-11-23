# Pack files

The files of a pack `packs/<name>/`, each with what it holds and how to write it. `canvas init` writes the first three; level 2 completes them and adds the others.

| File | What it holds | Written by |
|---|---|---|
| `pack.json` | the manifest: the short name, the sources of the components, `scaleKeys` | `canvas init`; `scaleKeys` at level 2 |
| `library/provider.tsx` | the wrapper of a screen, `LibraryProvider` | `canvas init` (a plain one); completed at level 2 |
| `library/tokens.ts` | the token entry, `export function tokens(): Token[]` | `canvas init` (an empty list); written at level 2 |
| `library/theme.ts` | the theme, only when it cannot be imported from the host | level 2, when needed |
| `skills/canvas-library-<name>/` | the library skill, and next to it the copied guidance of the library | level 2 |
| `AGENTS.md` | the instructions for the library, with the link to the library skill | level 2 |
| `package.json` | only in the tool repository: an npm workspace with the packages of the library | `canvas init --library <package>@<range>` |

## `pack.json`

- `name`: the short name, lowercase letters, numbers and hyphens. It is the folder name and the end of the name of the library skill. `canvas init` takes it from the package (`@acme/ui` gives `acme`).
- `sources`: each npm package of the components of the library, and each folder of the host that holds them, as a path that starts with `./` or `../` and is relative to the host root (`./src/design-system`). An element counts as "from the library" when it is imported from a package of the list or a path below it, or by a relative import into a folder of the list. An import through an alias of the bundler of the host (`@/components`) is not read: a screen imports such a folder with a relative path. A library whose components are in two packages names both. An older pack has `"package": "<npm package>"`, a list of one; it stays valid.
- `scaleKeys`: the keys of the style object of the library, and the props with the same name, whose **number** is a step of a scale of the theme and not a count of pixels. The tool knows these keys of a size: `fontSize`, `letterSpacing`, `borderRadius` and its four corners, `borderWidth`, `padding` and `margin` with `Top`, `Right`, `Bottom`, `Left`, `Inline`, `Block`, `X`, `Y`, and `gap`, `rowGap`, `columnGap`. For each, find what the library does with a number: read its types and its source, or render one element with that key and a number to a text in Node, with the theme of the pack, and read the CSS. Put a key into the list when the number is a step (`padding: 2` gives two steps of the spacing); leave it out when the number is pixels (`fontSize: 14` gives 14 px). Use only the keys of this list, each side by its long name; a short key of the library (`p`, `mx`) is not needed. A library that takes no number as a step gets `[]`. `canvas check` then reports a number under a key that is not in the list as a raw value. With no `scaleKeys` it finds no number of pixels: say so.
- `packs/` holds one pack. A second pack stops the tool with a message that names the two.

## `library/provider.tsx`

`LibraryProvider` takes `children` and gives them what each screen needs from the library: its theme provider, its base styles, its stylesheets, its fonts. The frame renders each screen inside it. Nothing of the editor goes into it, and nothing of the product (a router, a store, data, a layout of the application).

- Take it from the entry of the host application: the providers of the library around the application, in the same sequence, with the same theme. Import the theme file of the host by a relative path with its extension (`../../../../src/theme.ts` from `canvas/packs/<name>/library/`). When that file needs an alias of the bundler of the host, or a module that only the application has, copy the part that the theme needs into `library/theme.ts` and name the copy in your report.
- Import a stylesheet here, and only here.
- Relative imports in `library/` carry the file extension (`./theme.ts`): the tool loads the token entry with no bundler.
- Import the types and the helpers of the token format by the name `canvas-editor/tokens`. It is a name that the tool gives its token module, not a package to install, and no relative path into the tool.
- The dev server restarts by itself when `pack.json` or the provider changes; the editor then reloads.

## `package.json` (the tool repository only)

In a host the library is installed already, and the pack has no `package.json`. In the tool repository, `canvas init --library <package>@<range>` writes it: `"name": "canvas-pack-<name>"`, `"private": true`, `"version": "0.0.0"`, `"type": "module"`, and the library in `dependencies`. The root `package.json` has `"workspaces": ["packs/*"]`; run `npm install` in the root. Add a further package (a font, icons) only when the user named or permitted it.

## A library with no React package

A stylesheet with classes and CSS variables, with its React form not available: with the user's permission, the pack itself is the package. Copy the stylesheet into `library/`, unchanged, when its licence permits it, with the licence text next to it; record where it came from; leave out the files that it loads which the pack does not have (fonts), and say so. Write thin components in `components/index.tsx` that render the markup of the documentation of the library, with one prop for each token group, each prop value a class that points at the token variable (`gap="xs"` gives a class with `gap: var(--lib-gap-xs)`). Give no `className` and no `style` prop: the editor reads each value from a rule. In `package.json`, `"exports": { ".": "./components/index.tsx" }`; in `pack.json`, `sources` is `["canvas-pack-<name>"]`. In a host, put the components into a folder of the host and name it in `sources`. Tell the user that the screens use this wrapper and not the components of the product. The library skill says in section 2 of the contract that the library has no override at the place of use: an edit that no prop carries gets `needs-library-change`.

## `AGENTS.md` of the pack

The guide names no library: the skill `canvas-screen` sends the agent here at step 3, and [Requests](../../../requests.md) when it applies a request. It has:

- **Stack**: the packages and their versions, and the `sources` that count as the library.
- **Files**: the files of the pack, one line each.
- **The library skill**: a relative link to `./skills/canvas-library-<name>/SKILL.md`, and when to read it. A skill in the pack does not load by its description; this link is the only way to it.
- **Requests**: the breakpoints and how a `media` condition maps to the form of the code; the examples of the section "Format" of [Requests](../../../requests.md), written with the library; and how an edit is written: the props, then the override of the library, for each change kind. Section 8 of [the contract](./contract.md) lists the cases.
- **Charts**: the plain parts of the library for bars, and how an `svg` element takes a color of the palette.

Mark each answer that was not seen in the editor, as "How to fill it" in [the contract](./contract.md) says.
