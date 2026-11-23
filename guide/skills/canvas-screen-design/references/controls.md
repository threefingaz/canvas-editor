# Controls

A control is a thing that the person acts on: a button, a link, a field, a switch, a slider. This file is about what makes a thing look like a control of its type, what must not look like one, and when and how to make a control that the design system does not have. What a control does is in [Actions](./actions.md); its text is in [Labels](./labels.md).

## What looks like a control

A person does not analyse a screen; they get a feeling of "this can be pressed" and act on it. A control is recognised when it has enough signs of its type.

| Type | Signs |
|---|---|
| A button | a filled or outlined block, rounded corners, a short text in the center, the text is a command |
| A link | an underline (it can be thin), a link color, an arrow at its end; color alone only where the page has few colors and many links |
| A field | a frame or an underline, a background that differs from the page, a label |
| A row that can be pressed | an arrow or a mark at the end, the mark of the row under the pointer |
| An area that scrolls | a visible indicator, or an item that the edge cuts |

- **Use the standard look when you are not sure.** Each component of a design system carries the signs of its type: one for an action, one for navigation, one for a label or a filter. Use each for its type, and do not restyle one to look like a different one.
- **One look for each type, on each screen of the flow.** A color used for links is not used for emphasis. Underlined text is always a link. Bold text is not a sign of a link.
- **A thing that is not a control does not look like one.** A status, a badge, a discount label or a chosen value is not a colored rounded block when buttons are colored rounded blocks.
- **A thing that looks as if it can be dragged, can be dragged.** A decorative track with a handle reads as a slider; an area with a dashed frame reads as a place to drop a file.
- **One block, one destination.** A title with a section name inside the same block reads as one target. A control inside a control only when the density truly needs it; tell the user.
- **An icon alone does not say if it can be pressed**; its place and context say it. When a screen has icons, and when it does well with none, is in [Icons](./icons.md).
- **A known pattern is read as a whole**: in a tab bar, the marked item is the current one. Use the standard navigation components as they are. The current item of a menu differs from the links by more than color: weight, a mark below it, or a background.

## Things that look like a different control

A control is read against all that the person has seen before. A new arrangement can turn it, with no intent, into a different known control.

- **Check each control and each group of controls: what known control does this look like?** If it looks like one that it is not, change it.
  - A field with an arrow at each side reads as a select. With a minus and a plus at its sides it reads as a stepper.
  - A magnifier next to a minus and a plus reads as zoom controls, not as "search, remove, add". Put them apart, or change the signs: a field for the search, a bin for the removal.
  - A button with an icon next to a magnifier reads as a search field.
  - A passive value in a grey frame with a calendar icon reads as a date field. Give a passive value a look with no frame.
  - A row of card logos, one of them with a frame, reads as a choice of the card. A passive picture has no sign of a choice.
  - A field and a button that differ only by the radius of their corners are one thing to the eye.
- **The state of a control is clear at one look.** A switch has one sign of "on", and all its signs agree: the position, the color and the word. A switch with "Yes" and "No" on it, a color and a position gives four ways to read it. In a toggle of two options, the chosen one is the one that looks pressed, and the other does not shine brighter than it.
- **Do not copy a known control inexactly.** A near copy of a platform switch with added words is worse than the standard checkbox.

## A control that the design system does not have

- **Start with the standard controls.** Why, and what to ask of a new part, is in [Work with a design system](./design-system.md). Leave them only when they do not fit the task or are not convenient for it. That the usual controls are boring is not a reason; a brand that must look different is a reason only when it is stated as a goal.
- **A new control must give a gain that the person can feel.** For example:
  - a choice of a person with photos and short cards, when people forget names: a plain select cannot show a face;
  - days as columns with the free times in each, when the person looks for a free time: a calendar and then a time list makes them try days one by one;
  - seven colors as seven swatches in a row, in the place of a select with the names of colors: the colors are seen, and one press is saved.
- **Build it from the parts of the design system, and make it look like its neighbors**: the same height, corners, frame and spacing as the standard controls next to it.
- **A control that is new to people can carry a short instruction** ("Slide to unlock"), until people know it. This is the one exception to the rule against instruction words in [Labels](./labels.md); a standard control never needs one. Make the instruction a part of the press area.
- **A standard control brings the keyboard, the screen reader and large text with it.** A control of your own has none of these until you build them. Give at least one plain way to do the same thing: a date picker of your own also takes a typed date, in each usual form.
- **Tell the user** about each control that the design system does not have: what it is for, and what it lacks.

## What to draw

- Buttons, links, fields and statuses that differ at one look.
- Switches and toggles whose state can be read in one way only.
- No two neighbors that together look like a different control.
- A control of your own only with a stated gain, in the look of its neighbors.
