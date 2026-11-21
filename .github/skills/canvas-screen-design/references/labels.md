# Labels

A label is the text on or next to a control: the title of a form, the text of a button, a link, a tab, a menu item, a checkbox, an option, a field. This file is about the grammatical form of that text and the words in it. What a message says is in [Messages](./messages.md); which fields a form has is in [Forms](./forms.md).

## A form is a sentence

A good paper form, when it is filled, reads as one connected text. Treat a form on a screen in the same way: it is a sentence with gaps, and the person fills the gaps. To write a form is to edit that sentence.

- **The title is the subject and the main button is the predicate**: "Message — Send", "Task — Assign", "Haircut — Book". The title is a noun that names the thing. The button is a verb that says what to do with it.
- **The controls between them are the other parts of the sentence**: they say which thing, to whom, how, when. A complex form has groups, as a sentence has clauses.
- **Read the form aloud with its values.** "Subscription to 'The Courier' for 2026, months 1 to 6, to 14 Harbour Lane, for Maria Kowalczyk — Subscribe." If it does not read as a sentence, change the labels until it does.
- **Do not say the thing twice.** A form "Order of a product" with the button "Order the product" becomes "Product — Order". Then replace the general noun with the real thing: the title of the book.
- **In a long form, the button repeats the noun**, because the title is out of view: "Save the filter", "Send the request".
- A good editor makes a heavy sentence short and clear. Do the same with a form that has many nested groups.

## The control is a part of the sentence

The control itself says what to do with it: a field means "enter", a checkbox means "turn on or off", a button means "press".

- **No "Click", "Press", "Enter", "Select", "Tick", "Choose" and no "Please" in a label.** "Press to buy" on a button is as empty as "Enter to see the director" on a door.
- A field label is the name of the thing ("Email"), not an instruction ("Enter your email").

## The form of each label

The part of the sentence decides the form, not a rule such as "a button has a verb".

| Control | What it does | Form of the label | Good | Bad |
|---|---|---|---|---|
| Button | gives a command | a verb, a single finished action | "Buy", "Send", "Save" | "Payment", "Order", "Saving" |
| Button | sets a status or the opinion of the person | a word that answers "it is what?" | "Done", "Spam", "Later", "I agree" | "Set the status to done" |
| Button, link, tab, icon | goes to a place | a noun, the name of the place | "Orders", "Settings", "Blog" | "Go to the orders", "Open the settings", "Read the blog" |
| Checkbox | adds a part to the sentence | a word or a phrase that the sentence reads with or with no | "by courier", "with pictures", "loud" | "Enable", "Yes", "Do not print pictures" |
| Radio button, select, toggle | one of a set of parts of the same type | each option in the same grammatical form | "by name", "by date", "by price" | options of mixed form |
| Slider | sets a property or a degree | the property; the ends named by their values | "Volume", "quiet … loud" | "Adjust the volume" |
| Field | takes each type of data | the name of the thing | "Email", "Card number" | "Enter the email", "Please fill in" |

- **A checkbox that adds a part to a sentence is a phrase** ("by courier"). A checkbox that stands alone, with no sentence around it, is a full statement of what it turns on ("Keep this card for the next bills").
- **A command and a place are different.** A press on "Pay" pays. A press on "Payment" opens the place where the person can pay. Do not write a noun on a button that acts at once, and do not write a verb on a link that only opens a page.
- **No "Details", "More" or "Read more" as the text of a link.** The same word on each item tells nothing; the title of the item is the link. See [Messages](./messages.md).
- **A link in a text is a phrase that names its target**: "Read the *February article on taxes*". Not "*click here*", and not a part with no meaning of its own ("The Courier *already wrote* about this"). If the sentence has no good phrase for the link, edit the sentence.
- **A tab is a place, not a choice.** The person looks at one area and then at a different one; nothing is chosen. For a choice that changes a result, use radio buttons or a toggle.
- **A known exception:** "New document" is used in the place of "Create a document", and people read "New" as a command. Keep such a habit of the platform.

## Checkboxes and options read in the sentence

A checkbox is not a variable with "true" and "false". It is a part of the sentence: with the mark, the sentence has that part; with no mark, it does not.

