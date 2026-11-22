---
name: canvas-library-setup
description: How to connect a component library (a design system) to the canvas tool as a library pack in `packs/<name>/`. Read this skill when `packs/` has no pack and the editor says that no library is connected, when the user asks to add, replace or update the library, when `tokens.json` cannot be written, or when the pack has no library skill `canvas-library-<name>`. It covers the questions to the user, the search for guidance that the library already has, the files of the pack, the search for the tokens, the wrapper of a screen, the library skill, and the proof that the connection works.
---

# The setup of a library

The tool shows screens that are made from one component library. The design skills and the code of the tool do not depend on that library; all that does is in one folder, the **pack** `packs/<name>/`:

| File in `packs/<name>/` | What it holds |
|---|---|
| `pack.json` | the manifest: the short name of the library and its npm package |
| `package.json` | an npm workspace with the packages of the library |
| `library/` | the wrapper of a screen (`provider.tsx`), the theme if the library has one, the token entry (`tokens.ts`), and their tests |
| `skills/canvas-library-<name>/` | the library skill: how the library carries each design decision; and next to it, the copied guidance of the library |
| `AGENTS.md` | the instructions for the library: its packages, its breakpoints, how an edit is written with it, and the link to the library skill |

To connect a library is to write this folder. The tool finds the pack by itself and needs no other change: no code in `src/` or `tools/`, no config, no root `AGENTS.md`. From the pack, `npm run tokens` writes `tokens.json`, the tokens in the one format that the tool reads.

The tool was developed with a pack for a sample library: a theme object in `library/theme.ts`, a token entry that reads that theme, a provider with the theme provider and the base styles of the library, and a library skill with the eight sections of the contract. The clean tool has no pack, thus this skill and its reference files describe each step in full. When you replace a library, the pack of the old one is an example of each file.

**With no library connected, do not create a screen.** A screen from plain elements has no tokens, and each of its values is an issue. Do the setup first, or tell the user that it is needed.

A library is connected when: `packs/` has one folder with a valid `pack.json`; `npm install` installed the packages of its `package.json`; `library/provider.tsx` exports `LibraryProvider`; `library/tokens.ts` exports `tokens()`, and `npm run tokens` writes `tokens.json` with no error; the pack has `AGENTS.md` and the skill `skills/canvas-library-<name>/SKILL.md`; and the editor shows the screens with no message "No library is connected".

## 1. Ask the user

Ask these before you read code; an agent cannot find the answers:

1. Which package is the library, and which version? Is it in the internal registry?
2. Is there a separate package or file of design tokens? Does the product use a theme of its own, or the default of the library?
3. Does the library come with guidance for agents or developers: a skill, an instruction file, a guide? Where?
4. For a token group that the library does not have (shadows; strokes, which are the widths of borders): is it empty, or does it come from somewhere else?
5. For a scale that takes each number (spacing, corner radius): which steps does the product use? If the user does not know, choose the steps of the documentation of the library, and name them in your report.
6. Does the library need more packages for a screen: a font, icons? May you install them? With no font package, a screen shows the next font of the list; say so in your report.
7. May you copy guidance of the library into the pack, if you find some?

## 2. Find the guidance that exists

Look for a skill or a guide of the library: in its package in `node_modules` (files such as `SKILL.md`, `AGENTS.md`, `llms.txt`, a `skills` folder), in its source repository, and where the user said. With no network, look only in the package and where the user said, and tell the user that the source repository was not searched. Then follow [Existing guidance](./references/existing-guidance.md).

In short: keep the guidance of the library whole and unchanged in `packs/<name>/skills/`, and write a short library skill of ours next to it. Do not rewrite it into our form.

## 3. The pack and the packages

- Choose the short `<name>`: lowercase letters, numbers and hyphens. It is the folder name, the `name` in `pack.json`, and the end of the name of the library skill.
- `packs/` holds one pack. A second pack stops the tool with a message that names the two. To replace a library, move its pack out of `packs/` first, and only when the user says so.
- Write `packs/<name>/pack.json`: `{ "name": "<name>", "package": "<npm package>" }`. The tool marks an element as "from the library" when it is imported from `package` or from a path below it.
- Write `packs/<name>/package.json`: `"name": "canvas-pack-<name>"`, `"private": true`, `"version": "0.0.0"`, `"type": "module"` (with no `type`, Node prints a warning when it loads the token entry, and the dev server shows it in place of the token count), and the packages of the library in `dependencies`, with the version or the range that the user gave. The root `package.json` already has `"workspaces": ["packs/*"]`; do not add the packages there.
- Ask the user before you add a package; the project permits few dependencies. Then run `npm install` in the project root, from the registry that the project uses. npm puts the packages into the root `node_modules`, thus a screen in `screens/` can import them.
- The dev server reads the pack when it starts. A running dev server restarts by itself when the pack is complete: `pack.json` and `library/provider.tsx` (step 4) both exist. Until the provider is written, its output says that the pack has no `library/provider.tsx` yet; when the server restarts, it says "the library pack changed", and the open editor reloads. A change, a removal or a move of `pack.json` restarts it too. If the server was not running, start it with `npm run dev`. If the editor still says "No library is connected" after the two files are written, stop the dev server and run `npm run dev` again.
- If the library needs more than one package for its components, tell the user: `pack.json` has one `package`, and the others would show as "not from the library".
- **A library with no React package** (a stylesheet with classes and CSS variables, with its React form not available): with the user's permission, the pack itself is the package. Copy the stylesheet into `library/`, unchanged, when its licence permits it (keep the licence text next to it, as [Existing guidance](./references/existing-guidance.md) says for a copy), and record where it came from; leave out files that it loads which the pack does not have (fonts), and say so. Write thin components in `components/index.tsx` that render the markup of the documentation of the library, with one prop for each token group, each prop value a class that points at the token variable (`gap="xs"` gives a class with `gap: var(--lib-gap-xs)`). Give no `className` and no `style` prop: the editor reads each value from a rule. These components are the library, not a wrapper in a screen; the rules of a screen file stay as they are. The library then has no override at the place of use: the library skill says so in section 2 of the contract, and an edit that no prop can carry gets `needs-library-change`. In `package.json`, set `"exports": { ".": "./components/index.tsx" }`; in `pack.json`, `package` is `canvas-pack-<name>`; a screen imports from `canvas-pack-<name>`. Tell the user that the screens use this wrapper and not the components of the product, and that the wrapper is replaced when the React package is available.

