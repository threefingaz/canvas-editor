# Flows

A flow is the chain of screens and states that takes a person from the start of a task to its result. This file is about which screens exist, what each one carries, and how the states connect. The controls on them are in [Actions](./actions.md) and [Forms](./forms.md).

## Which screens exist

- **The first screen is the most probable need.** If nearly all people come for one thing (the bill, the next appointment), that thing is the first screen, with no home screen and no menu before it.
- **Data first.** Show real items on the first screen, chosen from what the system knows (the place, the history, what is popular). Do not put a form of questions or filters before the first content.
- **A screen that exists only because the program could not decide is a defect.** "Choose the payment method" when one saved card exists; "New or existing customer?" when the account shows it. Take the default and leave a small way to change it.
- **No step that only confirms.** A review step is permitted only when it shows something new that the person must check; see "Undo and the check of the target" in [Actions](./actions.md).
- **A flow that the person repeats is linear**: the same steps in the same sequence, with no branch that changes the meaning of a press.
- **Make the states that the walk finds** (on a picture, each as its own screen file; see section 5 of `SKILL.md`): after an error, after a change of an earlier choice, the result. Draw the state during a wait when the wait is longer than about two seconds, and for each payment, order and booking; else name it in the report. Draw the empty state when the person of the task can meet it; else name it.

## Each screen makes sense alone

A person does not go through the flow in one sitting. A call comes, they leave, and they come back to a screen after an hour. On the canvas each screen is a frame of its own, thus the test is direct: look at one frame and cover the others. From that frame alone, the person can say:

1. what this is, and which product;
2. what it is about: which order, which amount, which person;
3. what has happened up to now;
4. what to do next, and what that will do.

- **A payment screen shows what is paid for**, in words, and the amount. An order number alone says nothing.
- **A screen that asks for a code** says what the code confirms and which product asks.
- **The last step of an order** shows what is ordered, not only the address and the card.
- **A step of a wizard** says where the person is and what this step decides. When to show the steps is in [Navigation](./navigation.md).
- **A demo or an example says so on each of its screens** when a mix-up with the real thing has a cost.
- **A screen that is reached from two places** shows what is true for the two (the subject, the amount). What happened before goes into it only if the content of the screen differs; then draw the two as two screen files.
- **A branch repeats no states.** If a second path (a different card) ends in the same wait, result and failure as the first, draw them one time and name the rest in the report.

## Answers stay visible

- **An answer of the person does not go away.** It shows on the later screens as a chosen value, a line or a part of the query, and it can be changed there. A flow of questions where each answer vanishes gives no way back and no way to see the state.
- **Do not ask twice, and do not make the person carry data** between screens in their head: a code, a number, a choice. The next screen has it.
- **The path back is visible** on each screen after the first. A state of the same screen (during a wait, after an action, with an error) is not a new screen and needs no "Back". A screen that ends the flow (a result with "Done") has its own exit.
- **On a picture, the next step is a link** (section 5 of `SKILL.md`). The control that leads to a drawn state links to the screen file of that state, and the path back links to the screen before it. A control whose target is not drawn has no link, and the report names it. Then walk the links as the person walks the task: each screen of the flow can be reached from the first one, and each screen after the first has its way back where the task has one.
- **Two states of one screen keep their common parts at the same place and size**, thus the change between them can be a calm motion; see [Motion](./motion.md). If a state needs more room (a message, a progress line): keep a place of one line free from the start; for more than that, the parts above it and the main action stay, and only the parts below it move.
- **Two answers to two independent actions can share one frame** when they sit at different places of the screen (one row is in the cart, a different row is removed). States of the same place get a frame each.
- **A later choice never changes an earlier one in silence.** If the new doctor does not have the chosen time, do not replace the time: show the times of that doctor, or show that the chosen time is not available.
- **A flow that the person left shows the saved state** when they come back: a draft, a position, a half-filled form.

## Waiting

The answer to a press comes at once, also when the work takes time. First respond, then work.

- **A short wait (one or two seconds):** the control changes at once, to a disabled state with a short line next to it ("Asking the bank…"). No spinner over the screen.
- **A long wait:** a progress indicator at once. A bar with the part that is done says more than a spinner.
- **A screen that loads shows its skeleton**: the real layout with grey blocks in the place of the content. No blank screen with a spinner in the middle. Late content has its final size from the start, thus nothing jumps.
- **A waiting screen says what the person waits for and what will happen**: "We sent your request to 12 tutors. Their replies will show here."
- **A forecast that jumps is worse than no forecast.** If the time left is not stable, do not show it.

## Honest states

- **"Accepted" and "done" are different states.** Show a result before the server confirms only where a lost action costs nearly nothing (a like, a move of a card). For an order, a payment, a booking or a sent message, show "sending" or "accepted" at once and "done" only after the confirmation.
- **"Accepted" is a complete answer** for a command that finishes later: "We got your request", and a message when it is done or when it fails. The person does not need to watch a progress bar.
- **A product that shows results early also shows the failure**, at the thing that was not saved.

## The result

- **A result says which action finished, in the words of the task**: "Paid €34.90 for the December internet bill", not "The operation was successful", and not a block of transaction codes.
- **The result shows in the place of the form**: what is now set, and how to change or remove it. Entered data does not vanish after "Done".
- **The next action is at the result**: the receipt, the calendar, the next bill. On a narrow screen it sits in the action block at the bottom, where the main action was.
- A result is plain content of the page. A wide strip with a strong color and a picture is read as an advertisement and not seen.

## Each state has a defined next step

A design is closed when each action in each state has a result that follows from what the person sees, also when they act in a sequence that you did not plan.

- Walk the states, not only the planned path. For each control on each screen: what happens on a press here, now? What if the person presses it a second time, or edits the first field again?
- A control whose meaning depends on a hidden moment is not closed. A button "run for 2, 4, 6 hours" that is pressed again after three hours: does the time start again or get longer? Show the end time, or the time that is left.
- If a wanted behavior needs a special case ("but in this state the button does a different thing"), the rule is wrong. Find a rule with no exception.
- A new feature on an existing screen follows the behavior that people already know there. If it needs a gesture or a rule that exists nowhere else, tell the user.

## What to draw

- The most probable need as the first screen, with real content.
- The subject of the flow (the order, the amount, the receiver) on each later screen.
- The earlier answers, visible and editable.
- "Accepted" and "done" as different states where an error costs.
- A result in the words of the task, with the name of the thing and the next action.
- The links between the drawn states, and the path back.