- **The options of one group answer the same question**: Which flat? "Near the metro", "by the day", "with a balcony". Play how? "Loud", "with one hand", "from the notes". Their parts of speech can differ; the question is the same.
- **Positive and direct.** "Print pictures", not "Do not print pictures". "Headers and footers", not "Turn off headers and footers". No "if not", no "in spite of".
- **Never "Enable …" or "Yes".** The mark is the "enable".
- **A lasting setting and a single action have different forms.** In the settings of a printer: "Always sort into copies". In the dialog of one print job: "Sort into copies". The person must see if the choice is for now or for each time.
- **An option reads on from the text before it.** "Sort" + "by name", not "Sort by:" + "Name". Put the preposition into the option, start it with a small letter, and remove the colon.
- **A state is written as a state, not as a command.** A line that shows the current sequence says "Sorted by price", with the current value marked. "Sort by price" there is a command that is already done.

## Words that say nothing

Some words can be removed from a label with no loss of meaning. Often the label is then clearer. But sometimes the word is a sign that the screen is organised badly, and the repair is to organise it again, not to change the word.

| Words | Why they fail | Write |
|---|---|---|
| main, general, basic, common ("General settings") | They promise a rule that separates the main from the rest. Nobody knows the rule: is my setting general or not? | The name of what is inside. No "Home" item; the logo leads there. |
| additional, other, more, advanced, system, misc ("Advanced options") | The same, and it is usually the store room for all that found no place. | A name with a meaning, also for rare things: "Access and privacy". |
| useful, important, reference, info ("Important documents") | Are the other documents not important? The whole site is "information". | What exactly is there: "Application templates". |
| articles, materials, content | Words of the editors, not of the reader. A newspaper has no section "Articles". | The subject of the texts. |
| list, catalogue, archive ("Wallpaper catalogue", "News archive") | They only say "many things". An archive also makes the person ask if the news of two days ago is in it. | "Wallpaper", "News". Old items stay in the same place, organised by year and month. |
| form, page, menu, section ("Order form") | They name the type of the thing, not its content. | What is ordered: "Pizza to your door". |
| required, must, necessary, please | The person owes nothing and can leave. A request does not help. | The gain from the answer. For a phone field: "The courier calls one hour before". |
| authorisation, session, transaction, operation, request, data, module | Words of the system (see [Messages](./messages.md)). Exact technical terms are correct only in a tool for engineers. | The words of the person: "Sign in with a password". |
| successfully ("The operation was completed successfully") | An operation that did not succeed is not completed. | What was done: "Money sent", "Roaming is on". |

## Things by their names

A general term must be unpacked by the person: they must know our classification to guess what is inside. A row of examples is continued by analogy with no effort.

- **Name the things, not their class.** Not "Products" but "Tables, chairs, cupboards". Not "Services" but "Haircut, styling". Not "Household appliances" but "Toasters, kettles, coffee makers": a person who wants a coffee grinder goes there by analogy, as they go to "Milk" for sour cream.
- **A menu that names the real things also says what the company does**, with no "About" page.
- This is the rule for the names of groups in [Lists](./lists.md), too.

## Questions and switches in a positive form

- **No negative in a question.** "Are you sure that you do not want to restore any projects? Yes / No" cannot be answered with confidence: the person cannot know that the author made the same logical steps.
- **If a question stays, its buttons are the commands**, not "Yes" and "No", and not "OK" and "Cancel": "Restore the project", "Delete the unsaved projects". Never a button "Cancel" on a question about cancelling.
- **A checkbox or a switch names the thing that it turns on**: "Send me the weekly letter". Not "Remove the mark if you do not want to get the letter", and not a switch "Turn off the automatic turn-off" in the position "Off".
- **A column of checkboxes has a heading that says what the mark means**, next to the marks and in a positive form. A list where each item is active and the mark means "hidden" is read the wrong way round.
- A negative or long label that makes people keep the default is a trick against the person. Do not write one.

## The three dots

Three dots at the end of a button or a menu item ("Save as…") say that the press does not do the named thing at once: a step that asks for more comes first.

- If the press does at once exactly what the label says, there are no dots.
- If the label is a noun that names a place ("Settings"), there are no dots: the person expects the place.
- The dots do not stand for a word that is left out.

## What to draw

- A title with the name of the thing and a main button with the verb, which read together as a sentence.
- Verbs on buttons that act, nouns on links and tabs that open a place.
- Checkbox and option labels in a positive form that read with the text before them.
- No instruction words in labels.
