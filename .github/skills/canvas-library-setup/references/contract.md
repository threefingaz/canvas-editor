# The contract of a library skill

The design skills name no component and no token. At each place where they need one, they hand a question to the library skill. This file lists those questions. A library skill is complete when it answers each, or points to the place in the guidance of the library that does.

Name the skill `canvas-library-<name>`, with the `name` of `pack.json`, and put it into `packs/<name>/skills/canvas-library-<name>/SKILL.md`. Keep it short: a table is better than prose. Give it one section for each section of this list, in the same sequence, thus each agent finds an answer at the same place.

## 1. The guidance of the library

- Does the library have guidance of its own? Where is it in the pack (`packs/<name>/skills/`), from which source and version, and how is it updated? Link each copied skill or file with a relative link.
- Which part of it answers which question of this contract?
- Which of its rules do not hold in a screen file, and why?

## 2. The rules of the tool, for a screen

State them for this library, with its own names:

- the sequence of an edit: a prop that the component has, then the override that the library offers at the place of use. What is that override called in this library?
- what is not permitted in a screen: a wrapper component with styles, a change of the theme, global CSS, a class with CSS, inline `style`;
- each other way to write a style that the library has or had (a style prop on a component, such as a padding prop): if it works in the installed version. Try it: a prop that the version does not have writes nothing, with no error;
- from which package and paths a component is imported, thus it counts as "from the library". If a part comes from a second package (a helper, an icon set), say if a screen may import it and how it shows in the editor.

## 3. Tokens in code

For each group that the library has (color, spacing, radius, shadow, text style, stroke):

- how the token is written at the place of use, with one example;
- which steps of a scale are tokens;
- the breakpoints, how a value for a range of widths is written, and which range holds at each width of `widths` in `canvas.config.ts` (the widths of the frames);
- which properties the library does not map to a scale, and how to write a value of the scale there;
- how a text takes a color that is not one of the text colors (a status color, the main color);
- how the thinnest border is written, and if it is a token;
- how a drawing element (`svg`) takes a color of the palette;
- which forms of code give a value that the editor shows as linked, and which give only "equal to a token" (a form that writes fixed values and no variable or class).

The source is the record at the top of `packs/<name>/library/tokens.ts`.

## 4. Which component carries a decision

One row for each. If the library has no component, say what to build (section 7).

- groups by distance; a page width; columns
- a main action, and weaker actions
- a field with a label that stays visible; a select with a label
- the lines at a field: how many it has for a reason and for an error, and which form the two take when the library has one line
- a form and its send button in a screen with no handlers, thus a press does not reload the frame
- an option with its text as one press area; a group of options with its name
- a message at its thing; a notice
- a status, a label or a filter that is not a button; the status colors
- headings: the text style and the level of the document
- a table, a row header, and a sub heading row inside the table
- the main menu, tabs, a link
- a button, a link and a list row that go to a different screen: which components take an address (`href="#/<screen id>"`, see "Screen files" in the root `AGENTS.md`), and what they render. The editor and the site follow only an `a` element with that address: a component that renders a different element with the address is not a link. Try each one in the editor with the Preview switch on
- a list; a divider between rows
- text only for a screen reader
- a chart: the plain parts for bars, and for a line

## 5. Defaults to keep

Where the look of a component differs from a rule of the look in the design skills, the default stays. List the known ones, thus an agent does not fight them:

- the place of a field label
- the lines and the alignment of a table
- the look of a current item in navigation
- the look of a disabled control
- the sizes of a control: which is the standard one, which are permitted and where

## 6. Rules of the library that win over an override

Each library has places where a rule of a component is stronger than the override at the place of use: a margin set by a parent, a fixed padding of a slot, a value that a rule for a range of widths sets, a part inside a component that the screen does not write (the label of a field). List each one that is found, with what to do in its place. An edit from the canvas fails at exactly these places.

## 7. What the library lacks

For each: what to build from the simplest parts, and that the agent tells the user.

- icons
- a chart
- alignment of numbers by the decimal point
- an undo line; a bar for a value
- a scale for widths

## 8. A canvas request

How an edit of each kind (a token, a layout keyword, a text style, a text, a sequence, a removal) is written with this library. The generic rules are in the section "Requests" of the root `AGENTS.md`; the forms of the library are in the section "Requests" of `packs/<name>/AGENTS.md`. The library skill points there and adds what is special.

A comment needs nothing special in the pack: the agent does it as a change of a screen, and the rows of section 4 give the components for that change.

The kinds `options` and `keep` need nothing special in the pack either, as a comment: the agent writes an option as a screen file, and a kept option as a change of its base screen.

The section "Requests" of `packs/<name>/AGENTS.md` must answer these cases, each with one example of the code before and after. An agent that applies a request guesses at exactly these places:

- **A value that the code already has**: the form for each token group, with a prop and with the override.
- **A value that comes from a default of a component**, with no code in the screen (the fill of a main button, the alignment of a group): which prop sets it, what else that prop changes, and the override when no prop exists.
- **One side of a shorthand**, for a shorthand of four sides and of two sides: how the code is split. The same for one of the two gaps of a group, and for one corner of a radius: the key of one corner can take a different form of value than the key of all corners.
- **A value for a range of widths**: how the `media` condition of an edit maps to the form of the code, with the breakpoints; which part of the code is active at each frame width; and what to write when a rule of a component gave the value for the range, with no code in the screen.
- **A text style**: on the text component, and on a component that is not the text component; what keeps the level of the document.
- **A place that draws copies** (a `map`): where the one change goes.
- **The places of section 6**, where the override does not apply: what the agent writes there, or that it replies `needs-library-change`.
- **A part inside a component**, which the screen does not write (the label and the help line of a field, the icon of a notice): an edit is about the first DOM node of the element only. Say what the agent replies when the `before` of an edit does not agree with that node.
- **A text that is a prop**, not a child (the label of a field, of a status): which props hold a text.
- **An override that is not a literal** (a variable, a function, a list): if the agent can change it, or replies `unclear`.

## How to fill it

- Answer from what you **saw**: a rendered component, a computed style, an applied edit. Mark an answer that you only read in the documentation.
- Say at the top of the skill, and of the section "Requests" of `packs/<name>/AGENTS.md`, how the answers were found, and mark each answer that was not seen in the editor. Three levels are enough: seen in the editor (no mark); the CSS was read; from memory or from the documentation. An agent that later sees a marked answer in the editor corrects the row and removes the mark.
- With no browser, do not answer from memory when you can run the library: render the component to a text in Node, with the theme of the pack, and read the CSS that the library wrote. That shows the variable of a token, the selector of a rule that wins over the override, and a prop that writes nothing. It does not show what the editor links, and no applied edit: these stay "not known yet".
- A question with no answer stays in the skill as "not known yet", with what would settle it. An empty row is found; a guess is not.
- When an agent later meets a case that the skill does not cover, it adds a row. The skill grows from use.
- Try the request cases of section 8 before you write them: make the edit in the editor, apply it, and look at the frame after the reload. The proof (step 7 of `SKILL.md`) has one edit of each token group; add an edit on a value that comes from a default and one on one side of a shorthand. With no browser, write the cases from the CSS that you read, mark them, and name in section 8 of the skill the edits that settle them.
