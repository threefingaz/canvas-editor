# Canvas Editor

## What this project is

A canvas of screen prototypes. Each screen is a real code file, built only from the parts of one React component library, and the tool shows each screen as a frame on a canvas. A person edits the screens on the canvas; the tool saves each edit as a request, and you, the agent, write each request into the code. Code is the source of truth: you create the screens, you apply the requests, and you keep each screen within the library.

Read this file first. Then read only the file of your job, as the table below says. Each path in this file is relative to the folder of this file.

## The folders

| Path | What it is |
|---|---|
| `screens/<flow>/<name>.tsx` | The screens, one file for each. One folder is one flow and one row on the canvas. You write these files. |
| `packs/<name>/` | The library pack: all that is specific to the component library. `packs/<name>/AGENTS.md` names its packages, its breakpoints and how an edit is written with it, and links its library skill. |
| `.canvas/requests/` | The request files that the editor writes, one for each screen with open edits. |
| `.canvas/issues/` | The Issues list of each screen, written by the editor while it is open. Read it; do not change it. |
| `tokens.json` | The tokens of the library, written by `canvas tokens`. Do not change it by hand. |
| `canvas.config.ts` | The screen widths of the project and `agent`, the way of "Send to the agent". |
| `guide/` | The guide: the rules of a screen file, the guide of the requests, and the skills. |
| `dist/` | The prototype site, written by `canvas build`. |
| `src/`, `tools/` | The tool itself. A screen or a request never changes them. |

## What to read

| The situation | Read |
|---|---|
| No library is connected: `packs/` has no pack, `canvas status` says level `none`, the editor says "No library is connected", or the user says `Connect a library as the skill canvas-library-setup says.` Level 1 is one command, `canvas init`; do it before a screen. | [guide/skills/canvas-library-setup/SKILL.md](guide/skills/canvas-library-setup/SKILL.md) |
| Level 2: the library is connected and its tokens are not set up: `canvas status` says level `connected`, the editor says "The tokens are not set up", or the user says `Set up the tokens of the library as the skill canvas-library-setup says.` You can create screens meanwhile, as `canvas-screen` says. | [guide/skills/canvas-library-setup/SKILL.md](guide/skills/canvas-library-setup/SKILL.md) |
| The library is added, replaced or updated. | [guide/skills/canvas-library-setup/SKILL.md](guide/skills/canvas-library-setup/SKILL.md) |
| **How to create a screen:** the user asks for a new screen, a flow, a state, an option, or a screen at a second width. | [guide/skills/canvas-screen/SKILL.md](guide/skills/canvas-screen/SKILL.md): the sequence of the work, and who decides what |
| You create or change a screen in `screens/`, for each reason. | [guide/skills/canvas-screen-design/SKILL.md](guide/skills/canvas-screen-design/SKILL.md): what goes on a screen and what does not |
| The screen has a chart, a diagram, a map, key numbers, numbers to compare, results of a survey, or a comparison of things. | [guide/skills/canvas-information-display/SKILL.md](guide/skills/canvas-information-display/SKILL.md), together with the design skill above |
| **Screen files:** the rules of a screen file (`meta`, only the library, states, options, links). | [guide/screen-files.md](guide/screen-files.md) |
| **Requests:** the user says `Apply the canvas requests as AGENTS.md says.` (or the older form with `in .canvas/requests/`), or asks to apply the edits, the comments or the options of the editor. | [guide/skills/canvas-apply/SKILL.md](guide/skills/canvas-apply/SKILL.md), then the full guide [guide/requests.md](guide/requests.md) |
| The user asks to check the screens or to fix the deviations from the library. | [guide/skills/canvas-check/SKILL.md](guide/skills/canvas-check/SKILL.md) |
| You choose a component or a token, or write an edit with the library. | `packs/<name>/AGENTS.md` and the library skill that it links; with no pack, [guide/skills/canvas-library-setup/SKILL.md](guide/skills/canvas-library-setup/SKILL.md) |

The two design skills (`canvas-screen-design` and `canvas-information-display`) name no component and hold for each library. The library pack gives the components and the tokens.

## What stays fixed

These three things hold also when the user asks for a different thing:

1. **The form of a screen file:** one file for one screen, with `meta`; only the parts of the library; no state, no handlers, no component of your own, and no import from the tool. [guide/screen-files.md](guide/screen-files.md) has the rules.
2. **No change of the library:** not of its pack in `packs/`, and not of `tokens.json`. When a task needs one, say so in your reply. The one exception is the setup of the library itself (`canvas-library-setup`: its two levels, and an update of the library), and the provider step of `canvas-screen` ("Before the tokens are set up").
3. **No change outside `screens/` for a request**, except the request files in `.canvas/requests/`, as [guide/requests.md](guide/requests.md) says.

## Commands

The guide writes each command of the tool as `canvas <command>`. Here, `canvas <command>` runs as `npm run <command>`, with `--` before its arguments and options (or `node bin/canvas.js <command>`, with no `--`): `canvas check -- onboarding/welcome` is `npm run check -- onboarding/welcome`, and `canvas init --library @mui/material@^9` is `npm run init -- --library @mui/material@^9`.

- `canvas check -- <screen>…`: checks the named screen files with no browser, and prints each finding with its file, line and kind. With no screen, it checks all. Run it after each change of a screen.
- `canvas build`: the type check, then the build of the prototype site into `dist/`.
- `canvas tokens`: writes `tokens.json` from the token entry of the library pack.
- `canvas dev`: starts the editor at http://localhost:5173/ and the site at http://localhost:5173/site.html.
- `canvas preview`: serves the built site from `dist/`.
- `canvas init`: connects a library at level 1 (the pack, an empty token entry), as [canvas-library-setup](guide/skills/canvas-library-setup/SKILL.md) says. In a project of its own it needs `--library <package>[@<range>]` (with no range, `latest`), and then `npm install`; in a host it finds the library that the host has installed.
- `canvas status`: the state of the project: the library and its level, the tokens by group, the library skill, the screens, the findings of the check, and the next step of the setup. Run it first when you are not sure what is set up.
- `canvas sync`: in a project in a host, copies this file and `guide/` again from the tool, after an update of the tool. Do not change the copy by hand.

A path in a request file and in the output of `canvas check` is relative to the folder of this file.

In a host, `canvas build` runs the type check with `tsconfig.json` of this folder. When the host has no types of React (`@types/react`), it fails before any work: run it once before you change a file, and name the errors that were there in your report; do not install a package for them. The lint and the type check of the host can read this folder too: a finding of their rules in a screen file is not a finding of the canvas. Name it in your report, and tell the user that their config can leave this folder out; do not change that config.

For a developer of the tool itself (`src/`, `tools/`, the guide, the documents): read [docs/development.md](docs/development.md).
