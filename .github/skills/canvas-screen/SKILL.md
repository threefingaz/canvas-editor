---
name: canvas-screen
description: Create a new screen or a flow of screens in `screens/`, from a task of the person who will use it. Read this skill when the user asks to create, draw, add or prototype a screen, a page, a view, a flow or a set of states, or to draw a screen for a different width. It is the entry: it gives the sequence of the work and sends you to the design skills, the library skill and the rules of a screen file in `AGENTS.md`.
---

# Create a screen

A screen is a code file in `screens/<flow>/<name>.tsx`, built only from the parts of the library. The user sees it as a frame on the canvas. Work in this sequence; it is the section "How to create a screen" of `AGENTS.md`. Do not start with the components.

1. **The task.** Write down, in one or two lines each: the task in the words of the person, with real values; the situation; the scenario as a list of actions and answers. If the user did not give the task, state the task that you assumed. Ask the user only when you cannot assume one.
2. **Decide what the screens need:** read the skill `canvas-screen-design`, sections 1 to 3 and the rows of its table that match the screen; and `canvas-information-display` when the screen shows data to compare. Decide the screens of the flow, the fields, the messages and the states before you choose a component.
3. **Choose the parts:** read `packs/<name>/AGENTS.md` and the library skill that it links. With no pack in `packs/`, stop and follow the skill `canvas-library-setup`.
4. **Write the files** as the section "Screen files" of `AGENTS.md` says: one file for one screen, `export const meta = { title, width }`, only the library, no state and no handlers, no component of your own. Each state is a full file with `stateOf`; a screen at a different width is a full file of its own (`<name>-mobile.tsx`). Use real and a little awkward content, never placeholder text.
5. **Link the flow:** a control that leads to a drawn screen gets `href="#/<screen id>"`. A control whose target is not drawn has no link.
6. **Check:** `canvas-screen-design`, section 7 (the walk through the task, and access); then `npm run check -- <the screens that you wrote>`, `npm run lint` and `npm run build`. Fix each finding. With the editor open, read `.canvas/issues/<screen id>.json` too: it says what only the page shows, such as a content that is wider than the screen.
7. **Report** as section 7 of `canvas-screen-design` says, in about ten lines: what you left out, what the screens assume, the states and the behavior that are not drawn, the controls with no link, and each finding of the check that stays, with its reason.
