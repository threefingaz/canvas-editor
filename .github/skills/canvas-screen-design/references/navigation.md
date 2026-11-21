# Navigation

Navigation is how a person gets from one screen to a different one: a main menu, tabs, a "Back" control, breadcrumbs, a step indicator, a search, links. This file is about which of these a screen has, what they say, and where they lead. The look of a link and of a current item is in [Controls](./controls.md); the words are in [Labels](./labels.md).

## The data has a structure; the person has a task

Data has its own structure: a sequence, a tree. The navigation does not have to be the same.

- **Do not make the person walk the tree.** A weather service that starts with a map of the world, then the continent, the country and the town follows the data. The person wants their town: show it at once.
- **Give more than one way to the same thing**, for different situations: the thing itself on the first screen, direct links to the usual targets, a search for a person who knows the name, the nearest things first and then wider circles (the town, the region, the country, the world), and the full tree as the last way.
- **The tree can be visible**, but it is not the only way and not the first.
- **A link is the strongest tool**: it joins each thing to each other thing and does not depend on the structure. A thing that looks like a link is a link: it can be opened in a new tab, copied and sent. In an app, a direct jump is a button or an icon.

## The main menu

A main menu is on nearly each site. Use it to say what the product is.

- **The usual items, in the usual words and places.** "News" near the start, "About" and "Contacts" at the end. They say little, but people know where to look for them and what is behind them. Use them only if such sections exist.
- **Between them, the real things.** Not "Catalogue", "Products" and "Services", but what they are: "Cartridges, paper and film", "Books, courses, advice". A menu of this type tells at one look what the company does. The menus of desktop apps do the same: the common items at the two ends, the items of this app in the middle.
- **Not each page in the menu.** A menu with each section and sub section of a large shop cannot be read; a person finds nothing in it. Make the search prominent and good, and keep the menu to the top level.
- **The meaning comes first, in one or two words.** People scan a menu. An item does not have to repeat the full title of its page: the page has the full title, the menu has the key word. Put the repeated word outside the brackets, as [Lists](./lists.md) says.
- **The item of the current page is not a link**, and it differs from the links by more than color. On a page inside a section, the item of the section is marked and stays a link: it leads to the start of the section. If the navigation component of the design system keeps the current item as a control, keep that; the mark is what matters.
- **A menu in its usual place** (the top, a side column) needs no underlines. A lone word at the top does not read as a menu. The title of a menu does not look like its items.
- **No vertical bars between the items.** Gaps separate them.

## A hierarchy

- **Do not make a hierarchy from a short list.** Nine types of transport are one list of nine. The fear of "too many items" is the myth of seven (see [Lists](./lists.md)).
- **At each step, the person must be able to choose with what they know.** "By land or by air" is clear for a train. "With fuel or with no fuel" is not: is the question about the engine, or about who fills it? The person does not know how the author sorted the things, and has to try each branch.
- A class that only the author understands is the same defect as a forced classification in [Forms](./forms.md). Name the things, or let the person search.
- **Breadcrumbs show where the person is, from the top to here.** They do not repeat the page title and the marked menu item, and they have no "Home" item: the logo leads there. Thus a page one level below a menu item has no breadcrumbs; they start at a depth of three.

## "Back" has two meanings

- **In a hierarchy, "Back" means one level up**, to the parent screen, also when the person came by a direct link from elsewhere.
- **In a history (a browser), "Back" means the screen that was seen before**, with no relation to the structure.
- **Use one meaning in a product, and do not mix them.** A usual mistake: tabs at the bottom to change the section, and a "Back" at the top that returns to the tab before. Tabs are not a history.
- **Say where "Back" leads** when the screen has space for it: "Back to the bill", the name of the parent. This is the one navigation label with a verb; other links to a place are the name of the place alone (see [Labels](./labels.md)).

## Steps

- **To design in steps is correct; to show the steps is often not.** A flow "1. Choose the ticket. 2. Confirm. 3. Pay. 4. Take the ticket" looks like a large process. The person chooses, pays and takes the ticket: no numbers, no arrows, no step indicator.
- **Show numbered steps only for a long process of many screens** (a visa form), where the person can lose their place. Then the indicator has the names of the steps, in their sequence, and marks the current one.

## A hidden menu

- **A menu behind one icon says nothing about what is in it.** It is the same as a site menu with the one word "Menu". People know the icon and have few reasons to open it.
- **Show the sections.** On a narrow screen, use tabs at the bottom for the three to five main sections. On a wide screen, show the menu.
- If some items must be hidden on a narrow screen, the most used ones stay visible.
- **A screen inside a task carries no main navigation.** While the person pays, books or fills a form, the screen has the way back and the task; the sections of the app come back at the result.

## Search as navigation

- **Search is the best way for a person who knows what they look for.** Make it prominent where the content is large.
- **Search does not replace the rest.** Often the person has no query in mind and must see what there is. A product with only a search field is correct only when the content cannot be classified at all.
- The field itself is in [Forms](./forms.md).

## Addresses

A screen on the canvas has no address, but when a design names one: the address is read by people, thus it has words and no numeric ids where a name exists, and each part of the path can be removed to get the parent ("…/posts/58" above "…/posts").

## What to draw

- The thing that the person wants on the first screen, and the tree as one of the ways.
- A menu that names the real things, with the usual items at its ends.
- The sections visible, as tabs on a narrow screen.
- A "Back" with one meaning and the name of its target.
- No step indicator in a short flow.
