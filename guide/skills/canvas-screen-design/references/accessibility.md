# Access for each person

A screen must be usable by people who see badly or not at all, who do not hear, who have one free hand or an inexact aim, and by each person at a moment when they are like that. This file is a check of the finished screen against those people. Most of its rules are rules of the other files, seen from this side.

## Not a feature, and not for a few people

- **Access is not a thing that is added after the design**: a "version for people with poor sight", a row of buttons for contrast and text size on a page that nobody can use, a ramp bolted to a stair. Such things meet a rule and help nobody. A door at the level of the ground serves the wheelchair, the pram, the old person and the person with a heavy bag.
- **Each person has limits at some moment.** The same need is permanent for one person, temporary for a second and caused by the situation for a third:

| | Permanent | Temporary | In the situation |
|---|---|---|---|
| Sight | blind, weak sight | after eye drops or an operation | a phone in bright sun, eyes on the road |
| Hearing | deaf | an ear infection | a loud room, the sound turned off in a train |
| Hands | one arm, a tremor | a broken arm | a child on the arm, a bag, gloves, cold fingers |

- **Old people are many**, have these needs with no name of a disability, and are customers. To design for an imperfect person widens the audience and also the count of situations in which the product can be used.
- **When a product is checked for access, the defects that are found are defects for each person**: a poor structure, popups, small targets, no keyboard. For some they are an annoyance; for others they make the product not possible to use.
- **Do not put these functions behind a door named for a disability.** Offer text size, captions and one-hand use as plain settings by their subject (sight, hearing, hands), thus a person does not have to declare that something is wrong with them.

## Sight

- **Each control has a name in words.** A button with text has one. A button with only an icon, a swatch of a color or a picture needs a name in the code ("Black", "Close"), and a value that a picture shows (the date on a calendar icon) is in that name.
- **The structure is in the code, not only in the look.** A person who sees finds the menu, the title and the sub headings by their size and place. A screen reader needs them marked: real headings in the correct levels, lists as lists, the menu as navigation, a button as a button. Then the person hears the headings first and goes into the part that they want. Use the components of the design system for their type; they carry these roles.
- **The sequence in the code is the sequence that the person sees.**
- **No popups.** A screen reader either does not read a thing that shows over the page, or starts to read it in the middle of a different text. One more reason for the rule in [Layout](./layout.md).
- **The screen holds at a large zoom.** No special large-text version and no text-size buttons of your own: the zoom of the browser or the text size of the system must work. The page keeps its width, gets no sideways scroll, and changes to its narrow layout. A screen that adapts well to a narrow width (see "Different widths" in [Layout](./layout.md)) does this with no more work.
- **Color is never the only sign.** About one man in twelve cannot tell red from green.
  - A chosen option differs by a thicker frame, a mark or a fill, not only by a color of its frame.
  - A field with an error has a sign with it (an icon, a word), not only a red frame. This limits the rule "a red field is enough" in [Forms](./forms.md).
  - A status has a word. Lines of a chart or a map differ by more than color, or carry their labels on them.
  - Look at the screen with no color: does it still read?
- **Enough contrast for each text that is meant to be read**, also a hint, an example in a field and a disabled label. Think of a phone in the sun: more contrast is better for each person.
- **Fine shades are your choice, but a choice.** If a subtle look stops a part of the people from buying, it costs more than it gives. The strongest design is one that an expert admires and each person can use.

## Hearing

- **The product is complete with no sound.** Nothing is said only by a sound; see [Sound](./sound.md).
- **Content with sound has captions or a text form**: a video, a recording, a voice message. People with good hearing use them more than anyone: in a loud place, or with the sound off so as not to disturb.
- **A signal has a form that is seen or felt** as well as heard: a light, a mark, a vibration.

## Hands

- **Use with one hand is the normal case.** Main actions are at the bottom of a narrow screen, where the thumb reaches. All of "Targets" in [Layout](./layout.md) is a rule of access: a large target, gaps between targets, a dangerous control away from a frequent one. A small target is harder still with cold fingers, in gloves, with long nails.
- **A person who should not use the product now** (while driving) will use it. Small, hard targets make a dangerous act more dangerous.
- **All can be done with the keyboard.** The focus goes through the controls in the sequence that the eye sees, and the control with the focus is visible. Standard controls bring this with them; a control of your own does not (see [Controls](./controls.md)).
- **Keys for the frequent actions** in a tool that people use each day, with one place that lists them.
- **No action that needs an exact or long gesture as its only way**: a drag, a hold, a double press each have a plain press that does the same.

## Each person is in the picture

People differ in language, culture, age, family and much more. A person who sees their own world in a product uses it with more ease.

- **The sample content fits the people who will see it**: names, towns, addresses, currency, the form of a date and of a phone number. Vary the names, and do not make each person in the content of one sex or one origin.
- **A picture of a thing that differs between countries** (a passport, a road sign, a plug) is drawn in a neutral form, or changed with the language.
- **A neutral figure for "a person"** in icons and pictures; see [Icons](./icons.md).
- **Keep the common words.** The interface for a blind person still has "buttons" and "menus", because a blind person and a person who sees must be able to tell each other where a thing is.
- A person who cannot use what the others use is left out of what the others talk about. That is the real cost.

## What to check

- Each control has a text name, and each icon button has one in the code.
- Headings, lists and navigation are marked as what they are.
- The screen reads with no color and at a large zoom.
- Each text has contrast.
- All works with one thumb and with the keyboard.
- Nothing depends on a sound.
