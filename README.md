# Canvas Editor

A local tool that shows the screens of a React design system on a canvas. Each screen is a real code file in `screens/`. Each screen shows as a frame. Click an element in a frame to see its place in the code and its style values. Each value is linked to a token, equal to a token, or has no token.

Edit an element in the inspector: change a token, a spacing or layout value, the sequence in the parent, or the text, or remove it. Each edit shows at once as a preview in the frame; the code does not change. Write a comment for a change that has no control. The tool saves the edits and the comments as request files, and an AI agent writes them into the code.

Screens can link to other screens. `npm run build` writes the screens as a prototype site: plain static files that stakeholders open and click through.

The tool runs on the local machine only. It needs no remote server and no cloud service.

All that is specific to the component library is in one folder, its pack: `packs/<name>/`. The tool finds the pack by itself. With no pack, the tool still builds and starts, and the editor says that no library is connected; give the agent the sentence that it shows, and the agent connects the library as a pack. A second pack next to the first stops the tool with a message.

## Start

Needs Node 22.18 or later: Node runs `tools/build-tokens.ts` directly and strips the types.

```sh
npm install
npm run tokens
npm run dev
```

Then open http://localhost:5173/ in Chrome or Edge, in a window that is 1024px wide or more. With no pack, `npm run tokens` writes no file and says so, and the editor shows the sentence for the agent:

```text
Connect a library as the skill canvas-library-setup says.
```

When the agent has written the pack (its `pack.json` and its provider), the running dev server restarts by itself and the editor reloads with the library. If the editor still says that no library is connected, stop the dev server and run `npm run dev` again.

## Use

- **Add a screen.** Put a file in `screens/<flow>/<name>.tsx` with a default export (the screen) and `export const meta = { title: 'Welcome', width: 1440 }`. `meta` is an object literal with a text `title` and a `width` from `widths` in `canvas.config.ts` (1440, 1024 or 390). One flow is one row on the canvas. A file that breaks a rule shows as a frame with the error.
- **Move and zoom.** The wheel pans. Ctrl or Cmd with the wheel, or a pinch, zooms. Space and drag, or a drag with the middle button, pans too. A click on the zoom value sets 100%.
- **Select.** A click on a frame selects the element of the screen file there. Escape clears the selection. A click on a parent in the breadcrumb of the inspector selects it.
- **Edit.** The inspector shows the controls for the selected element:
  - a step control or a select to change a color, shadow, text style, spacing or corner token (tokens only, no free numbers);
  - **Link** on a value that is equal to a token, and **Use nearest** on a value with no token;
  - a button that splits padding, margin or the corners into one value for each side;
  - direction, wrap, alignment and justification of a flex or grid container, and **Move earlier** and **Move later** in the parent;
  - a Content field for the text;
  - the bin icon, or the Delete or Backspace key, to remove the element.

  If the place in the code draws more than one copy (a list), all copies change, and the inspector says so.
- **Write a comment.** For a change that has no control ("make this a select", "add a state for an empty list"), write a task for the agent in the box "Comment for the agent": in the inspector for the selected element, or in the screen view (a click on the title of a frame) for the whole screen. **Add**, or Ctrl or Cmd with Enter, adds it. A comment has no preview; the Changes list shows it, and the count of changes includes it. A click on a comment in the Changes list opens its text for a change. An element can have more than one comment. A part that a component draws inside it (the helper line of a field) cannot be selected; write the comment on the component and name the part.
- **Link screens.** A screen links to a different screen with a plain address on a part of the library that takes one: `href="#/<screen id>"`, for example `<Button href="#/onboarding/workspace">`. Ask the agent to link the screens of a flow; the instructions give it the rules. A link to an id that no screen has shows in the Issues list.
- **Click through a flow on the canvas.** Turn on the **Preview** switch in the toolbar. A click on a link moves the canvas to the frame of its screen. With Preview on, nothing is selected, and the selection and the markers are hidden; pan, zoom and the keys still work. Turn Preview off to edit again. The button **Open as a full page** in the title of a frame opens the screen in the site, as a stakeholder sees it.
- **Undo and redo.** The toolbar buttons, or Ctrl or Cmd with Z, and with Shift for redo.
- **See the changes and the issues.** A click on the title of a frame, or on its count of issues, shows the Issues list of the screen (values with no token, local overrides, elements that are not from the library, links to a screen that does not exist, render errors) and the Changes list. A click on an item selects its element; a change has a discard button. Elements that are not from the library have a marker on the canvas; a toolbar switch hides the markers.
- **Give the edits to the agent.** The tool saves the edits of each screen in `.canvas/requests/<screen id>.json` (for example `.canvas/requests/onboarding/welcome.json`), a short time after each edit, and the Issues list in `.canvas/issues/<screen id>.json`. Git ignores `.canvas/`. The toolbar shows the count of changes; its button copies the fixed sentence for the agent:

  ```text
  Apply the canvas requests in .canvas/requests/ as AGENTS.md says.
  ```

  The agent applies the edits to the code, does the comments, and removes each applied item from the file. The frames reload, and the applied previews go away. An item that the agent did not apply stays, with its reply in the Changes list. The editor can stay open while the agent works.

  After a change of a screen file, an edit whose element the editor cannot find again is stale: the Changes list shows a warning and no preview. Discard it and make it again. An error of a load or a save of a file shows as a warning in the toolbar; the edits stay in the editor, and the next change saves them again. A request file that the editor cannot read is never written over.
- **After a change of the library code in the pack** (`packs/<name>/library/`, for example the theme), the dev server writes `tokens.json` again, and the inspector gets the new tokens. With no dev server, run `npm run tokens`.

## The prototype site

The site has an index of the screens by flow, and each screen as a full page at `#/<screen id>`, at the width of the browser window. A link in a screen opens the screen of its address; Back returns. The site has no editor and no canvas: it is for view only.

```sh
npm run build
npm run preview
```

`npm run build` writes the site into `dist/`. `npm run preview` serves it at http://localhost:4173/. In the dev server the site is at http://localhost:5173/site.html.

To share the site, copy the content of `dist/` to a static host. It needs no server rules: each address in it is relative, thus the folder works at each address, also in a sub folder (`https://example.com/team/prototypes/onboarding/`). Open the address of the folder with a `/` at the end, as a static host gives it.

The site needs a host, or `npm run preview`: a browser does not run its scripts from a file that is opened with a double click.

## Commands

- `npm run dev`: start the dev server with the editor (and the site at `/site.html`). Use this to work.
- `npm run tokens`: write `tokens.json` from the token entry of the library pack.
- `npm test`: run the unit tests once.
- `npm run test:watch`: run the unit tests on each change.
- `npm run lint`: check the code.
- `npm run build`: type check, and write the prototype site into `dist/`. The build has no editor: the element-to-code step and the file API run on the dev server only.
- `npm run preview`: serve the built site at http://localhost:4173/.
- `npm run export -- <folder>`: write the clean tool into a new or empty folder: the tracked files with no pack, no screens, no finished plans and a new lock file. It prints the next steps.
- `CANVAS_NO_PACK=1 npm run dev` (or `build`, `tokens`): run the tool as if `packs/` had no pack.

## Documents

- `AGENTS.md`: the instructions for an AI agent that works on this project, and in its section "Requests" the guide for the agent that applies the request files.
- `packs/<name>/AGENTS.md`: the instructions that are specific to the library of the pack, with the link to its library skill.
- `docs/canvas-tool-plan.md`: the goal, the decisions, the design, the open issues and the next steps.
