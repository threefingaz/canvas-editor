# Canvas Editor

A local tool that shows the screens of a React design system on a canvas. Each screen is a real code file in `screens/` of the project. Each screen shows as a frame. Click an element in a frame to see its place in the code and its style values. Each value is linked to a token, equal to a token, or has no token.

Edit an element in the panel: change a token, a spacing or layout value, or the text. Move an element among its siblings on the canvas, or remove it. Each edit shows at once as a preview in the frame; the code does not change. Write a comment on the canvas for a change that has no control. Ask for options of a screen or of one part, and keep the one you choose; a state of a screen shows next to it. The tool saves the edits, the comments and these requests as request files, and an AI agent writes them into the code.

The canvas shows the whole project: one row for each flow with its name, a screen with its states as a group, and an arrow for each link between two screens. The Project tab lists each flow, screen and state with its deviations from the design system, its open changes and its links. `canvas check` checks the screen files against the library with no browser.

Screens can link to other screens. `canvas build` writes the screens as a prototype site: plain static files that stakeholders open and click through.

The tool runs on the local machine only. It needs no remote server and no cloud service. It is installed into an ongoing project, or used as a project of its own, and it works with each coding agent that reads `AGENTS.md`.

All that is specific to the component library is in one folder, its pack: `packs/<name>/`. The tool finds the pack by itself. With no pack, the tool still builds and starts, and the editor says that no library is connected; `canvas init` writes the pack. A second pack next to the first stops the tool with a message.

## The tool and the project

The tool and the project are two folders. The tool is the code: `src/`, `tools/`, `bin/`, the guide in `guide/`, and the HTML entries. The project is your content: `canvas.config.ts`, `screens/`, the pack in `packs/<name>/`, `tokens.json`, the work folder `.canvas/`, the built site `dist/`, and `AGENTS.md` with `guide/` for the agent. The command of the tool, `canvas <command>`, finds the project by itself (the nearest folder upward with `canvas.config.ts` or `canvas/canvas.config.ts`), or takes `--project <folder>`. `canvas help` (`node bin/canvas.js help` in the tool repository) lists the commands.

There are two starts. Each needs Node 22.12 or later.

- **In an ongoing project** (the host): the tool is a development dependency of the host, and the project is the folder `canvas/` of the host. The library is the one that the host has installed already.
- **As a project of its own** (standalone): a clone of the tool is the tool and the project at once, as in earlier versions. The pack installs the library.

## Start in an ongoing project

The host is a React project that has its design system installed: an npm package, or a folder of its own code. In the folder of the host:

```sh
npm install -D <the tool>
npx canvas init
npx canvas dev
```

- `<the tool>` is a Git address with a tag (`git+<address of the tool repository>#<tag>`), or a file that `npm pack` wrote in a clone of the tool (`../canvas-editor-0.0.0.tgz`). The tool has no install script; npm installs only the packages that the tool runs.
- `npx canvas init` finds the library: the one dependency of the host with React as a peer dependency. With more than one, it lists them and stops; then name one with `--library <package>`. A design system that is a folder of the host is `--library ./src/<folder>`. It writes `canvas/`: `canvas.config.ts`, `tsconfig.json`, `.gitignore` (for `.canvas/` and `dist/`), the pack of the library at level 1, an empty `tokens.json`, and a copy of `AGENTS.md` and `guide/`. At the root of the host it writes the stubs of the skills (`.agents/skills/`, and `.github/skills/` and `.claude/skills/` when their parent folder exists) and a marked block of two lines in `AGENTS.md` (made when it is not there), `CLAUDE.md` and `.github/copilot-instructions.md` (when they exist). The block sends an agent to `canvas/AGENTS.md`. The command prints each file that it wrote. A second run changes nothing. It never runs `npm install`.
- In a repository with workspaces (a root with `.git` and `package.json`, and packages such as `apps/web`), run `npx canvas init` in the package that lists the library. The project goes into `canvas/` of the repository root, and the stubs and the block go to the root, where the agent works: each later `npx canvas <command>` finds the project from the root and from each package. The library must be installed where `canvas/` can import it, in `node_modules` of the root (npm puts the packages of workspaces there). When the library is installed only in `node_modules` of the package, name a project in the package: `npx canvas init --project canvas` in that package; then run the commands of the tool in `<package>/canvas`.
- `npx canvas dev` starts the editor at http://localhost:5173/. Open it in Chrome or Edge, in a window that is 1024px wide or more.

