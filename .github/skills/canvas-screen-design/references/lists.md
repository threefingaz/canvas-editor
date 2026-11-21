# Lists

A list is each set of similar things on a screen: orders, products, doctors, messages, the buttons of a toolbar, the items of a settings screen. This file is about how many items show, what a row carries, how the person finds one item, and how a set of functions is organised.

## The count decides the design

For a program there is one item or N items. For a person, 5, 50, 500 and 5000 items are four different screens. Find the real count before you draw; ask the user if the request does not say.

| Count | What to draw |
|---|---|
| 1 or 2 | No list screen. Show the item itself; change between two with a simple switch in the header. |
| About 5 to 10 | Each item in full. No sort, no filters, no search, no groups. |
| About 50 | One page with groups that have meaningful labels. A search field only if the person often knows the name of the item. |
| About 150 to 500 | Groups, plus one search field and an index of the groups. |
| Thousands | Search and filters next to the results, with data first. |

- A count between two rows takes the design of the lower row and adds from the higher one only what the task needs.
- The table counts items. If each row is tall (a row with its own set of buttons), the page gets long earlier: add the index of the groups when the page is longer than about three screens.
- **Do not design for N when the count is known.** A shop with seven products needs no sort control; it can grow to ten, not to seven hundred.
- **Aids for a long list show only when the list is long**: letter headings, an index, sticky group titles. With six items they help nobody.
- If the count is very different between people (most have one or two, a few have hundreds), draw the two cases as two screens.

## How much of a long list to draw

On a screen that is a picture of one state, for a list of more than about 30 rows:

- draw about 20 to 30 rows with real content, in two or more groups, thus the structure shows;
- show the real totals in the headings and the index ("2025 · 58 orders");
- choose the groups so that two or more of them fit into the drawn rows (months, when a year has 50 orders); the index can use a larger unit (years);
- end with one line for the rest, as a remark of the author (see section 5 of `SKILL.md`): "Not drawn: 142 earlier orders, from 2025 to 2023". Say in the report that the rest loads in the same list.

On a screen that operates, the list has all its rows, or loads the rest when the person gets near its end.

Do not draw hundreds of rows, and do not show 12 items when the task says 7.

## Finding an item

- **Group by a property that the person searches by**, and label the groups with it. A group is named by the things in it ("Toasters, kettles, coffee makers"), not by a class ("Household appliances") and not by "Other" or "General"; see [Labels](./labels.md).
- **Sort by meaning.** Dates sort as dates, numbers as numbers, months in the sequence of the year. A sequence by the letters of the text (13 February before 13 January, 100 before 20) is a defect. Newest first is a sequence by meaning for a history.
- **The sequence does not change with no action of the person.** A list that reorders itself by "most used" or moves an item while the person looks makes them act on the wrong item. Give fixed places for the items that the person uses most.
- **Filters go next to the results and act on them.** No form of filters before the results: the person cannot know the districts, the price level or what three stars mean there, and gets "nothing found".
- The search field is in [Forms](./forms.md).

## Portions: pages or one scroll

Content that does not fit a screen is either cut into portions that the person changes between, or moved through with a scroll.

- **Scroll is the default.** It costs nearly no effort and no wait, and the content stays whole: it can be searched and printed.
- **No pager with page numbers.** A page number means nothing: there is no reason to look for a thing on page seven, and the person must compute the page of an item. When new items come in at the top, the numbers also slide: what was on page seven is on page eight the next day. To cut a set into pages of N items is easy for a machine and useless for a person.
- **If the content needs portions, cut it by meaning**, and label the portions with it: the days of a month for questions sorted by date, the count of votes for the same questions sorted by popularity. The label changes with the sort. Portions do not have to be equal, and an empty one (a day with no questions) is fine. A mark with a meaning on some labels (the weekend days) gives one more landmark.
- **If no meaning is found, one link "Earlier" at the end** loads the next part, with no numbers.
- **Often the portions can go.** The results of a search inside one site fit one page; a pager there is a copy of the large search engines.
- **Portions fit content that is discrete by nature and fills the screen**: photos, the cards of one day, the spreads of a book that a person arranged by hand. They are moved with the same gesture as a scroll, and the next one is ready with no wait.
- **A long scroll needs landmarks and a stable place**, because a person gets lost in it and cannot return after an accidental move: an index of the groups that stays in view, marks of the important places next to the scroll bar, and the same place after a reload.
- **The best of the two:** one scrolled page that is cut into parts by meaning, each with its own look and its own address, thus a link leads to the same part and the person finds a part by how it looks.

