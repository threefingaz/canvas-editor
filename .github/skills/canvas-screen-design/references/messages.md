# Messages

A message is each text with which the product speaks to the person: an error, a notice, a question, a status, an empty state, a title. This file is about where a message shows, what it says, and which words it uses.

## Where a message shows

A window that the person must close in order to continue teaches them to close windows with no reading. After that, the product cannot tell them anything.

- **A message sits at the thing that it is about**: at the field, in the row, next to the button.
- **A notice is seen, not heard.** A sound with a notice only when the person must act now and may not look; see [Sound](./sound.md).
- **A notice that is about no one thing shows at the side** or in a status line, where the person sees it and continues to work. It stays until the person dismisses it; it does not go away on a timer.
- **A question or a permission request is a panel that does not block**: the page under it scrolls and takes presses. Prefer an inline message, a panel at the side or a passive bar over a modal dialog, also when the design system has a dialog component.
- **A blocking dialog only when the product truly cannot continue with no answer.** Tell the user where you used one. Content (a detail, a form, a set of options) never goes into a popup; its place is in [Layout](./layout.md).
- **No welcome screens, tours or "what is new" windows over the product.** The person opened the product to do a thing. Put news in a place that they can open later, or show a hint next to the new thing at the moment of its use.
- **A screen that tells is not drawn as a dialog that asks.** If the action is already done, a filled button in a dialog is pressed as "yes" and does the opposite. Draw a passive line with "Undo".
- "Do not show this again" is not a solution: the person then loses the message.

## What a message says

- **What happened to the thing of the person, and what they can do.** In the words of the task.
- **Name the thing one time in each block of a screen.** After the heading "Card: Visa ending 4821", the message below it can say "the card". The rule against "this" is for a text that stands alone: a dialog, a notice, a message that can show at each moment.
- **The name, not "this".** The words "this", "current", "given" and "selected" in a message are a sign of a defect: "this folder", "the current operation". Write the folder "Reports 2026". "File not found" says which file.
- **The product and the subject.** A dialog or a notice that can show at each moment names the product that speaks. A question that comes later than the action that caused it carries the full subject, because the person did not just do the action.
- **No words of the system**: no state names, transitions, codes, modes, sessions or sync. Not "The operation was successful", not "Error 4012". The words to avoid are listed in [Labels](./labels.md).
- **A status word has a meaning.** "Stopping…" for a thing that can stop at once says nothing true; if a different process started, name that process.
- **A sentence has one speaker.** Text of the system ("You probably need …") does not hold buttons with which the person speaks ("I need …").
- **A question has answers that the person can understand**, in a positive form, with the commands on the buttons and not "Yes" and "No"; see [Labels](./labels.md). If only one answer is sensible, do it and do not ask.
- **Do not show how the mechanism operates.** A limit of the technology ("active on one device only") is not a question for the person: the device in their hand is the answer.

## Text that a machine put together

A program makes text from templates: a general list that knows nothing about its items, a string built from a label and a value. The result is the language of a robot, and people learn to decode it. It must be the other way round. On a screen that you write, each text is written for its one case.

- **The text names the real thing, not its general type.** An empty list of unread mail says "No new mail", not "There are no items to show in this view". A city is "City: Kyiv", not "Region: Kyiv". Words such as "item", "object", "element", "entry", "record", "view" and "region" come from the data model.
- **A sentence, not parts joined by a colon.** A colon lets the author glue each thing to each other thing and accept the result.
  - "5 documents found", not "Documents found: 5".
  - "Sort by recipient", not "Sorting: To".
  - "Visitors of the site, summary", not "Site traffic: summary (visitors)". If a title cannot be read aloud with no naming of its punctuation, write it again.
- **The words agree with the number and the value.** "1 order", "2 orders"; "in 1 day", "in 3 days". Never "1 order(s)" or "Orders: 1". In the content of a screen, write the form that fits the value that you show.
- **A value inside a sentence takes the form that the sentence needs**: a name, a language or a date is written as a person would say it there, not pasted in its dictionary form after a colon.
- **Remove the case that the template did not expect; do not explain it.** A map of television standards does not need "no data" for the continent where nobody lives: leave the continent out. A category "Not recognised / unknown" with zero percent has no slice and no line in the legend. A dialog that asks about cancelling and has the buttons "OK" and "Cancel" is the wrong template: do not add a sentence that explains the buttons; write the two commands on them.
- **The same text on each item is noise.** A "Details" or "Read more" link below each news item says nothing and cannot tell the items apart. Varied forms ("Learn more", "Continue reading") are worse: the person reads them all to find that they mean nothing. The title of the item is the link, and the word goes out.
- **Do not make the person speak the language of the machine**: to write a name in a fixed form so that the program finds it, to type a code in an exact format, to answer "Are you a person?" with a string of random letters.

## An error message

