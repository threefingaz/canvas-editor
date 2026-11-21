# Actions

An action is a thing that the person does to change something: a press on a button, a removal, a switch, a drag. A repeated action is done with no thought: people act by the shape and the place of a control and do not read. Thus a screen must work for a person who does not read it. This file is about buttons, removal and undo, the answer to an action, and controls with more than one meaning.

## The main action

- **The test:** imagine all the text of the screen in a language that you cannot read. The shape alone must show the next step: the field, then the one strong button in the usual place.
- **At most one filled button on a screen.** A screen with no main action (a result, a report to read) has none. Two buttons of the same weight make the person read. The main button is the largest and strongest, and never the smaller one. Exception: a list where each row has the same action; see [Lists](./lists.md).
- **The usual place has the usual thing.** The button at the end of a form continues. The last item of an account menu signs out. Do not put a different thing there, and do not put a dangerous action where a safe, frequent one usually is.
- **The label is a command with its result**: "Pay €34.90", "Add to the cart · €41.30". The cost of an action is on the action. A button that only opens the next step names that step ("Pay with a different card") and has no amount. A label must fit one line: if the command with its result is too long, the verb and the amount stay on the button, and the rest (the card, the receiver) goes to a line above it.
- **The place of the main action is fixed; the command in it belongs to the state.** In each state of a screen the filled button is in the same place (the bottom of the action block on a narrow screen), and the weaker buttons are above it or at its side, with no text between them. After a failure the state is new and has its message, thus that place can hold a different command. The new command must be safe to hit by accident: it opens a step and does not spend or destroy. Do not move the filled button to keep an old command in its old place.
- **Keep the sequence of buttons the same** on each screen of the product (which side confirms, which side cancels). People press by position.
- When you change an existing screen, keep the places that people know, unless the user asks for the change.

## Undo and the check of the target

"Are you sure?" does not protect. After the third time it is "press, press" in one movement, and it does not help a person who chose the wrong item one step earlier. A stronger form does not help: capital letters, a red warning, a pause, "type the name to delete".

Use this one rule for each action that changes or destroys something:

1. **The action can be reversed → it happens at once, with an undo.** A line shows in the place of the removed or changed thing, names the thing ("Removed the order of 6 October: Earl Grey, 100 g"), and has "Undo". The line stays until the person leaves the page. Removed things go to a place from which they come back.
2. **The action cannot be reversed, but a delay is possible → it is held for a short time**, and the screen says so and offers "Undo" in that time: a sent message, a placed order.
3. **Neither is possible (a card payment, a deletion for ever) → the target is on the same screen as the button.** The person sees what is paid, to whom, and how much, next to or on the button. This is content of the screen, not a confirmation: it adds no step and no dialog. Tell the user about each such action in your report.

An action that spends money and depends on things that its control cannot show (the address, the card, the delivery day) is not done with one press from a list. It leads to the place that shows them: "Order again" fills the cart, and the order is placed there.

A separate dialog or step that only asks "do you want this?" is never the answer. A summary that shows the target on the same screen as the action is permitted, and for case 3 it is necessary.

## The answer to an action

In the real world, physics gives the feedback. On a screen nothing answers until you design it.

- **Each action has a visible answer**, at the control or at the thing that changed: the row, the counter of the cart. Not in a far corner.
- **No dialog for success.** "The item was added" with "Continue shopping" after each item is a punishment.
- **The button after its action:**
  - if the action can be repeated (add to the cart), the button keeps its place and its command, and the answer is a line next to it ("In the cart: 2 × Earl Grey");
  - if the action can be done only one time (subscribe, book this time), the new state shows in the same place and the way back is next to it ("Cancel booking"). The state can take the place of the whole group that the person chose from (the free times of that doctor), if it names what was chosen;
  - a control never gets a different command in the same place when its press worked ("Start" does not become "Delete"). The main action of a new state after a failure is the case above, in "The main action".
- **The answer has two places when the control and its object are apart** (a button in a panel, a photo in the work area): the progress shows at the control, and the result shows at the object.
- **During a wait** the button goes disabled at once and keeps its label; a short line next to it says what happens ("Asking the bank…"). See "Waiting" in [Flows](./flows.md).
- **A failure shows at the thing that failed**, with the way to try again.
- **A small failure gets a small sign**: a hint at the control, not a window with "OK".

## Controls that are not available

- **Prevent the action that has no sense.** A control that cannot operate now is disabled, and the reason is visible near it when it is not obvious.
- **Show what is possible, not a refusal.** While a thing is dragged, mark the places that take it.

## One control, one meaning

A mode is a state that the person does not have in mind and that changes what an action does: a switch set a minute ago, in a different part of the screen. The person does the usual thing and gets a different result. For each control, ask: does a state that was set elsewhere or earlier change what this does? If yes, remove the mode, with the first of these methods that is possible:

1. **Separate the actions.** Two buttons, not one button and a switch: "Photo" and "Video" each start their own thing. No tool palette where the same click selects, moves or zooms. No direction switch when the program can see the direction from the input.
2. **A state that the person holds.** The second meaning operates only while the person holds a key or a press ("press and hold to …"), not after a toggle that stays on.
3. **The object first, then the action.** The person selects the thing, then presses the action. Not a "delete tool" that removes what is pressed next.
4. **Only then, make the state visible** at the place where the person looks at the moment of the action: on the object, in the group heading, in the answer. A label in a corner is not seen. Tell the user that the mode stays.

A switch, a filter and a selection can each be set back to the first state by the same type of action that changed them.

## Nothing changes by itself

- **A control does not change its meaning under the finger.** A button that is "Stop" while a thing loads and "Reload" after it gets a press that was aimed at the other meaning.
- **Nothing closes or resets on a timer.** A menu, a form or a notice stays until the person closes it.
- **Nothing that can be pressed shows on hover.** A delete button that shows on a row under the pointer gets the press that was meant to choose the row. A hint does not cover the thing that the person is about to press.
- **A press does not put a different thing in the same place.** If a choice moves the chosen item away and puts new items where the list was, the person cannot tell if the press operated.
- A thing that changes under the pointer can be pressed, and the area that reacts is exactly the area that takes the press.

## Dangerous actions

- **Distance between an action that destroys and a control that is used often.** No "Delete" next to "Reply", no "Reset" next to "Apply", no "Delete for ever" next to "Restore".
- **The frequent, safe action is the larger one.**
- A removal is a weak text button, not a red filled one, when an undo exists.

## Sliders and drags

- **The result follows the movement**, not only its end, with no "Apply" button. If the exact result cannot keep up, show an approximate one.
- A slider takes a press and a drag at each place of its track, and gets the full width that the screen has.
- **For a value that needs exactness, add step buttons** ("−15 s", "+15 s"). A free drag is not the only way to set an exact value.
- Do not copy a real control that does not fit a screen: a round knob to turn with a finger. Use a slider, a stepper or a field.

## No aiming at all

- A thing that fills the screen closes with a swipe at each place, not only with a small cross.
- A gallery turns with a swipe or a press on each half of the picture, not only with small arrows.
- After an item is closed or removed, the next one comes under the same place.

Build these behaviors on a screen that operates; on a picture, name them in your report where you rely on them (see section 5 of `SKILL.md`).

## What to draw

- One filled button with a command and its result as the label.
- An undo line in the place of the removed thing, with the name of the thing.
- For an action that cannot be undone: the target and the amount next to the button.
- The state after each main action, and the failure state at the thing that failed.
- A separate control for each meaning.
