---
name: canvas-screen-design
description: What to put on a screen and what to leave out, when you create or change a screen in `screens/`. Read this skill each time you write a new screen or a flow of screens, add an element, a field, a step, a list, a button, a message or a state to a screen, or when the user asks to make a screen simpler or more convenient. It gives the design decisions (the task, the steps, the fields, the messages, the placement) and holds for each design system; the library skill and `guide/screen-files.md` give the components and how to write them in code.
---

# Screen design

You write a screen as code, but a person will use what the screen shows. This skill is about the decisions before the code: which screens a flow has, which elements a screen has, what a field asks, what a message says. It names no component and no token: it holds for each design system. Which component carries a decision is the subject of the library skill.

An interface is the rules of the game and their physical form. The rules are the scenario: what the person does and what they get back. The form is the buttons, the fields and the texts. Both are your work. A clean layout on a clumsy scenario is a bad screen.

## 1. Before you write

Write down these three things, each in one or two lines, and give them to the user at the start of your reply.

1. **The task**, in the words of the person, with real values: "find episode 138 of 169", not "browse the episodes".
2. **The situation**: where the person is, what is in their hands, what they did just before, what they do next; how often they do this task (one time, or many times each day), and how many things they handle at once. The `width` of the screen tells a part of it: a narrow screen is a phone in one hand, with a thumb.
3. **The scenario**: each action and each response, as a list. One screen of a flow is one step of this list.

This skill is a base that holds for each product; it does not know this one. Take the task and the situation from the request, then from what the project says about its product (its documents, a page of the application near this screen; `canvas-screen`, "What the project knows"), and assume only what they do not say. State each thing that you assumed.

## 2. Remove before you draw

Each screen, step, field and button is a cost: the person must notice it, understand it, aim and hit, and at each of these some people stop. For each one, ask in this sequence:

1. **Can the result come with no action?** A default, the last choice, a value that the system knows, an automatic step.
2. **If not, can this step join a step that the person takes anyway?**
3. **If not, how does it become clear and cheap?** Only this question is about the look.

Remove what fails the first two questions. Do not add an element because screens of this type usually have it: when you think "how else?", stop and name the other options.

One limit: do not remove what the person wants to know or to decide (a price, a consent, a result that cannot be undone). If a simpler screen hides such a thing, tell the user.

## 3. The floor

These rules hold for each screen. A simple screen needs only them.

**The scenario**

- No step, screen or field that the task does not need.
- No question that the system can answer, and no question twice. What an earlier screen collected, a later screen shows as filled.
- Each screen can be understood alone: it names its subject (which order, which amount, which person). No "this", "current" or "selected" in the place of a name.
- No words of the system: no state names, codes, modes or ids in the place of content.

**Actions**

- No "Are you sure?". An action happens at once, and a line with "Undo" names what was done.
- Each action has a visible answer at its place. No dialog to say that a normal action worked.
- At most one filled button on a screen, in the usual place. The other actions are weaker.
- A dangerous action is away from the frequent ones and not larger than them.
- Nothing changes, closes or shows by itself: no timers, no controls that show only on hover, no content that moves under the pointer.
- No window that blocks the work: no welcome, no tour, no news over the product. No popup for content: find it a place on the screen.

**Fields and messages**

- Each field has a label that stays visible (a lone search field is the one exception). No placeholder as the only label. A line at a field can say why we ask; it does not tell a format. No asterisks: each field is necessary, and the rare optional one says so.
- An error state keeps the input, sits at its field, and says the cause and the fix. Name a cause only if the system can know it.
- A button that acts has a verb ("Send"); a link or a tab that opens a place has the name of the place ("Orders"). No "Click", "Enter", "Select" or "Please" in a label.

**Lists**

- No pager with page numbers: content scrolls, and portions are cut by meaning (dates, letters), not by a count. Items show in the terms that the person searches by: names, dates, numbers of their own.
- No items hidden in "More" to make a menu short. Organise in groups.

**The look**

