# Layout

Layout is where things are on the screen, how far from each other, how large, and what they look like. It decides what the person reads as related, what they see as a control, and what their hand can hit. This file is about the zones of a screen, distance and groups, the size and the place of targets, and different widths. What makes a thing look like a control is in [Controls](./controls.md).

## The zones of a screen

To find a place for each thing on the screen is the work of the designer. Two easy ways give that work to the person or skip it, and the two are defects.

- **Do not make the person arrange the interface.** Separate windows and floating panels that the person can put "as they like" sound like care. But at each moment it is easier to push one window away than to find a good arrangement, thus most people live in a mess and lose time on it. Put all work areas into one screen with fixed zones.
- **A popup is the laziest answer.** A rectangle on top of the rest needs no thought: it covers something useful, demands attention, and needs an aimed action to go away. When a screen gets a new function or a detail of an item, find a place for it in the layout. A detail of a row is not a dialog over the list.
- **List and object.** The usual place for the detail of a chosen item is next to the list: the list in one zone, the chosen item in the zone at its side. If there is no free zone, the list gets narrower and the detail comes in next to it, with a "Back" control.
- **A zone has one job, and the zones follow the work.** For example: the signals that need a reaction always in view at the bottom of the list; the map of the chosen item at the top of its card; the actions on it in a block that stays at the bottom of the card.
- **Zones change their size with the content by themselves.** The person does not drag borders to see their data.
- **Usual arrangements:**
  - two halves, to compare two things of the same type or to move items between two lists;
  - four parts, for four views of one object;
  - tabs, when a number of documents each need the full area: the tabs show what is open, thus nothing is lost;
  - the arrangement of the real desk, when the screen stands for a known set of devices.
- **Give ready configurations, not free arrangement**, when the work has different phases: one press makes the track list large and the players small, a different one gives the reverse. Two or three presets that fit the usual situations are better than panels that move freely.
- **If people do need a second window** (to see two chats next to each other), keep one window as the default and permit to open an item in its own window as an extra.
- A detail panel, an open group or a preset is a state. On a screen that operates, a press opens it; on a picture, draw it as its own screen file.

## Distance says what belongs to what

Things that are near each other look related. This is stronger than lines, frames, arrows and colors. Spacing is not decoration: it is the first tool that says what belongs to what.

- **The distance inside a thing is smaller than the distance between things**, at each level: between the lines of one item and between items; between a label and its field and between two fields; between a heading and its block and between that block and the next heading; between the parts of a card and between cards.
- **A label is nearest to its own thing.** A caption in the middle between two pictures belongs to neither.
- **In a grid, the picture, the name and the price of one item are a tight block**, and the gap between items is clearly larger in the two directions. Equal distances make the person guess which price is whose.
- **A heading is tight to the block that it names** and far from the block above it.
- **A number and its unit stay together** and away from other numbers. Two numbers that are near and have the same weight read as one number.
- Use a small step of the spacing scale of the design system inside a group and a clearly larger step between groups. The same step at each level makes a flat screen.

## Groups

- **Group by distance first.** Seven equal items are hard to take in; the same seven as a group of three and a group of four are two things.
- **A gap is enough.** A group needs no frame, background, divider or title to be seen as a group. Add these only when the gap cannot do the work. Exception: long or wide rows of a list get a thin divider; see [Lists](./lists.md).
- **Start with the gaps.** When a screen looks like a mess, do not add lines, icons or larger headings first. Set the distances by the meaning.
- **A line that separates also joins.** Bars between the items of a menu glue them into one string; two framed neighbors get three lines between them. Tiles on colored backgrounds make a grid of the gaps that is stronger than the tiles. Equal elements in a regular row are seen as a pattern before they are read.
- **Remove what only decorates**: frames, shadows, lines, textures. The design system sets the look; do not override it to copy a material.

## Alignment, weight and color also connect

- **Do not align things that have no relation.** Buttons that are aligned below a row of options read as one button for each option. Two rows with the same column division look like a table.
- **Words on one line connect more than words in a column.** In a small block of two by two, decide the reading direction and make that distance clearly the smaller one.
- **Large or bold parts connect across a gap** and tear a phrase: the bold parts are read together and the light part between them drops out.
- **Things with the same strong color look related.** A red badge next to a red close button reads as one control.
- **A common background joins** what is on it.
- A face or an arrow sends the eye to what it points at: a photo looks toward its own text.
- A line or an arrow does not win against a wrong distance. Repair the distance.

## Targets

To press a thing, a hand must hit it. The farther the target, the longer the aim; the larger the target, the shorter. The gain gets smaller as the target grows, thus a very large button adds little.

- **A control has a least size that does not depend on its text.** A button "OK", "+" or "−" is not as small as its text. Use the standard size of each control of the design system; do not choose a smaller size or shrink a control to save space on a narrow screen, also when an existing screen does so.
- **The press area is larger than the picture.** A menu row is pressed along its full width. The label of a checkbox is a part of its press area. A picture and its caption that lead to one place are one area with no hole.
- **Do not make the press area larger than people expect**: a press on empty space next to a plain text link must not lead away.
- **Gaps between targets.** Links in a list have a gap larger than the gap between the lines of one link.
- **Keep space for content that arrives late**: pictures and late blocks have their final size from the start, thus nothing jumps under the finger.

## Where things go

- **A narrow screen (a phone in one hand):** the main action is at the bottom, where the thumb reaches and the hand does not cover the content. When the content is shorter than the screen, the action block still sits at the bottom edge of the screen, not in the middle. Content that is only looked at is at the top.
- **A touch screen that stands in a place:** a raised arm gets tired and covers the screen. The main controls are at the bottom; rare and reference things at the top.
- **A product that fills a desktop screen:** the corners and the edges are the easiest places for a pointer, because the pointer stops there. Put the most used controls there, with press areas that reach the edge. A page in a browser window has no screen corners of its own.
- **The corners of a panel or a card** are where people look for its small controls: close, menu, account, cart. Do not put a decorative icon there.
- **Give what the situation needs at the place of the need**: the next action next to the result.
- **A common mistake in columns:** the text is aligned to the left of its column and the picture to the right, thus each picture is nearer to the text of the next column.

## Different widths

- **One product for each width, not a separate mobile product.** A separate mobile version costs two times the work, lacks functions, and shows the wrong layout when a link from a phone is opened on a computer.
- **Decide for each type of block how it changes with the width**, not for the page as a whole:
  - a text block gets narrower;
  - a picture of the full width gets smaller in proportion, and on a phone it loses its side margins;
  - two pictures side by side go one below the other;
  - text in columns gets fewer columns;
  - a wide row of items scrolls sideways, with a cut item at its edge as the sign;
  - the main menu gets a different design for a narrow width (see [Navigation](./navigation.md)).
- **No one point where "desktop" becomes "mobile".** Each block changes at the width where it no longer fits. A phone that is held sideways, or a window of 1024 px, keeps the blocks that still fit in their wide form; do not give a window of that width the phone layout.
- **Nothing is left out on a narrow screen**: the same content and the same functions.
- On the canvas a screen file has one width. To show how a screen adapts, draw it as a second screen file with a different `width` from `canvas.config.ts`, with the same content. Keep content that the two share (the rows, the values) in one plain data file with no markup in the folder of the flow.

## What to draw

- Tight blocks of a thing with its label, value or price, and clearly larger gaps between the blocks.
- Groups made by gaps, with no frames where the gap is enough.
- Controls at the standard sizes of the design system, with gaps between them.
- The main action at the bottom edge of a narrow screen.
