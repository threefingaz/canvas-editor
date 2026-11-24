---
name: canvas-library-setup
description: How to connect a component library (a design system) to the canvas tool as a library pack in `packs/<name>/`, in two levels. Read this skill when the editor says that no library is connected or that the tokens are not set up, when the user says `Connect a library as the skill canvas-library-setup says.` or `Set up the tokens of the library as the skill canvas-library-setup says.`, when the user asks to add, replace or update the library, or when `canvas status` names a step of the setup. Level 1 is one command (`canvas init`) and the screens render at once; level 2 is the work of the agent: the provider from the host application, the token entry with a helper of the tool, `scaleKeys`, the library skill and the `AGENTS.md` of the pack. The proof is `canvas status` and `canvas check`; the checks on a page are the last, optional part.
---

# The setup of a library

A path in this skill is relative to the folder of the project (the folder of `AGENTS.md`); a Markdown link is relative to this file. `canvas <command>` runs as `AGENTS.md` says.

All that is specific to the component library is in one folder of the project, the **pack** `packs/<name>/`. The tool finds it by itself; no file of the tool, of `guide/` or the root `AGENTS.md` changes for a library. The setup has two levels:

| Level | What the editor does | Who makes it |
|---|---|---|
| `none` | says "No library is connected"; no screen renders | |
| `connected` (level 1) | the screens render with the library; selection, comments, options, links and the site work; it says "The tokens are not set up", has no token controls and counts no value as a deviation | `canvas init`, seconds |
| `ready` (level 2) | links each value to a token, counts the deviations, and the agent has a library skill | you, with this skill |

**Start with `canvas status`.** It prints the library, the level, the provider, the tokens by group, the library skill, the `AGENTS.md` of the pack, the screens, the findings of the check, the address of a dev server that runs, and the next step. Do the step that it names, and run it again at the end.

**Ask nothing that you can find or decide.** The package, its version, its theme, its stylesheet, its tokens and its guidance are in `package.json`, in `node_modules` and in the files of the host. Decide each detail as this skill says, and name the decision in your report, thus the user can change it. Ask only when you cannot go on: two candidates for the library and nothing in the host that tells which one the product uses, or a package to install that the user did not name.

## Level 1: connect the library

- **In a host project** (the project is a folder such as `canvas/` in an application): run `canvas init`. It finds the one dependency of the host that has React as a peer dependency; with more than one, it lists them and stops: run `canvas init --library <package>` with the one that the entry of the host application uses. For a design system that is a folder of the host, `--library ./src/<folder>`.
- **In the tool repository** (standalone): `canvas init --library <package>@<range>`, then the `npm install` that it names. Add the peer dependencies that the library names (`peerDependencies` in its `package.json`, other than React) to `packs/<name>/package.json` before the install. Install only a package that the user named or that the library needs as a peer. The package is not installed when `canvas init` runs, thus the provider has no stylesheet: when the installed package exports one, add its import to the provider after the install.
- `canvas init` writes `pack.json` with `sources`, a provider that renders the screen (with the stylesheet of the package when the package exports one), an empty token entry and an empty `tokens.json`. A running dev server restarts by itself and the editor reloads; if the editor still says "No library is connected", stop the dev server and run `canvas dev` again.

With level 1 done, the screens can be made (the skill [canvas-screen](../canvas-screen/SKILL.md) says how at this level). When the user asked for a screen, make it now, and do level 2 only when the user asks for it.

## Level 2: the tokens and the library skill

Do the steps in this sequence. [Pack files](./references/pack-files.md) has the details of each file.