- The distance inside a thing is smaller than the distance between things. Groups are made by gaps first.
- Red only for a problem, green only for success. Color is never the only sign of a state, and each text has enough contrast to be read.
- Each component of the design system for its purpose, in its standard form and size. A status or a badge does not look like a button.

**Access**

- Each control has a name in words; a button with only an icon or a color has one in the code.
- Headings, lists, navigation and buttons are marked in the code as what they are.
- All works with the keyboard, and with one thumb on a narrow screen. Nothing depends on a sound.

**The content**

- Real and a little awkward content: a long name, item 138 of 169, an empty result. No placeholder text. Use the real count of items that the task gives. Where a picture is content and there is no picture file, draw a plain block of the correct proportions with a remark of the author that says what the picture shows ("Not drawn: a photo of the apron, front view"; see section 5).

## 4. The design system has the last word on the look

This skill says what a screen needs. The design system says what it looks like. For each decision, find the component of the design system that is made for that purpose, and use it as it is.

1. **The design system has a component for the purpose → use it, in its standard form.** Its look wins over a description of a look in this skill.
2. **A default of the design system differs from a rule of the look in this skill** (the place of a field label, the lines of a table, the shape of a button) **→ keep the default.** A design system is a decision, and to agree with it is worth more than one rule. Do not override a component to follow this skill.
3. **The design system has no way to do what a rule of behavior or content needs** (an undo line, a status that is not a button, a message at its field) **→ build it from the simplest parts of the design system, and tell the user** that the design system lacks it. For a control of your own, read [Controls](./references/controls.md) first.

Rules of the look yield to the design system. Rules of behavior and content do not yield to a component: "no confirmation" holds also when the design system has a confirmation dialog.

The written guidance of the design system is a different thing from its components. If the design system has guidance of its own (a skill, a guide for its use), and that guidance states a rule explicitly, that rule wins over this skill, also on behavior and content: it is a decision of the people who own the product. Where the guidance is silent, this skill applies. Tell the user about each such conflict, with the two rules, thus they can raise it with the owners.

The look is what a component draws: its colors, lines, shapes, text styles, and the place of its own parts. Where a component sits, how wide it is and what is next to it is layout, and layout is your work: a table or a text column that fills its container gets a container of the correct width. That is not an override.

"Standard" means a form and a size from the set that the design system gives, not only its default. Choose from the set by the purpose (a larger size for a main button under a thumb); do not make a size of your own.

**An explicit instruction of the user wins over all of this.** When the user states the thing itself, in the prompt or in a comment on a screen (a color, a size, a confirmation, a field that this skill leaves out), do it: also against a rule of this skill, against a default of the design system, and against its written guidance. The user owns the screen. Do not refuse, and do not put the nearest permitted form in its place. Name each rule that the instruction breaks in your report, in one line, thus the user can change the decision. A general wish ("make it stronger") is not such an instruction: do it inside the rules.

Use the scales of the design system (spacing, text styles, colors, sizes) and no values of your own. A keyword of layout is not a value of your own (no wrap, the width of the content, digits of equal width). A fixed width of a zone is permitted where the design system has no scale for it; name it in your report.

The reasons and the border cases (a plain standard answer against an elegant new one, when to leave the standard, a new part that a second screen needs) are in [Work with a design system](./references/design-system.md). Read it before you make a part that the design system does not have.

## 5. Behavior: build it, or name it

Much of this skill is about behavior: an undo, a wait, a change between two states, a motion, a hover. The rules for behavior hold in the same way for a screen that operates and for a screen that is a picture of one state.

- **If the screen can operate, build the behavior** as the rules say.
- **If the screen is a picture of one state, draw the states** that carry the behavior, each as its own screen file, and name in your report the behavior between them.
- **A picture builds one behavior: a link to a different screen.** The control that leads to the next state links to the screen file of that state (the send button of a form links to the "sending" state), and the path back links to the screen before it. Write the link as [Screen files](../../screen-files.md) says, on a part of the design system that takes an address; the library skill names those parts. A control whose target you did not draw has no link: name it in your report.
- **A step that no person takes has no link.** A wait ends by itself, and a picture cannot do that. The control that starts the wait links to the state that the person acts on next (the result), thus the flow can be clicked through; the state during the wait is drawn as a state that no link reaches, and your report names it.

