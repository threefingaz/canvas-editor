---
name: canvas-apply
description: Apply the changes that the user made in the canvas editor to the screen files. Read this skill when the user says "Apply the canvas requests in .canvas/requests/ as AGENTS.md says", asks to apply the canvas requests, the edits, the comments or the quick requests of the editor, or asks to write an option or a kept option into the code. It is the entry to the section "Requests" of `AGENTS.md`.
---

# Apply the canvas requests

The user edited screens in the canvas editor. The editor saved each change as an item of a request file, `.canvas/requests/<screen id>.json`. Your task is to write each item into the code of its screen, and to remove the item.

The full guide is the section "Requests" of `AGENTS.md`: the format of an item, one example of each kind, and the rules. Read it before you change a file. This skill is the sequence of the work.

1. **List the request files:** each `.json` file in `.canvas/requests/`, also in its sub folders. With no file, tell the user that there is no request, and stop.
2. **Read "Requests" of `AGENTS.md`,** "Screen files" of `AGENTS.md`, and `packs/<name>/AGENTS.md` with the library skill that it links. With no pack in `packs/`, tell the user that no library is connected, and change nothing.
3. **Run `npm run check` one time** before you change a screen, thus you know the findings that were there.
4. **For each request file, one pass:** a `keep` item first; then the edits (`style`, `textStyle`, `text`, `order`, `remove`) from the last line to the first; then the comments on elements from the last line to the first; then the comments on the screen and the `options` items. A comment is a task in the words of the user: do it with the design skills (`canvas-screen-design`) and the library skill.
5. **The states follow their screen:** make the same change in each state file of a base screen where the same element is.
6. **Write the request file one time,** at the end of its pass: remove each item that you applied, add a `reply` to each item that you did not apply (`conflict`, `needs-library-change`, `unclear`), keep each item that you did not read, and delete the file when no item is left. Read the file again just before you write it.
7. **Run `npm run check -- <the screens that you changed>`, `npm run lint` and `npm run build`.** Fix what your work added. A finding that was there before, or that an edit or a comment of the user asked for, stays: name it.
8. **Report** as "After the work" in `AGENTS.md` says: one line for each comment that you did, each new screen file, each rule that a comment broke, and each item with a reply.

Do not change the library, its pack in `packs/`, `tokens.json`, or a file outside `screens/` and `.canvas/requests/`.
