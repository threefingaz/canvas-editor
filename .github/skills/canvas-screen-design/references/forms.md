# Forms

A form asks the person for something. People forget, count badly, mix up similar things and make typing errors; the form adapts to this, and the person does not adapt to the form. This file is about what a form asks, how a field looks and behaves, and what an error state shows. The wording of a message is in [Messages](./messages.md).

## Ask less

Nobody likes a form. To fill one, a person must think what to write and fears an error or a lost page; many leave, and those who must fill it take the shortest way and put rubbish into the necessary fields. Thus the first question is how to do with no form at all: a taxi is called with one button, with no fields for the time, the place and the phone.

Before you add a field, find where the answer is already.

- **Each field in a form is necessary; else it is not in the form.** Thus no asterisks for "required". A field that is optional is the unusual case: mark that one ("optional"), or remove it.
- **Say why you ask, in the world of the person**, in a short line at the field: for a phone, "The courier calls 15 minutes before"; for an email, "We send the receipt and the warranty". "Required" is a weak reason, and a person who sees no reason types random digits.

- **Do not ask what the system knows**: the name of a person who is signed in, the amount of a bill, the address of the last order. A screen that greets the person by name has no name field.
- **Ask for one key and fetch the rest.** An account number can bring the name, the address and the phone. Show them as found, for a check, not as empty fields.
- **Use the situation.** The place, the time, the device and the last action answer many questions. Ask only for what is left.
- **No forced classification.** Do not make the person put their thing into our categories when a wrong answer is possible. The system proposes the category from what the person entered; the person only corrects it. Ask for a plain value (an age, a price), not for a range that the system uses inside.
- **No question that the data answers**: "New or existing contact?" asks the person to remember what the system can look up.
- **When a person sets a thing up, it is on.** Do not add a second switch for "use it". A consent is different: the person decides it, thus it stays visible and its default is the safe one. To save a new card for later payments is a consent, and it is off.
- This is not a guess. If the answer is only a decision of the person, ask for it.

## A field

- **A label that stays visible.** Use the label of the field component, not its placeholder. A placeholder is not a label: when the field is filled, the label is gone, and the person cannot check a form, find the field with the error, or read a form that opens filled. Exceptions: a lone search field, and a simple pair of name and password.
- **The label names the thing** ("Appointment time"), not the current value or the default ("Nearest time"). It does not change when the value changes.
- **A field accepts each sensible form of the input.** A hint that says where to find a value ("3 digits on the back of the card") is permitted; a hint about the form of the input is not. No helper text that tells a format ("digits only", "Latin letters only", "+1 XXX…"); the program converts. Show a format only when the program truly cannot convert.
- **No conversion tables.** The person chooses the system that they know (a size system, a unit, a currency) and enters the value in it.
- **No "remember that…".** If a rule changes the choice (take one size larger), build it into the options and say it next to them.
- **A field looks like a field**: a frame or an underline, a background that differs from the page. Keep the standard form of the field of the design system; do not remove the frame to make the screen lighter. A button is not drawn as a field, and a field is not drawn as a button.
- **A check mark next to a field says only "this value is valid".** If the person can read it as "saved", move it, or save at that moment.

## Options

- **One choice or many shows in the control.** A group where exactly one option is chosen uses radio buttons; a group where each number of options is possible uses checkboxes. Do not mix the two looks.
- **A group of radio buttons has one option chosen from the start.** With none chosen, the person cannot return to the empty state after the first press.
- **The control is at the left, next to its text**, and the text is a part of the press area: use the component of the design system that joins an option with its text, not plain text next to a bare control. A checkbox at the far edge of a wide row is not connected to its text.
- **Options that exclude each other go in a column**, as radio buttons, when they are five or fewer and the form has the space. A select is the form when the options are many, or when the same choice repeats in each row of a list or a table. A select has its label as a field has.
- **A group of options has a visible name** above it, as a field has a label: "Day of the visit". A row of days or sizes with no name is a puzzle.
- **A checkbox does what a checkbox usually does.** It must not carry a strong side effect for other people or other data; that is a separate, named action.
- **Each option shows what it allows** when fields depend on each other: "Dr Abara — free at 10:30 and 14:00". The person does not try combinations until one fits.

## The sequence and the groups