**The first ten minutes.** In the proof (a host with React 19 and MUI 9, a warm npm cache), the three commands took 12.5 s from the first command to an open editor: the install took 5 s, `init` less than 1 s. The editor then says "The tokens are not set up": the library is connected (level 1), and the screens render with it. You can now:

1. Ask the agent for a first screen, in plain words ("draw a sign-in screen"). The agent reads `canvas/AGENTS.md` through the block, and writes `canvas/screens/<flow>/<name>.tsx`. The screen comes into the canvas with no reload. In the proof a fresh agent wrote its first screen in about 1.5 min, with no finding of the check.
2. Give the agent the sentence of level 2, while you work: `Set up the tokens of the library as the skill canvas-library-setup says.` The agent completes the provider from the entry of the host application, writes the token entry with a helper of the tool, and writes the library skill. In the proof it took 5 to 8 min, with no question to the user.
3. Edit, comment and ask on the canvas (see "Use" below), then give the agent `Apply the canvas requests as canvas/AGENTS.md says.`, or use the button of the toolbar.

Notes for a host:

- The command runs as `npx canvas <command>` in the folder of the host or of `canvas/`. Each path in the guide, in a request file and in the output of `canvas check` is relative to `canvas/`.
- `canvas build` runs the type check with `canvas/tsconfig.json`. When the host has no types of React (`@types/react`), the type check fails; the build then writes no site.
- The lint and the type check of the host can read `canvas/` too. Leave the folder out in their config when their rules do not fit.
- The frames and the site run on the React of the host (also React 18), and the editor on the React of the tool: the dev server is two servers on one origin.
- After an update of the tool, run `npx canvas sync`: it copies `AGENTS.md` and `guide/` into `canvas/` again, and writes the stubs and the block again. `npx canvas status` names the version of the tool that wrote the copy.

**The other way: a clone next to the host.** When an install from a Git address is not permitted, or the host uses a different package manager, clone the tool into a folder next to the host and run `npm install` there. The host then does not change, not one line. In the folder of the host, the commands are the same, with the path of the clone:

```sh
node ../canvas-editor/bin/canvas.js init
node ../canvas-editor/bin/canvas.js dev
```

The copy of `AGENTS.md` in `canvas/` writes the line of the command for the agent. An update of the tool is `git pull` and `npm install` in the clone, then `sync`.

## Start as a project of its own

```sh
git clone <address of the tool repository> my-screens
cd my-screens
npm install
npm run init -- --library <package>@<range>
npm install
npm run dev
```

Here each command of the tool is an npm script: `canvas <command>` is `npm run <command>`, with `--` before its arguments and options. `npm run init -- --library <package>@<range>` writes the pack of the library at level 1 with its `package.json` (with no range, `latest`), and the second `npm install` installs the library. The editor is at http://localhost:5173/.

With no pack, the editor shows the sentence for the agent. Give it to the agent in place of the two commands in the middle, and it runs them:

```text
Connect a library as the skill canvas-library-setup says.
```

The running dev server restarts by itself and the editor reloads with the library; if the editor still says that no library is connected, stop the dev server and run `npm run dev` again. The first ten minutes are then as in a host: a first screen, the sentence of level 2, and the edits. The fixed sentence for the requests is `Apply the canvas requests as AGENTS.md says.` In the proof a fresh agent connected MUI 9 and wrote two screens in about 2 min.

## A library in two levels

