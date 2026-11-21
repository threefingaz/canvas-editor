# Finding the tokens

The inspector, the edits and the Issues list all read `tokens.json`. With no tokens, the tool can show a screen and nothing more. This file is about how to find the tokens of a library and write them in the format of the tool.

## What a token is, for the tool

The format is in `src/tokens/format.ts`. The groups are `color`, `spacing`, `radius`, `textStyle`, `shadow` and `stroke`. Each token has:

| Field | Meaning | What the tool does with it |
|---|---|---|
| `id`, `name` | a unique id (the group or the path in the source, then the step: `palette.primary.main`, `spacing.4`, `radius.2`, `shadows.1`, `typography.h2`), and the short name that the inspector shows (`primary.main`, `4`, `h2`) | shows the token |
| `value` | the resolved value. A color: hex, `rgb()` or `rgba()`. A length: px (`16px`). A shadow: the CSS text of its layers. A text style: the five parts, with the sizes in px | finds the token that is **equal** to a value on the page |
| `cssVar`, `factor` | the CSS variable behind the value, and a factor when the library writes `factor * var(…)` | proves that an element is **linked** to the token |
| `selector` | for a text style: the class of the elements that use it. It can be a selector list (`.text-button, .button`) when more than one component applies the style | the proof of a link where no one variable exists |
| `code` | how a developer writes the token in code: `'primary.main'`, `2` | the agent writes it into the screen when it applies an edit |
| `media` | optional: the values in ranges of widths, a list of `{ "query", "value" }` (see "Values that change with the width" below) | takes, in each frame, the value of the width of that frame |

Thus "where are the tokens" is three questions. Answer each one for each group.

## Question 1: where are the values?

Look in this sequence, and stop at the first that exists. Ask the user to confirm that it is the source that the product uses.

1. **A theme object** that the library exports or takes (the case of the sample library).
2. **A tokens package or file**: JSON, a module with constants, a file of style variables.
3. **CSS variables in the stylesheet of the library**: read the rules of `:root` and of the theme classes.
4. **A design tokens file of the company**, outside the library. Ask the user for it; it can be the real source.
5. **The documentation**, as the last source, copied by hand.

If the library has more than one theme or mode (light and dark, brands), ask which one the screens use. The tool reads one set of values.

**Values that change with the width.** A library can redefine a token variable in a media rule (a smaller gap below a breakpoint), or write its sizes in `rem` with a root font size that changes at a breakpoint. Then the value of a token in a narrow frame is not its value in a wide one. Write the value of the widest range in `value`, and the others in `media`: a list of `{ "query": "<media condition>", "value": … }`, in the sequence of the stylesheet. The editor takes, in each frame, the last entry whose condition holds there; a text style gives its five parts for each range. With no `media`, each value in a narrow frame shows as "no token". Read the conditions from the stylesheet as they are written (`(width < 767px)`).

## Question 2: how does a token reach the page?

Do not guess from the source; look at the page. Open the sample screen (step 7 of `SKILL.md`) in the editor, with one component of each kind (a text, a button, a card, a field), and read what the browser has:

- the computed value of each property (the color, the padding, the radius, the shadow, the font);
- the text of the declaration that set it, from the rule that wins: in the style rules of the element in the browser, or with a first token entry, in the inspector, which shows each value as linked, equal or with no token.

**First, make the library write variables.** Some libraries write fixed values until a switch is on (an option of the theme, a flag of the build, a second stylesheet). Look for it in the documentation of the library and turn it on in the wrapper: with no variable on the page, no value can be linked.

Then sort what you find:

| On the page | What it means | In the token |
|---|---|---|
| `var(--name, …)` | linked to one variable | `cssVar: '--name'` |
| `calc(2 * var(--name, …))` | a multiple of one variable | `cssVar` and `factor`, one token for each step |
| a variable of the component that holds the token variable | linked through one more step | `cssVar` of the token; the tool follows the chain when the rules of the element, or the rules of the root element (`:root`), declare it |
| a class that marks the use (`.text-body`) | a link with no variable | `selector` |
| a fixed value (`16px`, `#1f4fd8`) | no link is possible | no `cssVar`; the tool shows "equal to a token" |

Text styles are the hard group: a library often writes five separate declarations with fixed values and no variable. Then the `selector` is the only proof. The editor tests the selector on the element and on its parents, because a text style is inherited: when the library sets its base text style on `body`, put `body` into the selector of that style, or each text that inherits it shows as equal, not linked. If the library has a variable for a text style but its components do not use it, do not write it as `cssVar`; use the `selector`. A link needs all five parts equal (family, size, weight, line height, letter spacing).

If the library writes fixed values everywhere, the tool still works, with less: each value shows as equal, not linked, and a local override cannot be told from a token. Tell the user; it is a property of the library, not a defect of the setup.

## Question 3: how is a token written in code?

Find the form that a developer writes at the place of use, for each group: a prop and its value, a path into the theme, a number of a scale, a class name, a variable. This is the `code` of the token.

Find also the sequence for an edit: a prop that the component has for the change comes first; if there is none, the override that the library itself offers at the place of use. If neither exists for a group, an edit of that group cannot be applied, and the agent replies `needs-library-change`. Note it.

## Which values are tokens

- A scale that takes each number (a spacing factor): offer only the steps that the product uses (question 5 of step 1 in `SKILL.md`).
- Internal values of single components are not tokens.
- A value that is a part of other values (the channels of a color) is not a token.
- A level that means "none" (a shadow of level 0) is not a token.

## Write the extraction

- **The source is code** (a theme, a module): write `packs/<name>/library/tokens.ts` with `export function tokens(): Token[]`, which turns the source into a list of tokens. It may also be `async` and return `Promise<Token[]>`, when the source must be read first; the script waits for it. `npm run tokens` (`tools/build-tokens.ts`) imports this entry by its path and checks the list with `parseTokens`; do not change the script. The entry must **fail with a clear message** when the library writes a value in a form that it does not know; a silent wrong token is worse than an error.
- **The source is a stylesheet**: the same, with a small reader of the variables. The entry runs in Node: read the file with `node:fs`, relative to the entry (`new URL('…', import.meta.url)`).
- **The source is the documentation**: write the list by hand in the entry, in the format, and say in your report that it does not follow the library by itself. `tokens.json` itself is written by the script; do not write it by hand.
- **Record what you found** as a comment at the top of the extraction: for each group, how the library writes it on the page and in code, and the date. The next person, and the library skill, read this.
- **Tests** in `packs/<name>/library/`: `parseTokens(JSON.parse(formatTokens(tokens())))` is equal to `tokens()`; the ids are unique; each group that the library has is not empty.
- The dev server writes `tokens.json` again after each change of a code file in `packs/<name>/library/`; with no dev server, run `npm run tokens`.

## Check the result

Open a sample screen in the editor and select elements (step 7 of `SKILL.md`). For each group:

- a value that the screen takes from a token shows as **linked**;
- a fixed value that is equal to a token shows as **equal**, with the offer to link it;
- a value that is no token shows the **nearest** token.

If a value that you wrote as a token shows as "no token", the token has a wrong `value` or a wrong `cssVar`: read the page again.

## What to report

For each group: the source, the count of tokens, if a link is possible or only a match, and the form in code. And each group that the library does not have.
