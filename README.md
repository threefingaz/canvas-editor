# Canvas Editor

A local tool that shows the screens of a React design system on a canvas. Each screen is a real code file in `screens/`. Each screen shows as a frame. Click an element in a frame to see its place in the code and its style values. Each value is linked to a token, equal to a token, or has no token.

Edit an element in the panel: change a token, a spacing or layout value, or the text. Move an element among its siblings on the canvas, or remove it. Each edit shows at once as a preview in the frame; the code does not change. Write a comment on the canvas for a change that has no control. Ask for options of a screen or of one part, and keep the one you choose; a state of a screen shows next to it. The tool saves the edits, the comments and these requests as request files, and an AI agent writes them into the code.

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
- **Move and zoom.** The wheel pans. Ctrl or Cmd with the wheel, or a pinch, zooms. Space and drag, or a drag with the middle button, pans too. A click on the zoom value sets 100%. The zoom buttons and 100% keep the selected element in the view. A double click on the title of a frame fits that frame. Keys: Shift with 1 fits all frames, Shift with 2 fits the frame of the selection, or the frame that the Changes tab shows, Shift with 0 sets 100%.
- **Select.** A click on a frame selects the element of the screen file there. The element gets a small bar on the canvas with its name and its actions: the two arrows of a move with its position ("2 of 3"), **Comment** (the key C), **Ask for options**, and **Remove** (Delete or Backspace). A button that is off says why. Escape cancels a drag first, then closes an open comment bubble or options panel; then it clears the selection. A click on a parent in the breadcrumb of the panel selects it.
- **The panel.** It has two tabs. **Design** shows the selected element: its name, its parents, its place in the code, and the controls for its values. **Changes** shows the changes and then the issues of one screen; its frame has a ring on the canvas. A click on an element in a frame opens Design; a click on the title of a frame, or on its count of issues, opens Changes for that screen. The title row of a frame shows only what fits its width on the screen: zoom in (or double click the title) to see its buttons. The header of the Changes tab has **Comment on the screen** and **Ask for options of the screen** too, at each zoom.
- **Edit.** The Design tab shows the controls for the selected element:
  - a step control or a select to change a color, shadow, text style, spacing or corner token (tokens only, no free numbers);
  - **Link** on a value that is equal to a token, and **Use nearest** on a value with no token;
  - a button that splits padding, margin or the corners into one value for each side;
  - direction, wrap, alignment and justification of a flex or grid container;
  - a Content field for the text.

  **Move** an element on the canvas, among its siblings in its parent. Drag the selected element to a new place: a press and a move of a few pixels starts the drag, a line shows the place of the drop, and the release moves the element (Escape cancels). Only the selected element drags, thus the first click selects it. Or use the two arrows on the bar, or the arrow keys: Left and Right in a row, Up and Down in a column; the keys work while the focus is on the canvas, not in the panel or the toolbar. One key press is one place. When the parent is not a flex or grid container, the frame cannot show the new sequence: the position on the bar has a mark, the edit is saved, and no drag starts. A parent has one move: a move of a second sibling replaces the move of the first, and no drag starts while a different sibling has an open move (the arrows still work).

  **Remove** on the bar, or the Delete or Backspace key, removes the element. If the place in the code draws more than one copy (a list), all copies change, and the panel says so. An element with an open edit has a small dot at its bottom left corner; the Changes tab lists its edits. The markers switch of the toolbar hides the dots with the markers.
- **Write a comment.** For a change that has no control ("make this a select", "add a state for an empty list"), write a task for the agent. Select the element and use **Comment** on its bar, or the key C; for the whole screen, use **Comment on the screen** in the title row of its frame or in the header of the Changes tab. A bubble opens next to the element; **Add**, or Ctrl or Cmd with Enter, adds the comment. A text that you have not added yet stays for its element when you click somewhere else. A comment has no preview: it is a numbered pin at the top right corner of its element, and the comments on the screen are a pin in the title row of the frame. A click on a pin opens its bubble: each comment with its text, the reply of the agent, a change of the text, and a discard. A pin with a mark has a reply. An element can have more than one comment; its pin shows how many. A comment whose element is gone (removed, or not found after a change of the file) is in the pin of the title row too. The Changes tab lists the comments, and a click on one opens its bubble; the count of changes includes them. A part that a component draws inside it (the helper line of a field) cannot be selected; write the comment on the component and name the part.
- **Link screens.** A screen links to a different screen with a plain address on a part of the library that takes one: `href="#/<screen id>"`, for example `<Button href="#/onboarding/workspace">`. Ask the agent to link the screens of a flow; the instructions give it the rules. A link to an id that no screen has shows in the Issues list.
- **States of a screen.** A screen file with `stateOf: '<screen id>'` in its `meta` is a state of that screen (an error, a wait, a result). The canvas shows a screen and its states next to each other as one group, and the index of the site shows the states below their screen.
- **Options.** Select an element and use **Ask for options** on its bar, or use **Ask for options of the screen** in the title row of a frame or in the header of the Changes tab: a small panel opens with a count, a note, and the button **Ask for options**; the agent writes each option as a screen file with `optionOf`. The title row of the screen says how many options are asked. The options show in a column below their screen. **Keep this option** in the title of an option asks the agent to write it into its screen and to remove the other options. The button is off, with the reason, while the screen has open edits on its elements or an open request for options; while a keep is open, the screen takes no edit on an element and no new request for options.
- **Click through a flow on the canvas.** Turn on the **Preview** switch in the toolbar. A click on a link moves the canvas to the frame of its screen. With Preview on, nothing is selected, the panel is closed, and the selection, the bar, the pins, the dots, the mark of the asked options and the markers are hidden; pan, zoom and the keys still work. Escape turns Preview off. Turn Preview off to edit again. The button **Open as a full page** in the title of a frame opens the screen in the site, as a stakeholder sees it.
- **Undo and redo.** The toolbar buttons, or Ctrl or Cmd with Z, and with Shift for redo.
- **See the changes and the issues.** The Changes tab shows the Changes list of the screen and then its Issues list (values with no token, local overrides, elements that are not from the library, links to a screen that does not exist, a relation in `meta` that breaks a rule, render errors). A click on an item selects its element and moves the canvas to it when it is out of the view; a change has a discard button. Elements that are not from the library have a marker on the canvas; a toolbar switch hides the markers.
- **Give the edits to the agent.** The tool saves the edits of each screen in `.canvas/requests/<screen id>.json` (for example `.canvas/requests/onboarding/welcome.json`), a short time after each edit, and the Issues list in `.canvas/issues/<screen id>.json`. Git ignores `.canvas/`. The button **Copy for the agent** in the toolbar shows the count of changes and copies the fixed sentence for the agent:

  ```text
  Apply the canvas requests in .canvas/requests/ as AGENTS.md says.
  ```

  The agent applies the edits to the code, does the comments, writes the asked options as screen files, writes a kept option into its screen, and removes each applied item from the file. The frames reload, and the applied previews go away. An item that the agent did not apply stays, with its reply in the Changes tab, and for a comment on its pin. The editor can stay open while the agent works.

  After a change of a screen file, an edit whose element the editor cannot find again is stale: the Changes tab shows a warning and no preview. Discard it and make it again. An error of a load or a save of a file shows as a warning in the toolbar; the edits stay in the editor, and the next change saves them again. A request file that the editor cannot read is never written over.
- **After a change of the library code in the pack** (`packs/<name>/library/`, for example the theme), the dev server writes `tokens.json` again, and the panel gets the new tokens. With no dev server, run `npm run tokens`.

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