1. **Connected** (one command, seconds): `canvas init` writes the pack with a plain provider (with the stylesheet of the package when it has one) and an empty token entry. The screens render with the library, and each action of the canvas works: ask the agent for a screen at once. The editor says "The tokens are not set up": the panel has no token controls, and no value counts as a deviation; `canvas check` finds a plain element, a `style` and a raw value as before.
2. **Ready** (the agent, while you work): give the agent the sentence that the editor shows, `Set up the tokens of the library as the skill canvas-library-setup says.` It completes the provider, writes the token entry with a helper of the tool (`tokensFromObject` for a theme object, `tokensFromCss` for a stylesheet with variables), fills `scaleKeys`, and writes the library skill. It asks no question when the answer is in the project. The banner goes away with no reload.

`canvas status` says where the setup is: the library and its level, the tokens of each group, the library skill, the screens, the findings of the check, the way of "Send to the agent", and the next step.

## Use

- **Add a screen.** Put a file in `screens/<flow>/<name>.tsx` with a default export (the screen) and `export const meta = { title: 'Welcome', width: 1440 }`. `meta` is an object literal with a text `title` and a `width` from `widths` in `canvas.config.ts` (1440, 1024 or 390). One flow is one row on the canvas. A file that breaks a rule shows as a frame with the error.
- **Move, rename and delete a screen.** The menu at the end of the title row of a frame (the three dots) has **Rename…**, **Change the title…**, **Move to flow…**, **Move left**, **Move right** and **Delete…**. A state and an option keep the place and the flow of their screen, thus they have no move in the row. The tool does each at once in the files: a move in the row writes `screens/<flow>/flow.json`; a rename and a move to a flow take the states and the options with the screen, and change each link to them, their open changes and the flow files; a dialog shows the new id and refuses one that exists. **Delete…** first names what goes with the screen and the screens that link to it, then moves the files into `.canvas/trash/`; the group **Deleted screens** of the Project tab has **Restore** for each. A link to a deleted screen shows as a broken link: the quick request **Fix the deviations**, or a comment, asks the agent what the control does now. An action is off while a change of the screen is not saved yet. The menu is not there with Preview on.
- **Move and zoom.** The wheel pans. Ctrl or Cmd with the wheel, or a pinch, zooms. Space and drag, or a drag with the middle button, pans too. A click on the zoom value sets 100%. The zoom buttons and 100% keep the selected element in the view. A double click on the title of a frame fits that frame. Keys: Shift with 1 fits all frames, Shift with 2 fits the frame of the selection, or the frame that the Changes tab shows, Shift with 0 sets 100%.
- **Select.** A click on a frame selects the element of the screen file there. The element gets a small bar on the canvas with its name and its actions: the two arrows of a move with its position ("2 of 3"), **Comment** (the key C), **Ask for options**, and **Remove** (Delete or Backspace). A button that is off says why. Escape cancels a drag first, then closes an open comment bubble or options panel; then it clears the selection. A click on a parent in the breadcrumb of the panel selects it.
- **The panel.** It has three tabs. **Design** shows the selected element: its name, its parents, its place in the code, and the controls for its values. **Changes** shows the changes and then the issues of one screen; its frame has a ring on the canvas. **Project** shows the whole project (see "Review the project" below). A click on an element in a frame opens Design; a click on the title of a frame, or on its count of issues, opens Changes for that screen. The title row of a frame shows only what fits its width on the screen: zoom in (or double click the title) to see its buttons. The header of the Changes tab has **Comment on the screen** and **Ask for options of the screen** too, at each zoom.
- **Edit.** The Design tab shows the controls for the selected element:
  - a step control or a select to change a color, shadow, text style, spacing or corner token (tokens only, no free numbers);
  - **Link** on a value that is equal to a token, and **Use nearest** on a value with no token;
  - a button that splits padding, margin or the corners into one value for each side;
  - direction, wrap, alignment and justification of a flex or grid container;
  - a Content field for the text.

  **Move** an element on the canvas, among its siblings in its parent. Drag the selected element to a new place: a press and a move of a few pixels starts the drag, a line shows the place of the drop, and the release moves the element (Escape cancels). Only the selected element drags, thus the first click selects it. Or use the two arrows on the bar, or the arrow keys: Left and Right in a row, Up and Down in a column; the keys work while the focus is on the canvas, not in the panel or the toolbar. One key press is one place. When the parent is not a flex or grid container, the frame cannot show the new sequence: the position on the bar has a mark, the edit is saved, and no drag starts. A parent has one move: a move of a second sibling replaces the move of the first, and no drag starts while a different sibling has an open move (the arrows still work).

  **Remove** on the bar, or the Delete or Backspace key, removes the element. If the place in the code draws more than one copy (a list), all copies change, and the panel says so. An element with an open edit has a small dot at its bottom left corner; the Changes tab lists its edits. The markers switch of the toolbar hides the dots with the markers.
