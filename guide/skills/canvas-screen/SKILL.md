---
name: canvas-screen
description: Create a new screen or a flow of screens in `screens/`, from a task of the person who will use it. Read this skill when the user asks to create, draw, add or prototype a screen, a page, a view, a flow or a set of states, or to draw a screen for a different width. It is the entry: it gives the sequence of the work ("How to create a screen") and who decides what, and sends you to the design skills, the library skill and the rules of a screen file in `guide/screen-files.md`.
---

# Create a screen

A screen is a code file in `screens/<flow>/<name>.tsx`, built only from the parts of the library. The user sees it as a frame on the canvas. A path in this skill is relative to the folder of the project (the folder of `AGENTS.md`); a Markdown link is relative to this file. `canvas <command>` runs as `AGENTS.md` says.

## How to create a screen

Work in this sequence. The design skills come two times: first to decide what the screen needs, and at the end to check the result. The library comes between them, because a component can only carry a decision that is already made.

| Step | Source | The question |
|---|---|---|
| 1 | the request of the user | What is the task of the person who will use the screen? |
| 2 | [canvas-screen-design](../canvas-screen-design/SKILL.md), sections 1 to 3 and the sections that its table gives; [canvas-information-display](../canvas-information-display/SKILL.md) when the screen shows data | What is on the screen, and what is not: the screens of the flow, the fields, the messages, the form of the data? |
| 3 | `packs/<name>/AGENTS.md` and the library skill that it links (`packs/<name>/skills/canvas-library-<name>/`), and `packs/<name>/library/`; at the level `connected`, the types and the documentation of the library (below); with no pack, level 1 of [canvas-library-setup](../canvas-library-setup/SKILL.md) first | Which component and which token carry each decision? |
| 4 | [Screen files](../../screen-files.md) | How is the screen written in `screens/`? |
| 5 | `canvas-screen-design`, section 7 | Does the task go through the screens, can each person use them, and what must the user know? |
| 6 | `canvas check -- <the screens that you wrote>` | Does the code keep to the library: no plain element, no inline `style`, no raw value, no link to no screen? |

In each step:

1. **The task.** Write down, in one or two lines each: the task in the words of the person, with real values; the situation; the scenario as a list of actions and answers. If the user did not give the task, state the task that you assumed. Ask the user only when you cannot assume one.
2. **Decide what the screens need.** Decide the screens of the flow, the fields, the messages and the states before you choose a component.
3. **Choose the parts** with the pack of the library. Run `canvas status` when you do not know the level of the library. With no pack (level `none`), do level 1 of the skill `canvas-library-setup` (one command, `canvas init`), then go on. At the level `connected`, see "Before the tokens are set up" below.
4. **Write the files** as [Screen files](../../screen-files.md) says: one file for one screen, `export const meta = { title, width }`, only the library, no state and no handlers, no component of your own. Each state is a full file with `stateOf`; a screen at a different width is a full file of its own (`<name>-mobile.tsx`). Use real and a little awkward content, never placeholder text. **Link the flow:** a control that leads to a drawn screen gets `href="#/<screen id>"`. A control whose target is not drawn has no link.
5. **Walk the task** through the screens and check access, as section 7 of `canvas-screen-design` says.
6. **Check:** `canvas check -- <the screens that you wrote>`, then `canvas build` (in a host, the build can fail before any work: `AGENTS.md` says what to do). Fix each finding. With the editor open (`canvas status` prints the address of a dev server that runs), read `.canvas/issues/<screen id>.json` too: it says what only the page shows, such as a content that is wider than the screen (kind `layout`). An item with `"set": "library"` is a default of a component of the library, not a deviation: leave it.

Step 6 is the one check that you can run with no browser: you do not see the screen, and the check reads the code. Fix each finding before you report. Three findings can stay, and you name each one in your report with its reason: one that an explicit instruction of the user asked for; a plain element that the library skill permits for a purpose (the one `svg` of a chart); and a value with no token that the design skills permit and the library has no scale for. Do not make a finding go away by a different spelling of the same value (a number in place of `'13px'`): use the token.

Do not start at step 3. An agent that chooses components first and checks them later keeps the structure that it built: a check finds a weak label, but it does not remove a screen that the task did not need.

**Report** as section 7 of `canvas-screen-design` says, in about ten lines: what you left out, what the screens assume, the states and the behavior that are not drawn, the controls with no link, and each finding of the check that stays, with its reason.

## Before the tokens are set up

At the level `connected` (`canvas status` says so: `tokens.json` has no token, and the pack has often no library skill and no `AGENTS.md` yet), the screens render with the library, and you can make them. Do not wait for level 2, and do not do it unless the user asks: the user's task is the screen.

- **The provider first:** when `packs/<name>/library/provider.tsx` only renders its children and the entry of the host application puts a theme provider, base styles or a stylesheet of the library around the application, do step 1 of level 2 of `canvas-library-setup` (the provider) before the screen. It is a part of the setup, not a change of the library, and it takes minutes; without it the screens show the default look of the library, not the look of the product. Name it in your report.
- **The parts:** read the types of the library in `node_modules/<package>/` (in a host, the `node_modules` of the host root: `../node_modules/<package>/` from the folder of `AGENTS.md`) (the props of each component, its variants, its sizes) and the documentation in the package (`README.md`, a `docs` folder, `llms.txt`, a skill). `sources` in `pack.json` names the packages and folders that count as the library; import only from them.
- **The values:** use the props and the scales of the library (a spacing step, a color role, a text variant), as its types name them, never a raw value. Where you cannot tell the form of a value from the types, choose the prop that the documentation shows, and name it in your report.
- **The check:** `canvas check` finds a plain element, a `style`, a `className` and a raw text value (`'13px'`). With no `scaleKeys` in `pack.json` it does not find a number of pixels (`fontSize: 14`): write none. The editor counts no value as a deviation yet, thus the check is the proof.
- **The report** names that level 2 is open, with the sentence that sets it up: `Set up the tokens of the library as the skill canvas-library-setup says.` After it, the editor links each value, and a value that no token gives becomes a deviation.

## Who decides what

- **An explicit instruction of the user** (in the prompt, or in a comment of a request): it wins over the design skills, over a default of the library, and over the guidance of the library. The user owns the screen and can break a rule. Do what the instruction says, and name each rule that it breaks in your report, in one line with the rule and its source, thus the user can change the decision. Do not refuse, and do not put the nearest permitted form in its place. Only an instruction that states the thing itself counts ("make this button pink", "use a confirmation here"): a general wish ("make it stronger") is done inside the rules. Three things stay fixed, because they are how the tool works and not guidance: the form of a screen file ([Screen files](../../screen-files.md): one file for one screen, `meta`, no state and no handlers, no component of your own, no import from the tool); no change of the library, of its pack or of `tokens.json` (the provider step of "Before the tokens are set up" is part of the setup); no change outside `screens/` for a request. The four items below hold where the user gave no such instruction.
- **Behavior and content** (which steps, which fields, an undo and no confirmation, a table and no chart): the design skills decide, and the library carries the decision out. If the library has no part for it, build it from the simplest parts of the library and tell the user.
- **The look** (colors, shapes, text styles, the place of the parts of a component): the library decides. Its default wins over a rule of the look in a skill, and the agent does not override a component.
- **Layout** (where a component is, how wide, what is next to it): the agent decides, with the scales of the library.
- **An explicit rule in the library's own guidance** (a skill or a guide that comes with the design system): it wins over the design skills, also on behavior and content, because it is a decision of the owners of the product. Where that guidance is silent, the design skills apply. The agent reports each conflict to the user, with the two rules. A component that only exists is not such a rule.
