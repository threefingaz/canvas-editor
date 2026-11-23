---
name: canvas-information-display
description: How to show data on a screen so that a person can read it and is not misled, when you create or change a screen in `screens/`. Read this skill each time a screen has a chart, a graph, a diagram, a map, a row of key numbers, numbers that the person compares or follows in time, results of a survey or a report, or a comparison of two or more things (plans, products, versions, before and after), and when the user asks to visualise data or to make a dashboard. It holds for each design system and needs no chart library. For the screen around the data (flows, forms, lists, tables, messages), read `canvas-screen-design` too.
---

# Information display

A person who knows how to show information can explain a complex idea, help to find a pattern in confusing data, or mislead. This skill is about the first two. It gives the decisions before the code: what form the data get, what the picture must carry, and what it must not do.

It names no component and no chart library. A chart needs no library: build it from the plain parts of the design system, with each size computed from the data, as [Building a picture of data](./references/building-charts.md) says. If the project has a chart component, use it. In the two cases, the rules of this skill hold: when a default goes against a rule of honesty (a pie, a 3D effect, a smoothed line, a legend), the rule wins, because it is about the meaning and not about the look.

Use this skill together with `canvas-screen-design`, which covers the screen around the data. Give one reply for the two: the task and the question together at the start, and one report at the end.

## 1. Before you draw

Add these to the three items of `canvas-screen-design` at the start of your reply. The question is the task of that skill, seen as a question to the data: write the two as one item.

1. **The question** that the person asks of the data, with real values: "Which of my 12 bakeries sold less in October than in September?"
2. **The data**: what was measured, in which unit, for which time and place, how it was counted, and where it comes from. If you invent sample data, say so.
3. **The answer** that the screen must give at one look, in one sentence.

Choose the simplest form that carries the answer: a sentence for a few numbers, a table for values that the person looks up or ranks, a chart only for a shape or a relation.

## 2. The floor

These rules hold for each picture of data.

- **A chart shows numbers.** Its axes have a name, a unit and values. A picture with the shape of a chart and no numbers behind it is an illustration that pretends; do not make one.
- **A chart has an author and a source**: who made it, where the data are from, how they were collected. In a product, a caption with the source and the date of the data. Invented data are marked as a sample, with no made-up source. The prices and terms of the product itself need no source.
- **Each size of a mark is computed from its value**, in the file, not typed by hand.
- **The shape agrees with the numbers.** A bar that is two times as high stands for a value that is two times as large. Equal intervals are drawn equal.
- **Bars start at zero.** If the range does not include zero, draw no filled bars and no base line: let the line hang free.
- **No pie charts, and no 3D.**
- **A line joins only points between which values exist.** A value for a period (a day, a month, an event) is a bar as wide as its period.
- **Each aid is weaker than the data**: a grid, an axis or a frame is thinner and paler than the line and the digits, or absent. No decoration inside the area of the data.
- **No legend.** Each line, bar and part has its name on it or next to it, and no label shows only on hover.
- **Each number says what it counts**, and a number that is meant as large or small has its reference next to it: compared with what. "Market share" with no unit, year and country says nothing.

## 3. The parts

Each row names a file and, after the colon, the sections to read. Read the sections that match, before you draw; "all" means the whole file.