- **The exact cause and the fix**, one cause. Not "one or more fields are empty", not "wrong format or file too large": the program knows which.
- **Name a cause only if the system can know it.** If a third party gives no cause (a bank that declines a card), say that, give the fixes that are probable, and say who can tell the cause. Do not invent a cause.
- **Say what is safe**: "No money was taken", "Your internet works until 30 November".
- **After a failure of a third party, the main action is the one that most probably helps.** If you do not know which, say so in the report; for a declined card, "pay with a different card" and "try again" are both offered, and the user decides which is the main one.
- **Never ask the person to do what the program can do**: to reformat an input, to check a thing that the program can check.
- **A message does not state what the person knows to be false.** "The server does not exist" for a well-known site, "No such country" for a real country: the person then trusts no message. Say what the program could not do: "No connection to the internet", "We do not deliver to this country yet".
- **"The operation failed. The object was not found." says nothing**: which operation, which object, and what now? No error numbers in the place of the cause.
- **Each button of an error says what it does to the thing of the person.** A default button with an unclear name that deletes the new entry is the worst case.
- **A system failure offers "Try again" with the same data.**
- The error state of a form is in [Forms](./forms.md).

## Offers that destroy

- **Do not offer to discard what cannot be made again**: "Start from the beginning?", "Clear the history?", "Delete this recording?" as a prompt of the system. The person removes things when they decide to.
- Do not draw a prominent "Empty" action that pushes the person to destroy the copies that can be restored.

## Titles and subjects

- **The title of a message or a notification carries the fact**, thus the person does not need to open it: "Gate B14, boarding at 18:40", not "Dear Maria, information about your flight".
- **No text that says what the person knows**: their own name in a message to them, "Welcome", the word "page" on a page.
- **Each screen and each dialog has a title that names the thing and the subject.**
- **A first page that presents a product says in plain words what it is and what it does**, at the top. A slogan and a menu of "Products" and "Technologies" do not answer.

## Empty states

- **An empty list or view is not a blank panel.** It says what will be here and gives the first action.
- **"All is taken" is said in words**, with the nearest thing that is free.
- **A waiting state says what the person waits for and what will happen.** See [Flows](./flows.md).

## Color and marks in a message

- **Red is an error, a danger, a stop. Green is success, done, safe.** Do not use red for good news or for "act now", and do not use green for "wait". Use the status colors of the design system for their meaning (error, success, warning), not for their look.
- **A status is correct for a person who reads only the color.** If "ready" and "not ready yet" have the same color, the person acts on the color.
- A brand color that is red or green needs care next to statuses.
- **A status or a badge does not look like a button**: a different shape, a weaker fill, or plain text.
- The inline message component of the design system is the form of a message at its thing. A result of the whole screen (paid, booked) is plain content with a heading, not a colored strip across the page.
- If the design system has no icons, use text and the components that carry their own marks. Do not assume icons.

## Meanings that nobody intended

Parts that are each correct can say a wrong thing together. Nobody intends it: it comes from a template that meets real content, or from two things that land next to each other.

- **A general text that meets a real value.** "Tchaikovsky announced new gigs near you": the template knows nothing about a composer who died long ago, and "gig" does not fit a concert of classical music. A menu of line spacings "1.0, 1.5, 2.0, 2.5, 3.0, More…" reads "More" as a larger value, not as "other values". Read each general text with the real values that it will get, also the unusual ones.
- **A mark of the interface that reads as a mark of the content.** A menu item "Index of investor trust" in the red brand color with an arrow down (the sign of the open item) says that the trust falls. A "You are here" label above a heading is read with the heading. A status next to a name reads as one phrase.
- **A reaction control that does not fit the content.** "Like" under news of a death, "0 people like this" under a tragedy. A general control for reactions needs wording that fits each content, or is left out for such content.
- **A service text next to its opposite.** A notice about respect for privacy on a page about a leaked private video. A quote of the day in a box that shows a connection error.
- **Neighbors on the page.** A picture and a headline that are not related are read together, and an advertisement with a cheerful slogan next to bad news is the usual case. Where content from a different source can stand next to yours, look at the two together.
- **A repeat or a crop that makes a new word or shape.** A name set as a pattern reads as a different word across the line breaks. A picture behind a slot or a fold gets a new part.
- **A shape that looks like a different thing.** If one person sees an unwanted thing in a picture or a sign, each person will after they are told, and it cannot be unseen. Do not wave such a remark away.

How to catch these:

- **Work with real content, in the real place.** This is why the floor asks for real and awkward content: placeholder text hides each of these collisions. With no real text yet, write a likely one; do not use filler.
- **Look at a part in its surroundings**, not alone on white: a banner on the pages where it will run, an icon in its toolbar, a notice on the screen under it.
- **Read the screen as a stranger**, and read each text together with what is above it, below it and at its side. Then read it with the worst content that it can meet: an error, a death, an empty value, a zero.

## What to draw

- Messages at their things, and notices at the side; no blocking window.
- The name of the thing in each message.
- An error with one cause that the system can know, the fix, and what is safe.
- Titles that carry the fact.
- An empty state with the first action.
