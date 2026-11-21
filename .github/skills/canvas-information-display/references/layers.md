# Layers

A geographic map carries a hundred times more than an ordinary screen, and it is clear. It does this with layers: each kind of thing has its own visual means, and the means are tuned so that the kinds can lie on each other and each can still be read. This file is about how to build a dense picture (a map, a plan, a diagram, a screen with much data) in layers.

## The three groups of layers

| Group | What it holds | How it is drawn |
|---|---|---|
| The background | areas: land and water, zones, a measured value over an area | calm, low contrast; a row of shades for a row of values |
| Lines and points | rivers, roads, borders, routes; towns, objects | the weight and the character of a line say its kind; the form of a point says its kind |
| Labels | names and values | a text style for each kind of thing; the size follows the weight of the thing |

- **The background is calm.** Black text must be readable on its darkest shade: on the deepest water and on the highest mountain. Shades of one color for a depth, of a second for a height.
- **A wide pale band along a line** (a border) makes the line found from far and hides nothing below it.
- **Lines differ by character, not only by color**: a river is heavier and winds; a road is thin, even and nearly straight; a railway has its own pattern; a grid of coordinates is known by its perfect straightness, at the same weight as a road; the thinnest lines are the contours of a value.
- **Points differ by form**: larger and smaller, filled and hollow, ringed.
- **Labels differ by style**: upright and slanted, with and with no serifs, and a label of a line follows the line (a river, a ridge). The size of a label says the size of the place.
- **A name set in wide-spaced large letters holds together** across the things between its letters, if the letters have a look that no other label has.

## Tune the layers against each other

- **Choose a means for each kind of thing, and then check each pair of layers where they meet**: can the two be told apart, and can each be read? Change the means until they can.
- **A loud layer forces each other layer to shout.** A map with a strong, different color for each region needs huge black dots for its towns, and larger white ones for the main towns. With pale regions, small dots are enough, and the addresses fit onto the map, with no legend.
- **A strong color is for small things that are that color** (a playground), not for areas.
- **The main objects get the strongest outline**; the things around them are thin and pale.
- **A value over an area** (a temperature, a humidity) is a calm row of shades through which the coast and the borders still show. A gradient of many bright colors hides the land, the sea and the text.
- **Contours of a value are very thin lines over all**, and their numbers have the weight of the line, thus a line and its number are one thing. A hatching is one more quiet means for an area.
- **A large mark that must not hide what is below it has a transparent fill**: a circle for a count, through which the smaller circles inside it show.
- **Layers must not touch by accident.** An edge of a background shape that meets the edge of a text, or a curve that touches a letter, joins two layers into one. Move or resize one of them.
- **The credits and the technical notes are the quietest layer**: small and pale, in a corner.

## A layer that is not a part of the picture

- **A thing that does not belong to the picture looks as if it came from a different world.** "You are here" is a bright sticker with a shadow, against each rule of a map, and that is the idea: it is about the reader, not about the place. It works only when there is one such thing.
- **On a dense map, the own position is a large pale circle**: it is seen from two meters, and each name below it can be read. A small dot is not found, and a large solid one covers the street names.
- **A link between a place and a list at its side is one very thin line.** It can cross each thing; it reads as a hair on the paper, not as a part of the plan, and nobody takes a crossed name for a deleted one.
- **A grid for an index can be invisible**: the letters and digits at the edges are enough.
- **A note of the author in a draft must not be taken for the design**, or somebody builds it into the product. On a screen in this repository, a remark of the author starts with the words "Not drawn:" (see section 5 of `SKILL.md` in the skill `canvas-screen-design`). Mark a text that is not written yet in the same way, thus it cannot be missed.

## Layers that change with an action

On a screen, the layers can change when the person acts.

- **A search splits a layer in two**: the things that match get stronger, and all others get paler than before.
- **A choice of a category lifts its marks** into a layer of their own: they get larger and darker.
- **A selection gets a strong frame**, and the list for it shows at the side.
- On a screen that is a picture of one state, draw the state after the action as its own screen.

## Text that belongs to a picture

- **A word in the text that names a color of the picture is set in that color.** The person finds the meaning of each color with no reading of the whole text, and is drawn into the text. This does not help the reader to skip the text; it helps them to start it.
- **Names on the parts, not numbers with a list**; see [Labels on data](./labels-on-data.md). To fit a name, drop the general word ("room", "laboratory") and what the context says: "gym", not "room for physical exercises".

## Two languages

- **Each language is its own layer**, with one means that is the same on each sign of the system: the second language in a different color, or a little smaller. A person then reads only their own layer.

## What to draw

- A calm background, on which the darkest shade still carries black text.
- A different line character for each kind of line, and a text style for each kind of name.
- One loud thing at most, and only for what is not a part of the picture.
- The search result as a stronger layer over a paler rest.
- Color words of the text in their colors.
