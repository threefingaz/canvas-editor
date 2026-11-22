---
description: Check the screen files against the library and fix what the check finds
agent: agent
---

Run `npm run check`.

For each finding, fix the screen file with the library, as `AGENTS.md` and the skill of the library say:
a token in place of a raw value, and a part of the library in place of a plain element.

- Change only the screen files. Do not change the library or the tokens.
- A raw value that is equal to a token: write the token. The screen then looks the same.
- A raw value that is equal to no token: write the nearest token, and name the change that a person can see.
- Leave a finding that a comment in the file says is intended, a finding that an explicit instruction of the user caused, and a finding that the library cannot do. Name each of them with its cause. If you cannot tell, leave the finding and ask.

Run `npm run check` again, then `npm run lint` and `npm run build`.
Report what you fixed, what looks different, and what is left.