1. **The provider** `packs/<name>/library/provider.tsx`. Read the entry of the host application (`src/main.tsx`, `src/App.tsx`, the root layout): what it puts around the application from the library (the theme provider with its theme, the base styles, the stylesheets, the fonts). Write the same into `LibraryProvider`, with no router, no data and no part of the product. Import the theme of the host by a relative path with its extension; copy it into `library/` only when it needs an alias of the bundler of the host. Make the library write CSS variables when it has a switch for that ([Finding the tokens](./references/tokens.md), question 2): with no variable on the page, no value is linked.
2. **The token entry** `packs/<name>/library/tokens.ts`, with a helper of the tool, imported by the name `canvas-editor/tokens`:
   - a theme object: `tokensFromObject(theme, map)`, a map from the paths of the theme to the groups;
   - a stylesheet with custom properties: `tokensFromCss(text, options)`;
   - both, or a file of the documentation: [Finding the tokens](./references/tokens.md), "Write the token entry".

   Then run `canvas tokens`. `canvas status` shows the count of each group: each group that the library has is not empty. A group that the library does not have (shadows, strokes) stays empty; name it.
3. **`scaleKeys`** in `pack.json`: the keys whose number is a step of a scale of the theme (`padding: 2` gives two steps), not a count of pixels. [Pack files](./references/pack-files.md) says how to find them. With no list the check finds no number of pixels.
4. **The guidance of the library.** Look for a skill or a guide in the package in `node_modules` (`SKILL.md`, `AGENTS.md`, `llms.txt`, a `skills` folder) and in the host. Follow [Existing guidance](./references/existing-guidance.md): keep it whole in `packs/<name>/skills/`, or point to it.
5. **The library skill** `packs/<name>/skills/canvas-library-<name>/SKILL.md`, from [The contract of a library skill](./references/contract.md): eight sections that answer the questions of the design skills. Answer from the types and the source of the installed package, render a component to a text in Node when you need its CSS, and mark each answer that was not seen on a page.
6. **The `AGENTS.md` of the pack**: the packages and `sources`, the files of the pack, the link to the library skill, the section "Requests" (the breakpoints, and each change kind written with the library), and the parts for a chart. [Pack files](./references/pack-files.md) has the list.
7. **The tests of the pack** in `packs/<name>/library/tokens.test.ts`, in the tool repository only (a host has no test runner of the tool): the tokens pass `parseTokens`, the ids are unique, each group of the library is not empty.

## The proof

1. `canvas status`: the level is `ready`, each group of the library has tokens, the library skill and the `AGENTS.md` of the pack are there, and the next step is "the setup is done". The level is `ready` as soon as the tokens exist: the level alone is not the proof.
2. A sample screen `screens/sample/<name>.tsx` (`<name>` is the name of the pack; a library that is a folder of the host is imported by a relative path with its extension, `../../../src/design-system/index.tsx` from `canvas/screens/sample/`) with a heading, a text, a button that links to its own screen (`href="#/sample/<name>"`), a field, a card or a panel, and a group with spacing, written with the library skill and the rules of [Screen files](../../screen-files.md). `canvas check -- sample/<name>` finds nothing. Keep it: it is the check for the next version of the library.
3. `canvas build` passes: the type check reads the pack and the screens. In a host with no types of React or Node (`@types/react`, `@types/node`), it fails also before the setup: run it once before you start, and name the errors that were there in your report; do not install a package for them.

**The checks on a page** (optional, the last part; with no browser, name them as open in your report). With `canvas dev` and a visible browser: the sample renders with its styles; a click selects each element with its place in the code, and no element of the library has the marker "not from the library"; the inspector shows each color, spacing, radius, shadow and text style as **linked to a token** (a value that is only "equal to a token" is a finding: go back to the token entry); one edit of each group, applied as [Requests](../../requests.md) says, links the new token after the reload; with the Preview switch on, a click on the button keeps the canvas at its frame.

## Report

In about ten lines: the library and its level; the source of the tokens and the count of each group; the groups that the library does not have; what is linked and what only matches, or that it was not seen on a page; `scaleKeys`; the guidance that was found and where it is now; the questions of the contract that stay open; each conflict between that guidance and the design skills; each decision that you made in place of a question.

## A change of the library, and an update

- **A new version of the same library**: in standalone, change the version in `packs/<name>/package.json` and run `npm install`; in a host, the host updates it. Run `canvas tokens` and the proof again. Copy its guidance again if it has a new version, and record the version.
- **A different library**: move the old pack out of `packs/` only when the user says so (two packs stop the tool), then both levels again. Screens of the old library do not render; tell the user before you start.
