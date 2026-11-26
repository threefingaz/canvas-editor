---
name: canvas-check
description: Check the screen files against the design system and fix what the check finds. Read this skill when the user asks to check the screens, to find or fix deviations from the design system or the library, to make the screens use tokens, or to get the project ready for a review. It runs `canvas check` and tells you what to fix and what to leave.
---

# Check the screens

`canvas check` runs as `AGENTS.md` says. It reads each screen file and finds what the code does against the design system and against the rules of a screen file: an element that is not from the library, an inline `style`, a `className`, a raw value (`'13px'`, `'#667085'`, a number of pixels), a handler or a hook, an import of a component, a placeholder text, a link to a screen that does not exist, a wrong `meta`, a `flow.json` that is not valid, a broken relation, a marker of the block of an option (`canvas-part`) that breaks a rule. It exits with 1 when it finds one. `canvas check -- <screen>` checks one screen.

1. **Run `canvas check`.** With no finding, say so, and stop.
2. **Read** [Screen files](../../screen-files.md), and `packs/<name>/AGENTS.md` with the library skill that it links: the parts and the tokens of the library. At the level `connected` the pack has often neither: use "Before the tokens are set up" in [canvas-screen](../canvas-screen/SKILL.md).
3. **Fix each finding in its screen file:**
   - a raw value that is equal to a token: write the token; the screen looks the same;
   - a raw value that is equal to no token: write the nearest token, and name the change that a person can see;
   - a plain element or a component of your own: build it from the parts of the library, with the same content (an own component in `components/` is not a finding: the user asked for it, and the check names it in a note);
   - a handler, a hook, a `className`, an import of a component: remove it; a screen is a picture of one state;
   - a broken link: the address of the screen that the control leads to, or no link when that screen is not drawn. When the user deleted or renamed the target on the canvas, "A link to a deleted screen" in [Requests](../../requests.md) says how to decide; name each link that you removed or changed in your report.
4. **Leave** a finding that a comment in the file says is intended, a finding that an explicit instruction of the user caused, and a finding that the library cannot do (the one `svg` of a chart). If you cannot tell, leave it and ask.
5. **With the editor open,** read `.canvas/issues/<screen id>.json` of each screen: an issue with `set: "screen"` is a value of the screen file with no token, and an issue of the kind `layout` says that the content is wider than the screen. Fix these too. An issue with `set: "library"` is a default of a component: leave it.
6. **Run `canvas check` again,** then `canvas build` (in a host, the build can fail before any work: `AGENTS.md` says what to do).
7. **Report:** what you fixed, what looks different now, and each finding that is left, with its cause.

Change only the screen files. Do not change the library, its pack in `packs/`, or `tokens.json`.