## What a row carries

- **A row carries what the person needs to decide or act with no opening of the item.** For an order: what was ordered. For a document: the values that people look up. For an alarm: the address, the zone, the phone.
- **The value, not the name of the field.** "Valid until 14 March 2031", not a list of the fields of a passport.
- **An id alone is noise.** Show it only if the person uses it.
- **A preview in place of a general icon** where the content is recognised when small: a picture, a map, a cover. A small copy of a page of text is not recognised.
- **A number next to an item must help a decision.** "Boots 764" changes nothing. A count that says "the list is filtered" or "this is all" does help.
- **The same thing looks the same at each place**: the chosen item and the items in the list to choose from have the same parts.
- **An object that the row shows can be used there.** A contact, an address or a file with no action on it is a dead end.

A list whose rows have the same properties in columns is a table; see [Tables](./tables.md).

## Repeated words

- **Say the common part one time**, in a heading, and leave the part that differs in each item: the heading "Solutions" and the items "Trucks", "Taxis", "Buses". A type, a unit or a currency that is the same in each row goes into the column heading.
- **The part that differs comes first** in each item. In a narrow column the end is cut.
- A word stays in each row when, with no word, two values of the same weight stand next to each other and can be mixed up ("Paid €32.20" next to a button with the price of today).
- A state that changes the meaning of each row (the chosen day) is said one time for each group, in the group heading, not in each row and not only at the top of the screen.

## Rows and their actions

- **A row that can be pressed is one link** along its full width, with no hole, and it has a sign of that: an arrow or a mark at its end, and the mark of the row under the pointer.
- **Short rows are separated by gaps.** Rows of more than one line, or wide rows where the eye must go far from the name to the button, get a thin divider between them. A divider is not a sign that a row can be pressed.
- **One object, one link.** A row with many links (the topic, the section, the author) makes each press a risk. The row leads to its main target; other targets are clear, separate controls.
- **The same action in each row is an outlined button of equal weight**, and such a screen has no filled button. The action that removes is a weaker text button, away from the frequent one: at the other end of the row, or with a gap of two button heights or more.
- **A grid of many small choices** (free times, sizes, seats) has the value as the label of each button ("17:30"). A heading or a sentence next to the grid carries the command ("Press a time to book it").
- **Totals follow an action at once**: after a removal, the counts in the headings change, also while the undo is open.
- **Select first, then act**, for an action on many rows: the person marks rows, then presses the action. Not a "delete mode" that removes what is pressed next.
- **An area that scrolls sideways shows a cut item at its edge.** That is the sign that more follows.

## Sets of functions: toolbars, menus, settings

- **No limit of seven.** The idea that a menu must have seven items or fewer is a myth; it came from a test of memory, and a screen is in front of the eyes. Do not hide items in "More" to make a menu look short, and do not show a subset that changes.
- **Organise, do not hide.** Fifty items in one flat column are hard, and seven shown with forty-three hidden are worse. Make groups with gaps and labels.
- **A toolbar is not a flat row of equal buttons.** Group by the task, make the main action larger, and put rare actions out of the row.
- **No settings matrix** (each app × each option). Offer the decision at the moment when the person needs it: "never show this type again" on the notification itself.
- The menu of a site and the other ways between screens are in [Navigation](./navigation.md).

## Controls that follow a real arrangement

When controls stand for things that have a place or a sequence, arrange the controls in the same way: controls for things in a square are in a square, and names are in the sequence of the things in the picture. A tab is above its panel; a step indicator has the sequence of the steps.

## The empty and the used-up state

- **Empty:** not a blank panel. Say what will be here and give the first action. A new person meets this state first.
- **Used up:** when all is taken (no seats, no free times), say so in words, and offer the nearest thing that is free.
- **No results:** keep the query, and say what was searched.

## What to draw

- A design that fits the real count, with the real totals.
- Groups with labels in the terms of the person, and no pager.
- Rows with the values that the person needs to decide.
- Equal outlined buttons for a repeated row action.
- All items of a menu visible and grouped.