**A remark of the author** is a line on a picture that is not a part of the product: it tells the viewer what the picture leaves out or stands for (rows that are not drawn, a picture with no file, a text that is not written yet). Each remark starts with the words "Not drawn:" and is in the weakest text style of the design system, thus nobody takes it for product text and nobody builds it. A caption of the product (a source under a chart) uses the same style and has no such words. Use a remark only where the picture would mislead with no remark, and list the remarks in your report.

Do not leave a rule of behavior out because the screen is a picture now. Design each state so that the behavior is possible when the screen operates later.

## 6. The parts of a screen

Each row names a file and, after the colon, the sections of it that hold the rules. Find the rows that match the screen, and read those sections before you design. Do not read a file that no row gives you, and in a file read the named sections only; "all" means the whole file. A row matches when the screen has the thing, not when it could have it.

| The screen has | Read |
|---|---|
| a flow of more than one screen | [Flows](./references/flows.md): Which screens exist · Each screen makes sense alone · Answers stay visible |
| a wait or a loading state | [Flows](./references/flows.md): Waiting · Honest states |
| a result; a payment, an order, a booking | [Flows](./references/flows.md): Honest states · The result |
| more than one state of one screen (during a wait, after an action, an open panel) | [Flows](./references/flows.md): Which screens exist · Each state has a defined next step<br>[Motion](./references/motion.md): Natural · When the screen is a picture |
| options of a screen or of one part, which the user asked for | [Flows](./references/flows.md): Options of a screen |
| a field that the person fills | [Forms](./references/forms.md): Ask less · A field · The sequence and the groups · The send button · The error state |
| radio buttons, a group of checkboxes, a select | [Forms](./references/forms.md): Options<br>[Labels](./references/labels.md): Checkboxes and options read in the sentence |
| a search field | [Forms](./references/forms.md): A search field |
| a form with a title and a main button | [Labels](./references/labels.md): A form is a sentence · The form of each label |
| a list or a grid of items | [Lists](./references/lists.md): The count decides the design · Finding an item · What a row carries |
| rows with a button or a control in each row, in a list or in a table | [Lists](./references/lists.md): Rows and their actions |
| a list of more than 30 items, or content in pages | [Lists](./references/lists.md): How much of a long list to draw · Portions: pages or one scroll |
| a list or a view that can be empty | [Lists](./references/lists.md): The empty and the used-up state<br>[Messages](./references/messages.md): Empty states |
| a toolbar, a settings screen, a set of more than five functions | [Lists](./references/lists.md): Sets of functions: toolbars, menus, settings |
| a table: rows with the same properties in three or more columns, also on a narrow screen | [Tables](./references/tables.md): all |
| a main menu | [Navigation](./references/navigation.md): The main menu · A hidden menu<br>[Labels](./references/labels.md): Things by their names |
| a "Back" control, a step indicator | [Navigation](./references/navigation.md): "Back" has two meanings · Steps |
| sections inside sections, breadcrumbs | [Navigation](./references/navigation.md): The data has a structure; the person has a task · A hierarchy |
| more than one button on a screen | [Actions](./references/actions.md): The main action |
| a removal, or an action that cannot be undone | [Actions](./references/actions.md): Undo and the check of the target · Dangerous actions |
| an action whose result is not obvious, a control that is not available | [Actions](./references/actions.md): The answer to an action · Controls that are not available |
| a switch, a tab or a mode that changes what other controls do | [Actions](./references/actions.md): One control, one meaning |
| a slider or a drag | [Actions](./references/actions.md): Sliders and drags |
| a thing that shows on hover, or changes with time | [Actions](./references/actions.md): Nothing changes by itself |
| a status or a badge near buttons, a switch or a toggle | [Controls](./references/controls.md): What looks like a control · Things that look like a different control |
| a control or a part that the design system does not have | [Controls](./references/controls.md): A control that the design system does not have<br>[Design system](./references/design-system.md): all |
| icons | [Icons](./references/icons.md): all |
| an error | [Messages](./references/messages.md): What a message says · An error message |
| a notice or a dialog | [Messages](./references/messages.md): Where a message shows · What a message says |
| a question with buttons | [Labels](./references/labels.md): Questions and switches in a positive form |
| a count or a value inside a sentence, a status text | [Messages](./references/messages.md): Text that a machine put together · Color and marks in a message |
| the title of a message or a notification | [Messages](./references/messages.md): Titles and subjects |
| names of sections, groups or settings | [Labels](./references/labels.md): Words that say nothing · Things by their names |
| running text: an article, a help page | [Text pages](./references/text.md): all |
| more than one work area, the detail of a chosen item | [Layout](./references/layout.md): The zones of a screen |
| more than three groups of content, a card grid | [Layout](./references/layout.md): Distance says what belongs to what · Groups · Alignment, weight and color also connect |
| controls on a narrow width or a touch screen | [Layout](./references/layout.md): Targets · Where things go |
| the same screen at a second width | [Layout](./references/layout.md): Different widths |
| a sound, a spoken message, a vibration | [Sound](./references/sound.md): all |

