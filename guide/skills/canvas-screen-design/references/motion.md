# Motion

Motion is each change on a screen that takes time: a panel that opens, a row that goes away, a screen that comes in. This file is about what motion is for and what makes it good.

The rules hold for a screen that operates and for a screen that is a picture of one state (see section 5 of `SKILL.md`). On a screen that operates, build the motion as this file says. On a picture, draw the two states so that a good motion between them is possible, and name the motion in your report.

If the design system has transitions of its own (in its components, or as a scale of durations and curves), use them and add no values of your own.

## What motion is for

Four purposes, from the most necessary to the least:

1. **To draw attention.** The eye catches a thing that moves at once: a text cursor that blinks, an icon that jumps. Use it for the one thing that the person must not miss, and for no other.
2. **To explain what happened and how things are related.** A window grows from its icon. A photo comes from the right, thus the next one is "at the right". A field shakes like a head that says "no". An item flies to the cart, thus it is in the cart.
3. **To make things feel real.** Things that move with inertia, friction and a bounce have weight; to act on them feels direct. This is the natural feedback of [Actions](./actions.md).
4. **To please.** Motion for its own sake, a small show. It can make people like a product, but only at a rare moment (a first start, a sign-in), never in an action that is done each day.

The demand for quality goes the other way. Attention can be drawn by the crudest blink. A show must be perfect: of an acrobat who falls one time, the fall is all that people remember. If a motion of level 4 cannot be made perfect, leave it out.

**A motion with none of these purposes is removed.**

## Not intrusive

- **Think of the hundredth time.** An entrance where each icon comes in by its own path is lovely one time and hard to bear on the second day of daily work.
- **No motion on hover** over links and rows, and no sound with it.
- **No motion that says nothing**: a field label that flies up when the person types, as a standard for each field, is a fly around the head of a person who works. (If the field of the design system does this, it is its default; do not add more.)
- **A large motion on a large screen tires.** A full-screen slide many times a day makes people dizzy. A cross-fade with a small shift in the direction gives the same sense of "left" and "right" with less movement.
- **A hint is enough.** A number that changes on a drum can turn one step to the new value; it does not run through each value between.

## Natural

A door does not "animate" from closed to open; it turns on its hinges because it cannot move in a different way. Good motion looks like that: the thing moves as it does because of how it is made.

- **No effects laid over two states.** A cross-fade, a flip in space, a growing circle or a ripple know nothing about what is inside the thing. They are decoration, and the person feels that they wait for it to end.
- **Each part goes to its own new place.** What stays in the two states does not move at all; what grows, grows from where it was; what is new comes out from below or from an edge; what goes away shrinks where it stands.
- **Design the two states so that this is possible.** The parts that the two states share (the title, the main buttons, the heading row) have the same position and the same size in the two states. A state that moves each part to a new place has no good motion.
- **A header that stays in view on scroll gets smaller in one smooth change**, not with a jump and not as a second header that drives in from above.
- **The best motion is not noticed.** A divider that grows to the full width while a header becomes fixed is seen by nobody; a jump at that place would be seen by each person.

## Coordinated

All parts move as one, in one direction, at one time, as the body of a good dancer does.

- **One movement, not a sequence.** Three lines that become a cross do it in one move; not first shrink, then join, then turn.
- **No part with its own direction.** If all moves up and down, a line of text that goes sideways to its new place takes the eye, as if it were important. Let it fade out in the old place and in at the new one.
- **Do not move the inner parts of a thing apart from the thing** (the label of a button apart from its background).
- **A blend is always coordinated**: the old state fades and changes its size into the new one as a whole. It is not natural, because it knows nothing about the parts, but nothing in it can go its own way. It is also cheap to compute and to design: only the two end states are drawn. Use a blend when a natural motion would need many parts to move in different directions.

## Clean

The frames between the two states must hold no dirt.

- **A thing that is the same in the two states does not fade over itself.** A word that is in the old and in the new state stays; it does not show two times, one copy over the other.
- **Text does not jump word by word** to the next line while a container changes its width. The lines that are the same stay in place; the others change in a cross-fade.
- **A row that opens into a form**: its label turns into the first label of the form at once, the rest of the old text goes with no effect, nothing happens above the line, and the new fields come out below it.
- Check the motion slowed down. Dirt that is seen one time cannot be unseen.

These four qualities can pull apart. To make a motion coordinated or clean, you sometimes make it less natural. Not intrusive comes first.

## How to build a motion

- **Short.** A motion that answers an action must not make the person wait: they must be able to act again at once, and a new action cuts the motion short. A change of a small part is faster than a change of a whole screen.
- **It starts at the moment of the action**, not after the data came; see "Waiting" in [Flows](./flows.md).
- **It can be reversed with the same path**: what opened by growing down closes by shrinking up.
- **Move and fade; do not change the layout in each frame.** A motion that only moves, scales and fades a thing is smooth also on a weak device. One that changes widths and makes the text wrap again in each frame stutters and is not clean.
- **Respect the setting of the person for less motion**: then a change is a plain fade or has no motion, and nothing is lost. A motion never carries a meaning that exists nowhere else.
- **The same change has the same motion** on each screen of the product.
- **Look at it slowed down, and at the hundredth time.**

## When the screen is a picture

Name each motion in your report, one line for each place:

- which change has a motion, and which of the four purposes it has;
- what stays in place, what grows or comes in, and from where;
- where you chose a plain blend.

Name no motion that has no purpose, and none for a thing that the person does many times a day, apart from the natural feedback of the control itself.

## What to make

- Two states of one screen with their common parts at the same place and size.
- A new part with a clear origin: below the row that was pressed, at the edge from which it comes.
- No state that differs from the one before it in each part.
- On a screen that operates: short motions that start with the action, and no motion with no purpose.
