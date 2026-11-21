# Building a picture of data

A chart needs no chart library. It is a few shapes whose sizes and places come from numbers. This file is the home of a chart that you build; you need not read the files on a new control or part in the skill `canvas-screen-design` for it, but name the chart in your report as a part that the design system does not have. This file is about how to build one from the plain parts of the design system so that it obeys the other files of this skill, how to place numbers that stand alone, and what a person who cannot see the picture gets.

If the project has a chart component, use it, and check its output against the same rules: remove its legend, its 3D look and its smoothing.

## Each size comes from the data

- **Compute, do not draw by eye.** Keep the values in an array in the screen file. When two or more screens show the same data (two widths, two states), keep the arrays in one plain data file with no markup in the folder of the flow, and read it in each screen; data typed two times drift apart. The height or width of each mark is its value divided by the top of the scale, as a percent of the plot area. A mark whose size is typed by hand is a picture with the shape of a chart.
- **One scale for the whole chart**, written down one time: its top and its marked values. Charts that the person compares share the scale.
- **Check each mark against its label** after you write it: the bar for 2,894 on a scale to 3,500 is 83% high.
- **The data in the file are the data on the screen.** If the text says a total, the values add up to it. A number in a heading or a sentence is computed from the same arrays, or checked against them; a value that cannot be computed from them (a median of the week from medians of days) is one more named value in the data.

## The parts of a chart

- **The plot area** has a fixed height from the spacing scale of the design system, and the full width of its block. Choose the height so that the differences that matter can be seen; a bar chart of a month reads well at about a third of its width.
- **The value axis**: its name and unit in the heading of the chart ("Revenue of each day, in €"), and three to five marked values, zero included, at steps of 1, 2, 2.5 or 5 times a power of ten, in the normal text color. The top of the scale is the first marked value above the largest value. If the label of the largest mark then has no room, go one step higher; do not go further than that. When the values go below zero, the bottom of the scale is the first marked value below the smallest value, and zero is a marked value, drawn one step darker than the grid. If three to five marks would make the range much wider than the data, use more marks at a smaller step.
- **The category axis**: a label under each mark, or under each second or fifth one when they are dense. A name in words for what matters (the weekend days), not a color.
- **The grid**: thin pale lines at the marked values, behind the marks, or none.
- **The marks**: bars in one color of the design system. A second series is a neutral color of similar lightness. A bar for a period is as wide as its period, with a gap of one small spacing step, thus the bars read as separate days.
- **The base line** of bars is drawn only when it is zero. A line chart has no base line; its zero is a grid line.
- **Charts on a common axis** stand one below the other with the same left and right edge. The axis labels stand under the last chart only, and thin pale vertical lines at the main steps tie the charts together.
- **A band behind the marks is data when it is computed from data** (the hours with no heating) and has its name on it. It is pale and neutral.
- **The mean slope of 45°** is for a chart of one line. When two series share an axis, the axis must hold the two, and the slopes get flat.
- **If the change that the person asks about is small against the gap between two series** (a fall of 3 °C inside, 25 °C between inside and outside), draw that series a second time, alone, on its own scale with no base line, next to or below the shared chart. The shared chart shows the gap; the single one shows the change.
- **A reference** (the mean, the plan, the last period) is one thin line across the plot with its name and value at its end. It is data, thus it can be as strong as the marks.
- **Names at the ends need room**: keep a column at the right of the plot for the names of the lines and of the reference.
- **Labels of values**: when the marks are few (about twelve or fewer), write the value at each mark. When they are many, label the largest, the smallest and the last, and let the axis give the others.
- **No legend**: the name of a series stands at its marks or in the heading of its column. For bars, the names stand at the first pair, above or beside the bars, never inside a bar that is narrower than the name. If they do not fit, the heading of the chart names the series, each name in the color of its bars.
- **On a narrow width, bars lie level**: one row for each category with its name at the left, the value at the end of each bar, the scale under the plot, and a reference as a vertical line with its name above the plot. Each chart then has its own category labels.
- **The caption**: the source, the date of the data, and how they were counted, in a small text style below the chart.

Means that no scale of a design system has, and what to use:

- **The width of a line or a border**: the thinnest border of the design system for a grid and an axis; two times that for a data line.
- **The color of a drawn shape**: a color of the palette of the design system, the same one that a filled block of that series would have.
- **The place of a label at a mark**: an offset computed from the same value as the mark. It is data, as the size of the mark is.
- **Text in a drawing**: plain text of the design system laid over the plot, not text inside the drawing element, which stretches with it.

## Which forms can be built