A chart, a diagram, a map, key numbers, results of a survey or a report, and a comparison of two or more things (plans, products, versions) are not in this table: read the skill `canvas-information-display` too, and give one reply for the two skills.

Two or three lines of a name and one amount (the lines of a bill) are plain content, not a list and not a table; with a second value in each line (a share, a change) they are a table: the names at the left, the amounts at the right, the total above them.

A subject has one home. If two rules seem to conflict, the rule in the file of the part that you draw wins.

To add guidance: put a rule into the section of its part. A new section gets its name into a row of the table; a new file is only for a part of a screen that has no file. A rule goes into the floor only if it holds for each screen.

## 7. After you write

Check each screen against the list "What to check" in [Access for each person](./references/accessibility.md). Read a different section of that file only for a point of the list that the screen does not pass.

Walk the task through the screens that you wrote. At each step, name what the person must notice, read, remember, compute, enter and hit. A step that needs arithmetic, memory of an earlier screen, a guess or a second try is a defect: fix it before you report. Then read each text of the screen together with its neighbors, as a stranger: two correct parts can say a wrong thing together (see "Meanings that nobody intended" in [Messages](./references/messages.md) when a general text, a status or a reaction control meets real content).

Then run the check of the code (`canvas check` with the screens that you wrote; `AGENTS.md` says how the command runs). You do not see the screen, and the check reads what the code says: a part that is not from the design system, a style of your own, a value that is not from a scale, a link to no screen. Fix each finding, or name it in your report with its reason, as step 6 of [canvas-screen](../canvas-screen/SKILL.md) says.

Then tell the user, in about 10 lines (the three items of section 1 do not count; a flow of four or more screens can take 15):

- what you left out or joined, and why;
- what the screen assumes that the system knows (the filled fields, the defaults, a cause in a message);
- each place where a simpler screen hides something that the person can want to see;
- each rule of this skill, default of the design system or rule of its guidance that an explicit instruction of the user broke, with the rule, in one line each;
- each place where the design system lacks a thing that the screen needs, where you kept its default against a rule of this skill, or where you followed an explicit rule of its guidance against this skill;
- the behavior that you did not build and that you rely on (an undo, a state during a wait, a hover, a motion), and the states that the screen has in use and that you did not draw, together in one or two lines;
- for options, each option and its difference, in one line each;
- the controls that have no link because their target is not drawn, in one line;
- each finding of the check that stays, with its reason, in one line each.

Give only the items that the user can want to change. Do not list each rule that you followed.