- **Ask with one click.** The bubble of a comment has **Quick requests** above its text field: fixed tasks for the agent that need no typing. On an element: Duplicate, Stand out more, Stand out less, Shorten the text, Use a better part, Make it a list of choices, Use tokens, Draw the next state, Draw its error state, Simplify, and **Link to a screen…** with the list of the screens; an element that is not from the library has Rebuild with the library. On the screen: Draw the missing states, Add the empty state, Add the loading state, Add the error state, Draw the next screen, Mobile width (390 px), Draw at a different width, Update the states, Fix the deviations, Check the design, Simplify, Link the flow. A click adds the request at once, as a comment with a fixed text; it shows as a pin and in the Changes tab, and you can discard it. A request that is already there shows as done.
- **Write a comment.** For a change that has no control and no quick request ("make this a select", "add a state for an empty list"), write a task for the agent. Select the element and use **Comment** on its bar, or the key C; for the whole screen, use **Comment on the screen** in the title row of its frame or in the header of the Changes tab. A bubble opens next to the element; **Add**, or Ctrl or Cmd with Enter, adds the comment. A text that you have not added yet stays for its element when you click somewhere else. A comment has no preview: it is a numbered pin at the top right corner of its element, and the comments on the screen are a pin in the title row of the frame. A click on a pin opens its bubble: each comment with its text, the reply of the agent, a change of the text, and a discard. A pin with a mark has a reply. An element can have more than one comment; its pin shows how many. A comment whose element is gone (removed, or not found after a change of the file) is in the pin of the title row too. The Changes tab lists the comments, and a click on one opens its bubble; the count of changes includes them. A part that a component draws inside it (the helper line of a field) cannot be selected; write the comment on the component and name the part.
- **Link screens.** A screen links to a different screen with a plain address on a part of the library that takes one: `href="#/<screen id>"`, for example `<Button href="#/onboarding/workspace">`. Ask the agent to link the screens of a flow; the instructions give it the rules. A link to an id that no screen has shows in the Issues list.
- **States of a screen.** A screen file with `stateOf: '<screen id>'` in its `meta` is a state of that screen (an error, a wait, a result). The canvas shows a screen and its states next to each other as one group, and the index of the site shows the states below their screen.
- **Options.** Select an element and use **Ask for options** on its bar, or use **Ask for options of the screen** in the title row of a frame or in the header of the Changes tab: a small panel opens with a count, a note, and the button **Ask for options**; the agent writes each option as a screen file with `optionOf`. The title row of the screen says how many options are asked. The options show in a column below their screen. An option of one element shows as that block only, cropped to its size; the button **Show the whole screen** in its title row shows the whole option, and **Show the block only** crops it again. **Keep this option** in the title of an option asks the agent to write it into its screen and to remove the other options. The button is off, with the reason, while the screen has open edits on its elements or an open request for options; while a keep is open, the screen takes no edit on an element and no new request for options.
- **Review the project.** The canvas names each flow at the left of its row and draws an arrow for each link between two screens: a dot on the control that has the link, and an arc above the frames to the screen that it opens; a link of a state that its screen has too is not drawn again. Click the title of a frame, or a row of the Project tab, to see the links of that screen: the arrows that leave it are strong and solid, the arrows that reach it are dashed, and the others are weak. The switch **Show links between screens** in the toolbar hides the arrows. The **Project** tab has one line for the whole project ("15 screens in 3 flows · 15 deviations in 1 screen · 12 changes") and then each flow with its screens, the states below their screen: the width, the count of deviations, the count of open changes, and a note when no link leads to a screen or a link is broken. A click on a row shows that screen: its frame fits the canvas, and the Changes tab lists it.
- **Click through a flow on the canvas.** Turn on the **Preview** switch in the toolbar. A click on a link moves the canvas to the frame of its screen. With Preview on, nothing is selected, the panel is closed, and the selection, the bar, the pins, the dots, the mark of the asked options and the markers are hidden; pan, zoom and the keys still work. Escape turns Preview off. Turn Preview off to edit again. The button **Open as a full page** in the title of a frame opens the screen in the site, as a stakeholder sees it.
- **Undo and redo.** The toolbar buttons, or Ctrl or Cmd with Z, and with Shift for redo.
- **See the changes and the issues.** The Changes tab shows the Changes list of the screen and then its Issues list: the deviations of the screen from the design system (values with no token that the screen file sets, local overrides, elements that are not from the library, links to a screen that does not exist, a relation in `meta` that breaks a rule, render errors). The count in the title of a frame is the count of these deviations. A library element with such a value has a marker on the canvas that names it (`gap 16px`). When the content of a screen is wider than the screen, the list says so under **Layout**, with the element that goes over the edge. Values with no token that a component of the library sets by itself are not deviations: they are in a closed group, **Defaults of the library**, at the end of the list. A click on an item selects its element and moves the canvas to it when it is out of the view; a change has a discard button. Elements that are not from the library have a marker on the canvas; a toolbar switch hides the markers.
- **Give the edits to the agent.** The tool saves the edits of each screen in `.canvas/requests/<screen id>.json` (for example `.canvas/requests/onboarding/welcome.json`), a short time after each edit, and the Issues list in `.canvas/issues/<screen id>.json`. Git ignores `.canvas/`. The toolbar gives the fixed sentence for the agent in one of two ways, which `agent` in `canvas.config.ts` sets:

  - **The clipboard**, the base, which works with each agent: the toolbar has one button, **Copy for the agent**, with the count of changes. A click copies the sentence and says "Copied: paste it in the chat of the agent".
  - **A command**: the button **Send to the agent** with the count of changes opens the chat of the agent with the sentence, with no typing. The dev server starts the command on your machine with the sentence as the last argument. When no command starts, the button copies the sentence and says so: paste it into the chat. The small button next to it, **Copy for the agent**, only copies the sentence.

  The values of `agent`: `'auto'` (the value that `canvas init` writes, and the default of a project with no `agent`) takes the preset `vscode` when the dev server runs in a terminal of VS Code, else the clipboard; `'clipboard'` always copies; `'vscode'` is the preset of the command line of VS Code, `code chat --mode agent --reuse-window`, which opens the chat of its agent. When `code` is not on the path, the preset looks for it in the VS Code that owns the terminal of the dev server and in the usual folders of VS Code; if VS Code is in a different folder, write `{ command, args }` with the full path of its `code` command. `{ command, args }` is a command of your own, for an agent with a command that opens its chat with a prompt; `null`, the form of an older config, is the clipboard. The repository itself has `{ command: 'code', args: [...] }`, the preset `vscode` written out. `canvas status` names the way. The sentence:

  ```text
  Apply the canvas requests as AGENTS.md says.
  ```

  In a host the sentence names `canvas/AGENTS.md`. The agent finds the rest by itself: the sentence names `AGENTS.md`, the guide of the project, which says where the request files are and names each skill in `guide/skills/` with its path and says when to read it. The skill `canvas-apply` has the fixed sentence in its description, also the older form `Apply the canvas requests in .canvas/requests/ as AGENTS.md says.`, `canvas-screen` is the entry for a new screen or flow, and `canvas-check` runs the check of the screens and fixes what it finds. Ask in plain words ("create the screens for …", "check the screens"). An agent that loads skills by their description finds them through the short stubs in `.agents/skills/`, `.github/skills/` and `.claude/skills/`: each stub has the name and the description of its skill and sends the agent to the skill in `guide/skills/`. After a change of the head of a skill, run `npm run agents`, which writes the stubs again.

  The agent applies the edits to the code, does the comments, writes the asked options as screen files, writes a kept option into its screen, and removes each applied item from the file. The frames reload, and the applied previews go away. An item that the agent did not apply stays, with its reply in the Changes tab, and for a comment on its pin. The editor can stay open while the agent works.

  After a change of a screen file, an edit whose element the editor cannot find again is stale: the Changes tab shows a warning and no preview. Discard it and make it again. An error of a load or a save of a file shows as a warning in the toolbar; the edits stay in the editor, and the next change saves them again. A request file that the editor cannot read is never written over.
