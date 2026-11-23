---
name: canvas-check
description: Check the screen files against the design system and fix what the check finds. Read this skill when the user asks to check the screens, to find or fix deviations from the design system or the library, to make the screens use tokens, or to get the project ready for a review. It runs `npm run check` and tells you what to fix and what to leave.
---

# Check the screens

`npm run check` reads each screen file and finds what the code does against the design system and against the rules of a screen file: an element that is not from the library, an inline `style`, a `className`, a raw value (`'13px'`, `'#667085'`, a number of pixels), a handler or a hook, an import of a component, a placeholder text, a link to a screen that does not exist, a wrong `meta`, a broken relation. It exits with 1 when it finds one. `npm run check -- <screen>` checks one screen.

1. **Run `npm run check`.** With no finding, say so, and stop.
2. **Read** "Screen files" of `AGENTS.md`, and `packs/<name>/AGENTS.md` with the library skill that it links: the parts and the tokens of the library.
3. **Fix each finding in its screen file:**
   - a raw value that is equal to a token: write the token; the screen looks the same;
   - a raw value that is equal to no token: write the nearest token, and name the change that a person can see;
   - a plain element or a component of your own: build it from the parts of the library, with the same content;
   - a handler, a hook, a `className`, an import of a component: remove it; a screen is a picture of one state;
   - a broken link: the address of the screen that the control leads to, or no link when that screen is not drawn.
4. **Leave** a finding that a comment in the file says is intended, a finding that an explicit instruction of the user caused, and a finding that the library cannot do (the one `svg` of a chart). If you cannot tell, leave it and ask.
5. **With the editor open,** read `.canvas/issues/<screen id>.json` of each screen: an issue with `set: "screen"` is a value of the screen file with no token, and an issue of the kind `layout` says that the content is wider than the screen. Fix these too. An issue with `set: "library"` is a default of a component: leave it.
6. **Run `npm run check` again,** then `npm run lint` and `npm run build`.
7. **Report:** what you fixed, what looks different now, and each finding that is left, with its cause.

Change only the screen files. Do not change the library, its pack in `packs/`, or `tokens.json`.