| The screen has | Read |
|---|---|
| data to show, before a form is chosen | [The choice of the form](./references/format.md): The ladder |
| a few key numbers, tiles of numbers, a summary | [The choice of the form](./references/format.md): A sentence |
| a ranking, or bars in the sequence of their value | [The choice of the form](./references/format.md): A table |
| several kinds of data about one thing or one time | [The choice of the form](./references/format.md): A visualisation that joins several kinds of data |
| an explanation of a process, an animation, a video | [The choice of the form](./references/format.md): A thing to play with |
| a board or a display that is read from far | [The choice of the form](./references/format.md): The medium |
| a chart that a tool made with its defaults | [The choice of the form](./references/format.md): The usual defects of a default chart |
| a chart of each type, to build it | [Building a picture of data](./references/building-charts.md): Each size comes from the data · The parts of a chart · Which forms can be built · Access · Sizes and the token check |
| a plan, a floor, or the size of a thing drawn to scale | [Building a picture of data](./references/building-charts.md): Each size comes from the data · A picture to scale · Access · Sizes and the token check<br>[Comparisons](./references/comparisons.md): Compare with a thing that the person knows |
| key numbers on a dashboard | [Building a picture of data](./references/building-charts.md): Key numbers |
| a value that is marked as good or bad: an agent, a shop, a day against a goal | [Building a picture of data](./references/building-charts.md): A value against a reference |
| sample data that you invent | [Building a picture of data](./references/building-charts.md): Sample data |
| a chart of each type | [Honest charts](./references/honest-charts.md): Numbers and a source · The scale<br>[Clutter](./references/clutter.md): The share of ink that carries data · Remove the aid, then give back the least |
| a chart, a diagram or a plan with more than one series or part | [Labels on data](./references/labels-on-data.md): A legend costs twice · Label the thing where it is |
| a legend, numbered parts, labels on hover | [Labels on data](./references/labels-on-data.md): Label the thing where it is · No labels that show on hover · When a code stays |
| a picture that must stay untouched; a plan of a building | [Labels on data](./references/labels-on-data.md): Arrange the labels as the things |
| a map or a plan with many named things to find | [Labels on data](./references/labels-on-data.md): An index is not a legend |
| colors, symbols or marks that carry a meaning | [Labels on data](./references/labels-on-data.md): When a code stays |
| a picture with a text that explains it; references to figures, notes | [Labels on data](./references/labels-on-data.md): "This" in the place of a code |
| a value that is called large, small, good or bad; a key number | [Comparisons](./references/comparisons.md): Give each value a thing to compare with |
| a size, a distance or an amount that is hard to imagine | [Comparisons](./references/comparisons.md): Compare with a thing that the person knows · A comparison can lie better than a chart |
| two or more things shown side by side; areas on a map | [Comparisons](./references/comparisons.md): Compare the things themselves · A comparison can lie better than a chart |
| two plans, products or versions that are nearly the same; before and after | [Comparisons](./references/comparisons.md): Finding the difference in things that are nearly the same |
| data with more than two dimensions (a place, a time and an amount) | [Many dimensions](./references/dimensions.md): Give each dimension its own means |
| a chart drawn in the shape of its subject, or with figures and scenery | [Many dimensions](./references/dimensions.md): The eye completes a flat picture · Do not dress data as a scene |
| a plan of a building, of floors or of a station; a route | [Many dimensions](./references/dimensions.md): Drop a dimension |
| the same block for each day, project, country or item; a grid of tiles with data | [Repeated elements](./references/small-multiples.md): Fix the design, change the data · When it fits, and when it does not |
| more than four series on one chart | [Repeated elements](./references/small-multiples.md): A small chart for each thing |
| units placed on a map, along a path or in a structure (a bracket, a calendar) | [Repeated elements](./references/small-multiples.md): The place of a unit can carry meaning |
| a collection or a gallery of similar things | [Repeated elements](./references/small-multiples.md): A set draws the eye |
| a map, a plan or a dense diagram with more than two kinds of things | [Layers](./references/layers.md): The three groups of layers · Tune the layers against each other |
| a value shown over an area (a heat map, a weather map) | [Layers](./references/layers.md): Tune the layers against each other |
| "You are here", a marker of the own position, a link from a place to a list | [Layers](./references/layers.md): A layer that is not a part of the picture |
| a search, a filter or a selection on a map or a plan | [Layers](./references/layers.md): Layers that change with an action |
| a picture with a text that names its colors; signs in two languages | [Layers](./references/layers.md): Text that belongs to a picture · Two languages |
| a diagram of nodes and links: a network, a route map, a process, the parts of a system | [Schematic diagrams](./references/schematic-diagrams.md): One question turns the values round · Leave the geography · Light marks for the common case |
| a transit or route map of a real place | [Schematic diagrams](./references/schematic-diagrams.md): all |
| numbers in a text and the same numbers in a table; results of a survey or a report | [Parallel views](./references/parallel-views.md): Not a repeat · A block built for the data |
| a legal or hard text; an original with its readable form | [Parallel views](./references/parallel-views.md): Two versions of one content |
| one thing shown as a map, a line, a table or a timeline at once | [Parallel views](./references/parallel-views.md): Several views of one thing · Parallel views that move together |
| one number, or a table in which each column has one value | [Clutter](./references/clutter.md): The share of ink that carries data |
| a diagram or a map with more than one type of object or state | [Clutter](./references/clutter.md): Do not spend strong means on weak things |
| a grid, frames, fills or dividers in a picture of data; tiles of numbers on backgrounds | [Clutter](./references/clutter.md): Marks make marks that you did not draw · Remove the aid, then give back the least |
| an illustration, pictograms or a background in a picture of data; a sheet of key numbers | [Clutter](./references/clutter.md): Data need no decoration |
| shares of a whole | [Honest charts](./references/honest-charts.md): No pie charts |
| values in time; a line chart or bars | [Honest charts](./references/honest-charts.md): Lines and bars · Intervals |
| two series in one picture | [Honest charts](./references/honest-charts.md): Two series |

To add guidance: put a rule into the section of its part. A new section gets its name into a row of the table; a new file is only for a part that has no file.

Before each picture of data, ask what in these data would surprise or interest the person, and build the picture around that. If nothing would, look for different data, or write one sentence.

## 4. After you draw

Look at the picture as a person who wants to be misled would, and then as one who wants to check it:

- What does the shape say with no look at the numbers? Is that what the numbers say?
- Can the person find who measured what, when, and in which unit?
- Does a different scale, a different interval or a different chart type give a different conclusion? If yes, the data do not carry the conclusion; show the data plainly and let the person conclude.

Then add to the report of `canvas-screen-design`, in about 6 lines more (thus about 16 lines for the two skills, with the items of the two sections 1 not counted): the answer that the screen gives, the source of the data (or that they are invented), each choice of scale, interval and form that changes how the data read, the charts that you built by hand and which chart you could not build, and that the computed sizes show as values with no token.