- **After a change of the library code in the pack** (`packs/<name>/library/`, for example the theme), the dev server writes `tokens.json` again, and the panel gets the new tokens. With no dev server, run `canvas tokens`.

## The prototype site

The site has an index of the screens by flow, and each screen as a full page at `#/<screen id>`, at the width of the browser window. A link in a screen opens the screen of its address; Back returns. The site has no editor and no canvas: it is for view only.

```sh
canvas build
canvas preview
```

`canvas build` (`npx canvas build` in a host, `npm run build` in the tool repository) writes the site into `dist/` of the project. `canvas preview` serves it at http://localhost:4173/. In the dev server the site is at http://localhost:5173/site.html.

To share the site, copy the content of `dist/` to a static host. It needs no server rules: each address in it is relative, thus the folder works at each address, also in a sub folder (`https://example.com/team/prototypes/onboarding/`). Open the address of the folder with a `/` at the end, as a static host gives it.

The site needs a host, or `npm run preview`: a browser does not run its scripts from a file that is opened with a double click.

## From an older version

A clone of an older version of the tool, with a pack and screens of its own, needs no other step:

```sh
git pull
npm install
```

- Your files stay as they are: the pack in `packs/`, the screens, the open request files in `.canvas/requests/`, and your value of `agent` in `canvas.config.ts` (a full path of `code`, for example). The line of `agent` in the repository does not change, thus the pull has no conflict there. The form `{ command, args }` stays valid.
- If Git refuses the pull because `npm install` changed `package-lock.json`, run `git checkout package-lock.json`, and pull again.
- The pack stays valid: `"package"` in `pack.json` is a list of one source (the new form is `"sources": ["<npm package>"]`). An older token entry imports its types from `../../../src/tokens/format.ts`, which is still there; the new form is `canvas-editor/tokens`.
- The skills are now in `guide/skills/`, and the prompt files in `.github/prompts/` are gone. An agent finds the skills through the short stubs in `.agents/skills/`, `.github/skills/` and `.claude/skills/`, and through the table of `AGENTS.md`. The fixed sentence is now `Apply the canvas requests as AGENTS.md says.`; the older sentence still works.

