---
description: Apply the changes that the user made in the canvas editor to the screen files
agent: agent
---

Apply the canvas requests in .canvas/requests/ as AGENTS.md says.

Read the section "Requests" of `AGENTS.md` first, and follow its rules for each item.

At the end, run `npm run check -- <the screens that you changed>`, `npm run lint` and `npm run build`, and fix what you broke.
A finding of the check that was there before your work, or that an edit or a comment of the user asked for, stays: name it.
Then report as the section "After the work" of `AGENTS.md` says.