| Form | Built from |
|---|---|
| bars, upright or level | blocks with a computed height or width |
| a bar inside a table cell | a block with a computed width, with the value written next to it; the heading of the column says what the full width stands for |
| a level bar cut into shares | blocks side by side with computed widths, each with its name and value on it or below it |
| a time line of events, a range | blocks placed by a computed offset |
| a line chart, an area, a scatter of points | one drawing element (SVG) whose points are computed from the data; a straight line between points, no smoothing |
| a diagram of nodes and links | blocks for the nodes and a drawing element for the links |

- **A drawing element is a part that the design system does not have**: its colors come from the palette of the design system, its text uses the text styles, and you report it.
- **Do not build a pie, a ring or a gauge**; see [Honest charts](./honest-charts.md).
- If a form cannot be built honestly with these means, give the table, and tell the user which chart is missing.

## A picture to scale

A floor plan, the size of a thing, a map of a room: a picture of real sizes is built in the same way as a chart, with a scale in the place of the axes.

- **One scale for each thing in the picture**, written down one time (so many spacing steps for one meter), and each width and height computed from the real size.
- **A scale bar** with its length in words, one time, and the size of each thing written next to it.
- **Things that the person compares stand on a common base line or a common edge.** If they are also options to choose from, the choice wins the arrangement (a column), and the common edge is the left one.
- **A known thing for comparison** has a different look from the things that can be chosen (an outline, not a fill). It is named one time for the set, at its first place or in the line of the scale bar, not on each picture.
- **Lay the known thing over the thing only when it is smaller in each direction.** If it is larger than one of the things, it stands next to them on the common edge; laid over, it says "does not fit", which is a different statement.
- **The picture shows what its sizes show.** A floor shows an area; the height is a sentence.

## Key numbers

A dashboard has a few numbers that stand alone. They are not tiles.

- **Each number is a block of plain text**: the name above, the value large, and the reference below as a sentence ("+7.5% from €44,910 in September"). No card, no frame and no background around it (see [Clutter](./clutter.md)).
- **A row of key numbers shares one reference**, said one time above the row; each block then carries only its own values.
- **The change is computed for the person**: in percent for an amount, in points for a share. The value that it is compared with stands next to it.
- **The bad direction is marked, the good one is not**: the error color of the design system and a word ("slower", "fewer", "over the goal"). The sign alone is not a mark: each change has one. Which direction is bad depends on the measure: a fall of revenue, a rise of complaints, a rise of "No". Mark nothing where no direction is good or bad (the preferred count of days at home), and where the change follows from a second measure (more gas on a colder night): there, give the second measure next to it.
- **One sentence above the numbers gives the answer** that they add up to. The person who reads only that sentence has the result.

## A value against a reference

A value that is not a change ("143 min") is good or bad only against a reference.

- **Mark a value only when a reference exists**, and name the reference on the screen, one time: a goal, a limit, the value of the period before.
- **If the task gives no reference, use the median of the set** (of the agents, the shops, the days), say so on the screen ("the median of the team is 51 min"), and name it in your report. Do not invent a goal.
- **Mark the few values that are far from the reference**, not each value on its bad side: with eight things, the worst one or two.
- **The mark is the error color and a word** next to the value. A thing with few cases (an agent with 12 requests) is not marked on a share.

## Access

- **The picture has a text form.** A chart has a label that says what it shows and its main result in one sentence. The values themselves are available as text: best in a table next to the chart or below it, which each person can use. If no table fits, each mark carries its value as a name in the code.
- **A mark is not the only carrier of a value that matters.** The best, the worst and the reference are written as numbers.
- **Color is never the only difference** between two series: add a name at the marks, a position or a pattern.

## Sample data

- **Invented data are marked, one time for a screen.** A remark of the author stands at the end of the screen, on a line of its own, and names what is invented: "Not drawn: real data. All values on this screen are a sample.", or, when a part comes from the task, "Not drawn: real data. The side lengths and the lists of what a unit holds are a sample." The caption of a chart is product text: it says how the values are counted and has the place of the source ("Source: …" is left out, not made up). Product text that you invent (a name of a shop, a list of what a unit holds) needs no remark; name it in your report.
- **Invented data are plausible and consistent**: totals add up, shares give 100%, the week has its rhythm. Give them one feature that is worth showing (a weak week, a change of rank), thus the picture has something to say.

## Sizes and the token check

A size that is computed from a value is data, not a style. The tool can list it as a value with no token; say so in your report, in one line. All other sizes of a chart (the height of the plot, the gaps, the widths of label columns) come from the spacing scale.

## What to draw

- Marks whose sizes are computed in the file from an array of values.
- A heading with the name and the unit, an axis with round marked values, and a caption.
- Values written at the marks that matter.
- Key numbers as plain text with a common reference.
- A text form of each picture.