## Move a project into a host

A project of its own (a clone of the tool with a pack and screens) moves into an ongoing project, the host, that has the library as its dependency:

1. In the host: `npm install -D <the tool>`, then `npx canvas init`. It writes the project into `canvas/`, with a pack of level 1 for the library that it finds, and the stubs and the block of `AGENTS.md` at the host root.
2. Delete the pack that `init` wrote, `canvas/packs/<name>/` (two packs stop the tool). Copy `screens/` and `packs/<name>/` of your project into `canvas/`. To keep the open changes and the deleted screens, copy `.canvas/requests/` and `.canvas/trash/` into `canvas/.canvas/` too.
3. Delete `canvas/packs/<name>/package.json`: in a host, the host installs the library, and the library with its peers must be dependencies of the host. The tests of the pack (`*.test.ts`) do not run in a host; you can delete them. An older token entry that imports `../../../src/tokens/format.ts` imports `canvas-editor/tokens` in place of it.
4. `npx canvas tokens` writes `canvas/tokens.json` from the token entry of the pack (`init` wrote an empty file). `npx canvas status` then says that the level is `ready`.
5. `init` writes `agent: 'auto'` in `canvas/canvas.config.ts`. Write your own value there if you need it.
6. `npx canvas check`, `npx canvas build` and `npx canvas dev`: the same screens, findings and tokens as before.

