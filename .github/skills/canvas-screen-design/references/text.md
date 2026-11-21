# Text pages

A text page is a screen whose main content is running text: an article, a help page, a guide, a description of a product, a long explanation inside an app. This file is about headings, the width and the spacing of text, lists inside a text, links, and pictures. The words on controls are in [Labels](./labels.md); spacing in general is in [Layout](./layout.md).

## Headings

- **One heading of the first level: the name of the page**, at the top, the largest text of the page.
- **A lead paragraph** can follow it: one paragraph that brings the reader in, a little larger than the body text if the design system has such a style.
- **Two or three levels are enough.** A fourth level says that the text is too complex: make the text simpler. Legal and technical texts are the exception, and there the headings also get numbers.
- **Levels differ by more than size.** If the levels differ only by size, a reader who meets a heading in the middle of a long text cannot tell its level, because there is no second heading next to it to compare. Give each level its own sign: size, weight, small capitals, color, or its place.
- **The third level is the body size in bold**, on the line spacing of the body text, with no extra space below it. The paragraphs after it are read as its text. If the design system has no such style, use its smallest heading style.
- **More space above a heading than below it.** Then the heading belongs to its own text and reads as the start of a new part, also at a look from far, before a word is read. A heading in the middle between two paragraphs looks like one more element of the text: a quote, an example, a formula.
- Use the text styles of the design system for the levels, and keep the heading level of the document correct when a style and a level differ. Do not set sizes by hand.

## The width and the spacing of text

- **One article is one page.** Do not cut a text into pages of some paragraphs each: the reader waits at each page, cannot search the text, and cannot print it. See "Portions" in [Lists](./lists.md).
- **A line has a comfortable length.** If it is too long, the eye loses the start of the next line; if too short, it jumps too often. The value depends on the font, the size and the line spacing.
- **On a wide screen, the text column has a largest width** and stops growing: about 70 to 90 characters in a line. The comfortable length decides, not a share of the window.
- **On a narrow screen, the text takes the full width**, with only the side gutter.
- **Paragraphs are separated by a vertical gap**, smaller than a full empty line.

## Lists inside a text

- **A list is a set of parts of one sentence.** Its items answer the same question and have the same grammatical form; they are not a heap of fragments.
- **A lead-in comes before a list**: a paragraph that ends with a colon, or a heading. The question to the items comes from it. The list and its lead-in together read as one sentence.
- **The gap between items is larger than the gap between the lines of one item**, when an item can wrap. If each item is sure to fit one line, the items need no extra gap.
- **The gap after the lead-in is not larger than the gap between items**: the first item belongs to the lead-in.
- **The marker and the punctuation go together:**

| Items | Marker | Each item |
|---|---|---|
| each is a full sentence, or the sequence matters, or the text refers to them later | a number with a full stop: "1." | starts with a capital letter, ends with a full stop |
| short parts of one sentence, with a sequence | a letter or a number with a bracket: "a)" | starts with a small letter, ends with a comma or a semicolon; the last one ends with a full stop |
| short parts of one sentence, no sequence | no marker, only an indent; or a dash | the same as above |

- **No heavy round bullets.** A bold dot is stronger than the text next to it and reads as a blot. A plain list with an indent is enough; do not add a bullet icon.
- A short list of the second type can stand in the line of the text: "check a) the form, b) the sequence, c) the need".

## Tables inside a text

A table in a text is an illustration: it keeps its natural width and does not stretch to the width of the text. The rules are in [Tables](./tables.md).

## Links in a text

- **The standard look: the link color and an underline.** The shade can be your own. A visited link has a different, weaker color. A link changes its color under the pointer.
- **If you leave the standard, know why**, and check what tells the person that this is a link; see [Controls](./controls.md).
- **A link that does not open a page says so.** A link to a file has the type and the size next to it ("PDF, 2.4 MB"): the person decides if they can open it and if it is too large for a mobile connection. A link that starts a mail program is the address itself.
- **A phone number is written in groups of digits.** Brackets mark a part that can be left out; a mobile number has no brackets.
- A term that needs an explanation gets it in the margin or in a hint, not in the line.

## A grid and pictures

- **Align the parts of a page to one set of columns.** For example, with twelve columns: the body text takes seven, a picture takes nine, two pictures side by side take a half each.
- **Give a picture as much width as you can.** A picture of the size of a stamp inside a narrow fixed column cannot be read. Do not put the content into a narrow box in the middle and fill the rest with a background.
- **A caption is aligned to the left edge of its picture** and is nearer to it than to the text below.
- **A fixed gutter keeps neighbors apart** when the page gets narrow: text and a picture never touch.

## What to draw

- One page title, and levels of headings that differ by more than size.
- A text column with a limit of width on a wide screen and the full width on a narrow one.
- Headings with more space above than below.
- Lists with a lead-in, no bullets, and the punctuation that fits the marker.
- Links with the standard look, and the type and the size at a link to a file.
- Pictures as wide as the page permits.
