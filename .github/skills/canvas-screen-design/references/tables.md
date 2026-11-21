# Tables

A table shows things in rows and their properties in columns. The row is the unit of meaning: the eye must hold one row together and go down one column. This file is about the width, the alignment and the look of a table, its headings, repeated data, its structure, and a table on a narrow screen. A list of rows with actions is in [Lists](./lists.md).

## The three main rules

1. **Do not stretch a table to the full width.** Treat it as a picture: it has a natural width, the smallest at which its data fit with comfort. Extra width becomes gaps between the columns, and the eye loses the row. Small gaps stay, thus the columns read as columns. This does not conflict with a layout that follows the window: you do not stretch a photo of a person either.
2. **Align each cell to the top and to the left**, the headings too. No centered headings; no number that sits at the middle or at the bottom next to a text of three lines. Make this the default for each table of the product.
3. **No grid, no stripes, no frames, no backgrounds** (one exception: a pale background on a group of rows that the text next to the table names; see "Parallel views" in the skill `canvas-information-display`). When the cells are aligned to the top and the left, the data make the grid by their own places. A bold heading row and one line below it are enough, and a small table reads with no heading line at all.

If the table component of the design system draws lines or places the content of a cell (to the middle of its height) in its own way, keep that (see section 4 of `SKILL.md`). Add nothing more: no extra lines, no striping, no frame, and no right or center alignment by habit.

The width is layout, not look: a table component that fills its container goes into a container of the natural width of the table. Check the result: if the gap between two columns is wider than the columns, the table is too wide.

## Numbers

- **Numbers that the person compares are aligned by the decimal point**, thus 50 looks much larger than 0.0004. Start from the left alignment and move only the numbers that need it.
- **No right alignment as a rule.** It lines up the digits only by chance, when each number has the same count of decimals.
- **If the design system cannot align by the decimal point**, write each number of a compared column with the same count of decimals and align the column to the right, with digits of equal width; the heading of that column is then also at the right. Tell the user. Columns that are not compared stay at the left.
- **A column is compared when the person reads down it to find the largest, the smallest or a change.** A column that the person only looks up (an id, a year, a phone) is not.
- **Numbers of a different nature stay at the left**: 105 inches and the year 2015 are not compared.
- **Numbers are compared more easily one below the other** than side by side. Put the values that the person compares into one column.

## Headings

A heading is often longer than its data and pushes the table wide.

- **Wrap it to two lines, or make it shorter.** Never turn a heading to the vertical: the person has to turn their head.
- **Join columns under one heading**: "Name and result" for three columns that are read together. A word that repeats in a number of headings goes into a level above them.
- **An explanation goes before the table**, in the text: with it, "Limit and stop levels" can become "Levels". No footnotes with asterisks below the table: the person jumps down and back, and often does not know that a note waits there.
- **A short form with the full name in a hint** is permitted for a table that people use each day.
- **The heading row stays in view** when a long table scrolls.

## Repeated data

- **The common part goes outside the brackets**: into the heading or into the text before the table. The table is then more compact, and more data are in view.
- **The level of a unit:** if all numbers of a row have one unit, the unit is in that row; if all numbers of a group have it, it is in the heading of the group; if the whole table has it, it is in the heading of the table. A unit is not a column of its own.
- **A short unit can repeat at each number** in a long table (°, %, €), thus the eye does not jump to the heading. A long one ("kg/m³") stays in the heading.
- **How the table is used decides:**
  - a reference table, where a person finds one value (a forecast, a result of one person): all that they need is at the point where they look. Equal values are written in full in each row: "+20", "+20", "+20". No dashes and no "the same" marks;
  - a table for comparison, where the person looks at the whole: more can go outside the brackets.
- **A sub heading inside the table** carries the common part of a group of rows ("Euro" above the rows "to the US dollar", "to the Swiss franc"). It sits tight to its first row, as a heading of the third level sits on its text.
- **More space between groups of rows** than between rows.

## Each column has its own look

In a table that people use often, give each column a form that tells what it is with no look at the heading: the place in bold, a number drawn as a badge, a name as a link, a time with its separators ("+1:24.5"), a share with "%", a change with an arrow ("4 → 3"), a color for one group of columns. After some visits the data speak for themselves.

## The structure

Before you style a table, check what is in it.

- **The sequence of rows and columns follows the use**: what the person compares stands next to each other, and best one below the other.
- **The rows are in the sequence of the question.** If the person looks for the worst, the worst is first. A table that fits in view has this one fixed sequence and no sort control; a sort by a press on a heading is for a table that people read with more than one question.
- **A bad value is marked, a good one is not**: the error color of the design system and a word next to the value, on the bad direction only. A value that is not a change is bad only against a reference that the screen names; see "A value against a reference" in the skill `canvas-information-display`. Which direction is bad depends on the measure (a fall of revenue, a rise of complaints); where neither is bad, mark nothing. Green on each good change makes a table of two colors where nothing stands out.
- **A total is a sentence before the table**, not a last row, unless the person checks that the column adds up to it.
- **Take out what does not depend on the rest.** Two values that are the same for each row are not a column; they are a line of text before the table. This can split one table into two smaller ones.
- **Turn the table** when the headings take more space than the data: rows become columns.
- **Join two columns into one** with a heading of two levels, when one of them is empty in most rows.
- **Repeat a short thing to remove a long one**: repeat the years in each block, and remove a tall heading that was repeated.
- **Tables of the same type have the same structure.**
- **Prefer a rule that an editor or a program can apply to each table** (as the rule of units above) to a design made by hand for one table.

## A table on a screen

- **No pages.** A long table scrolls. Only tens of thousands of rows need a different way; see "Portions" in [Lists](./lists.md).
- **A long value wraps to two lines** in its own cell, and does not push the columns of all other rows apart.
- **In a table of many rows and columns, the row under the pointer is marked**, to hold the row together, and a press marks a row; marked rows stay in view at the top while the table scrolls, thus the person compares them with the rest. A small table that fits in view needs neither: there, a mark under the pointer would say that a press opens something.
- **The heading row stays in view** only when the table is longer than the screen.

## On a narrow screen

- A sideways scroll of the whole table is possible, but the person can no longer compare and see the whole.
- **Better: each row becomes a compact block of a few lines**, with its own inner arrangement: the main value in bold at the start, the second value below it in a weaker style, the small marks (a date, a state) in the corners. A mail list on a phone is a table that was changed in this way.
- **The value that the person compares keeps its own place in each block** (a corner, the end of the first line), thus it still reads down the screen as a column. The other values can go into one line.
- Rows as blocks are still a table: this file is their home, not [Lists](./lists.md). Rows of more than one line get a thin divider between them.
- **The blocks have no heading row**, thus each value says what it is: a word in the block ("3,412 orders"), or one sentence above the list for the value in the fixed place.
- The same block form is also good on a wide screen, as a narrow list next to the detail of the chosen item; see "The zones of a screen" in [Layout](./layout.md).

## What to draw

- A table of its natural width, with cells aligned to the top and the left.
- No vertical lines, no stripes, no frame.
- Short headings in one or two lines, and the explanation before the table.
- Units in the heading of the table, of the group or of the row, by the rule.
- Compared numbers one below the other, aligned by the decimal point.
- On a narrow width: rows as blocks of a few lines.