## 4. The wrapper of a screen

`packs/<name>/library/provider.tsx` exports `LibraryProvider`: a component that takes `children` and gives them what each screen needs from the library (its theme provider, its base styles, its fonts). The frame loads it through the module `virtual:canvas-library` and renders each screen inside it. Nothing of the editor goes into it.

If the library has a stylesheet, import it here, and only here.

Relative imports in `library/` carry the file extension (`./theme.ts`), because Node imports the token entry directly. The types of the token format are in `src/tokens/format.ts` (`../../../src/tokens/format.ts` from `library/`). The code of the tool never imports from the pack; a test (`tools/core-clean.test.ts`) fails if it does.

## 5. The tokens

This is the main step. Follow [Finding the tokens](./references/tokens.md): where the values are, how a token shows on the page, how it is written in code, and how the token entry `library/tokens.ts` gives them.

This step needs a page. Write the sample screen of step 7 now, with a first token entry, and open it in the editor: the answers come from what the page shows. If you have no browser, answer from the source code of the library, mark each such answer "not seen on a page" in the token entry and in the library skill, and tell the user that the proof of step 7 is open.

## 6. The library skill and the instructions of the pack

Write `packs/<name>/skills/canvas-library-<name>/SKILL.md` from [The contract of a library skill](./references/contract.md). It answers the questions that the design skills hand over. When the library has guidance of its own, this skill is short: it points to that guidance and adds what it leaves open.

Then write `packs/<name>/AGENTS.md`. The root `AGENTS.md` names no library and sends the agent here at step 3 of "How to create a screen" and when it applies a request. It has:

- **Stack**: the packages and their versions, and the `package` that counts as the library.
- **Files**: the files of the pack, one line each.
- **The library skill**: a relative link to `./skills/canvas-library-<name>/SKILL.md`, and when to read it. A skill in the pack does not load by its description; this link is the only way to it.
- **Requests**: the breakpoints and how a `media` condition maps to the form of the code; the examples of the section "Format" of the root `AGENTS.md`, written with the library; and how an edit is written: the props, then the override of the library, for each change kind.
- **Charts**: the plain parts of the library for bars, and how an `svg` element takes a color of the palette. Try the form on the page before you write it.

## 7. The proof

A connection is proven, not assumed. Make one sample screen, `screens/sample/<name>.tsx`, with a heading, a text, a button, a field, a card or a panel, and a group with spacing. The rules of a screen file are in the section "Screen files" of the root `AGENTS.md`; the design skills are not needed for it, because it is a test of the library and not a screen for a person. Keep the screen after the proof: it is the check for the next version of the library. Then check, with the dev server (started or restarted after `pack.json` was written, see step 3) and a visible browser pane:

1. The screen renders with no error, and its styles are the same as with no editor.
2. A click on each element selects it, and its tag and its place in the code are correct. No element of the library has the marker "not from the library".
3. In the inspector, each color, spacing, radius, shadow and text style of the sample shows as **linked to a token**. A value that shows only as "equal to a token" or "no token" is a finding: go back to step 5, or note why the library cannot link it.
4. Change one token of each group in the editor, and apply the request as the section "Requests" of `AGENTS.md` says. The frame reloads, and the value is linked to the new token.
5. The button of the sample has the address of its own screen, `href="#/sample/<name>"`. It renders an `a` element; if it does not, find the part of the library that does (section 4 of [the contract](./references/contract.md)). With the Preview switch on, a click on it moves the canvas to its frame, and the Issues list has no broken link. After `npm run build` and `npm run preview`, the screen opens on the site, and a click on the button keeps it there.
6. `npm run lint`, `npm run build` and `npm test` pass.

Tests in `src/` and `tools/` use names of a sample library as fixtures; they do not need a change. The tests of the pack are in `packs/<name>/library/*.test.ts`, and `npm test` runs them: write tests for the token entry.

## 8. Finish

- Do not change the root `AGENTS.md`, `README.md` or a skill in `.github/skills/` for the library: they name no library. All that is specific to it is in the pack.
- Remove the pack of the library that was replaced only when the user says so.
- Tell the user: what the source of the tokens is; which groups have no tokens; which values link and which only match; what guidance of the library was found and where it is now; which questions of the contract stayed open; and each conflict between that guidance and the design skills.

## A change of the library, and an update

- **A new version of the same library**: change the version in `packs/<name>/package.json`, run `npm install`, and run step 7 again. If the library changed how it writes its values, step 5 fails loudly; that is intended. Copy its guidance again if it has a new version, and record the version.
- **A different library**: all steps, with a new pack. Screens that were made with the old library do not render; tell the user before you start.