- **One column.** Fields stand one below the other, thus the way to the end is clear. Do not pack fields next to each other like bricks to fill the width; a dense form of paper saves paper, and a screen has no such need. A form that looks simple at the first look is trusted.
- **The size of a field says what goes into it**: a large field for "About you", a field for a passport number as wide as the number. In a form of many fields, do not give each a slightly different width; use a small set of widths. If the design system has no widths for fields, use the columns of its grid (a half, a third); on a narrow screen, two short fields can share one row.
- **The sequence follows the habit.** No field between the name and the password.
- **Labels on a wide screen are in a column at the left of the fields**, aligned to the left edge of that column, with the first line of a label on the base line of the text in its field. A long label wraps to two lines. On a narrow screen the labels go above the fields. If the field component of the design system carries its own label, keep its placement.
- **A long explanation of an option goes into a column at its side**, and the option itself has a short label. A small picture of the result explains more than a sentence.
- **Known values as links below a field** fill it with one press (the addresses that the system knows).

- **Fields are in the sequence of their dependence.** A choice changes only what is below it. Do not offer an option that contradicts an earlier choice, unless the screen says clearly that it will change the earlier value.
- **Do not hide one field while a different one is open.**
- **Group by distance.** Fields that belong together are closer; groups are apart. A label is nearest to its own field. See [Layout](./layout.md).
- **Pair by meaning, not by symmetry.** "From" and "To" are one pair; the two dates are a different pair.
- **Do not align things that have no relation.** Two radio buttons at the left and two fields at the right, row to row, read as "this option belongs to this field".

## A search field

- **One field.** No field for each column of the database, no "search in: authors / titles", no "any word / all words / exact phrase". The field takes each of these in each sequence; the program finds what each word is.
- **No step before the typing.** If typing can only mean a search, the typing starts it. Results show from the first letter.
- **An example below the field**: a real query that the person can press.
- **A search with no results keeps the query** in the field, editable.

## The send button

- The button is the one filled button of the screen, at the end of the form, and its label is the command with its result: "Pay €34.90", "Book for 16:30". The form of each label is in [Labels](./labels.md).
- **The button and what opens it stand on one block** at the end of the form, apart from the fields: the button, and a consent checkbox if the form has one. The block shows the way to the end and separates the send button from buttons inside the form. A form of one or two fields needs no block.
- **When the button is active:**
  - a form of one field (a search, an invitation by email): always active; a press with an empty field marks the field. A disabled button there makes the whole form look not available;
  - a form of two to four fields: disabled until the necessary fields are filled. That is enough: a message "To comment, enter a comment" is silly;
  - a larger form: a line below the button says what is missing, and changes as the person fills the form: "Add the delivery address". A press on the disabled button draws the eye to that line.
- **When all is filled, the line says what happens next** if the result does not come at once: "We answer within one day, in your account". The next screen repeats it. A wait line ("Asking the bank…") takes the same place.
- **A button that takes money stays active.** If a formal thing is missing (the address, the stock), take the order and solve the thing after it; do not stop a person who is ready to pay.
- **A disabled button keeps its command as its label.** The reason goes next to it, not into it.
- A form does not reset on a timer, and a late script never erases what was typed.

## The error state

- **The input stays in the fields and can be changed.** A rejected name stays for a fix of one character.
- **The message sits at the field that it is about** and names the exact field. Not "one or more fields are empty".
- **It says the cause and the fix**, one cause, not "wrong format or file too large". Name a cause only if the system can know it; see [Messages](./messages.md).
- **First make the error not possible**: correct and convert the input, or offer a limited set of options.
- **A limit is in the label, before the error**: "Amount, from €100". If the value breaks the limit, that part of the label turns red; no second text is needed.
- **When the error is obvious, a marked field is enough**, with no text. The mark is the error color and a sign that does not depend on color (see [Access for each person](./accessibility.md)). A text such as "The passport number must have six digits" is correct and of no use. Add words only when they help: "Only for a passport of this country".
- **The message answers "and what do I do now?"** It does not judge the person: the form did not understand them. If the person can be sure that their input is correct, say whom to ask.
- **The time of an error:** not while the person types and not when they enter a field, but after they leave it. An empty necessary field is not an error at all until the person sends the form.
- **The place for a message is kept from the start**, between the field and the next thing, thus nothing moves when it shows and no popup is needed. If the design system gives a field one line for the reason and the message, the message takes the place of the reason while the error shows, and the reason comes back after.
- **A failure on the side of the system offers "Try again" with the same data.** It does not ask the person to enter the data again.
- Do not use the error color for decoration: a red frame around a correct value reads as a problem.

## What to draw

- Fields that are already filled with what the system knows; fewer fields than a usual form of this type.
- Visible labels and no format hints. The form with all fields filled; the empty form only if it differs by more than the values. A secret value (a card code, a password) is drawn as the field shows it, masked.
- The command and its result on the send button.
- An error state with the input kept and the message at its field.
- A long form: its parts in a list at the side with a mark at each part that has an error, the time that it takes, fields that show only when they are needed, and input that is saved at each moment.