## Commands

The commands of the tool are `canvas <command>`: `npx canvas <command>` in a host, `node <clone>/bin/canvas.js <command>` with a clone next to the host, and `npm run <command>` (with `--` before the options) in the tool repository. Each takes `--project <folder>`, except `export`.

- `canvas dev`: start the dev server with the editor (and the site at `/site.html`). Use this to work. `--port 5180` takes a different port, and fails when that port is in use.
- `canvas tokens`: write `tokens.json` from the token entry of the library pack.
- `canvas status`: the state of the project and the next step of the setup.
- `canvas init`: connect a library (level 1). In a host it writes `canvas/` (see "Start in an ongoing project"). In the tool repository it needs `--library <package>[@<range>]` (with no range, `latest`) and writes the pack with its `package.json`; then run `npm install`.
- `canvas sync`: in a host, copy the guide into `canvas/` again, and write the stubs and the block again, after an update of the tool.
- `canvas check`: check the screen files against the library, with no browser and no editor. It finds an element that is not from the library, an inline `style`, a `className`, a raw value (`'13px'`, `'#667085'`), a number that stands for pixels (`fontSize: 14`, where the pack of the library names the keys of its scales in `"scaleKeys"` of its `pack.json`), a handler or a hook, a placeholder text, a link to a screen that does not exist, a file that is not a valid screen and a broken relation, prints each with its file and line, and exits with 1 when it finds one. `canvas check onboarding/welcome` (`npm run check -- onboarding/welcome`) checks one screen. Run it before a review; the agent runs it after its work.
- `canvas build`: type check, and write the prototype site into `dist/` of the project. The build has no editor: the element-to-code step and the file API run on the dev server only.
- `canvas preview`: serve the built site at http://localhost:4173/ (`--port <number>` for a different port).
- `canvas agents`: write the stubs of the skills into `.agents/skills/`, `.github/skills/` and `.claude/skills/` (in a host, at the root of the host), after a change of the head of a skill in `guide/skills/`.

Only in the tool repository:

- `npm test`: run the unit tests once.
- `npm run test:watch`: run the unit tests on each change.
- `npm run lint`: check the code.
- `npm run export -- <folder>`: write the clean tool into a new or empty folder: the tracked files with no pack, no screens, no plans (`docs/plans/`) and a new lock file. It prints the next steps.
- `CANVAS_NO_PACK=1 npm run dev` (or `build`, `tokens`): run the tool as if `packs/` had no pack.

## Documents

- `AGENTS.md`: the short entry for an AI agent that works on this project: the folders, and the file to read for each job. In a host, `canvas init` copies it with `guide/` into `canvas/`.
- `guide/`: the guide for the agent: `screen-files.md` (the rules of a screen file), `requests.md` (the guide for the agent that applies the request files), and the skills in `guide/skills/`.
- `docs/development.md`: the stack, the layout, the conventions and the current state, for a developer of the tool.
- `packs/<name>/AGENTS.md`: the instructions that are specific to the library of the pack, with the link to its library skill.
- `docs/canvas-tool-plan.md`: the goal, the decisions, the design, the open issues and the next steps.
