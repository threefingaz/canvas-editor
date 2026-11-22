---
description: Create a new screen or a flow of screens for a task of the person who uses it
agent: agent
---

Create a new screen, or a flow of screens, in the screens folder. The request of the user:

${input:task:What is the task of the person who uses the screen?}

Work as the section "How to create a screen" of `AGENTS.md` says, in its six steps.
Read the design skills first and decide what the screen needs; choose the parts of the library only after that.

- Draw each state that the task needs as its own screen file, as the section "Screen files" of `AGENTS.md` says.
- Link the screens: a control that leads to a drawn screen gets the address of that screen.
- Run `npm run check -- <the new screens>`, and fix each finding that the user did not ask for.
- Run `npm run lint` and `npm run build`.

Report as section 7 of the skill `canvas-screen-design` says.
