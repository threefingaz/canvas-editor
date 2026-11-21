# Work with a design system

A design system is the set of ready, tested parts of a product: the grid, the text sizes, the colors, the icons, the controls with their behavior, the usual combinations of controls, and whole pieces of scenarios. Section 4 of `SKILL.md` gives the rule (the design system has the last word on the look). This file gives the reasons and the border cases: when to build from the standard parts, when to leave them, and what to do with a thing that is new.

## Why the standard parts come first

- **People know them.** A standard part behaves as it does on each other screen, thus the person does not learn this screen. This is the first reason, before the cost.
- **They are tested.** Each standard part already works at each width, with the keyboard, with a screen reader, in each state. A part of your own has defects that you do not know about yet.
- **They are fast.** A product of hundreds of screens cannot be drawn and checked screen by screen; a feature that waits half a year for its screens is old when it comes.

## What a design system holds

From the small to the large. Look for a ready answer at each level before you make your own:

1. **Scales**: the grid and the spacing steps, the set of text sizes, the colors. A value that is not in the set is not used.
2. **Icons**: one picture for one meaning on each screen.
3. **Controls with their behavior and states**: buttons, fields, menus, lists, tabs, switches.
4. **Usual combinations**: a question with its buttons, a choice of a color, a header of a page, a field with its error.
5. **Pieces of scenarios**: a wizard of steps, "take a photo or choose one".
6. **Text**: how the product speaks to the person, and the fixed wordings.
7. **The rule from a structure to its form at each width**: the same four sections are tabs at the bottom of a phone and a side bar on a wide screen. What is standard here is the rule, not one picture.

A good design system says for each part when to use it and how it behaves, not only how it looks. If the one that you work with is only pictures, the behavior is your decision; say so in the report.

## The plain standard answer against the elegant new one

When a standard answer exists and a new one looks better, choose the standard one. A list with the standard menu behind each row is less elegant than a new dense list of two columns. But ask of the new part:

- What does it do when the screen gets narrow?
- What does it do on a wide screen, where the list becomes a column and the detail opens at its side?
- What does it do with the keyboard, with a large text size, with a screen reader?

The standard list has an answer to each. The new one has none until you build and test each of them.

## When to leave the standard

- **When a new feature cannot be done well with the old parts.** A feature that changes how the product is used is worth a new part.
- **When the standard part is harder to use here than a plain one of your own**: a standard must make the work faster and simpler, not slower.
- **Not** because the standard parts are boring, and not to be different, unless to be different is a stated goal.
- **The more ready parts a design system has, the stronger the reason must be.** A typeface is the model: you use its letters, and you need a very good reason to draw one letter again.

How to make a new control is in [Controls](./controls.md).

## A new part can become a standard

- **Make it for this one screen first.** Do not design a general component for a need that one screen has.
- **When a second and a third screen need the same thing, it is a candidate for the design system.** Tell the user; do not copy it from screen to screen in silence. In this repository a part that screens share is written outside the screens folder.
- **Standards grow from what the product uses.** A sheet with each state of each button that no screen needs is a pleasant picture and not a design system. Do not add parts "for later".

## Consistency is a tool, not a goal

- **The same thing looks and behaves the same** where people meet the two together; see "One look for each type" in [Controls](./controls.md).
- **One look for all is not a value in itself.** Two parts of a product with two looks can live for years with no complaint. Before you change old screens to match new ones, ask if the person gains from it. A useful function is often worth more than the same look.
- **One system inside, different looks outside.** Products for different audiences can share the same skeleton (the layout, the controls, the behavior) and keep the colors and the style that their people know. Change the layer of style, not the structure.
- **A design adapts to where it is**: it follows the platform on which it runs, as a livery follows the shape of each car and is still known at once.

## What to tell the user

- Each part that you made and that the design system does not have, with the reason.
- Each part that a second screen now needs, as a candidate for the design system.
- Each behavior that you had to decide because the design system gives only the look.
