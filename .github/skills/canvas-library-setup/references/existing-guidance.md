# Existing guidance of a library

A library can come with guidance of its own: a skill, an instruction file for agents, a guide for developers. The people who wrote it know the library. Use it as it is.

## Three cases

| What you find | What to do |
|---|---|
| guidance that answers the contract | install it; write a short library skill that points to it and adds the parts of the tool |
| guidance with gaps | the same; the library skill also answers the open questions |
| no guidance | write the full library skill from the source and the documentation of the library. With no network there is no documentation: use the installed package (its types, its source, and what its components write when you render them), and mark what comes from memory |

The library skill of ours exists in each case, because two things are never in the guidance of a library: how its tokens show to the tool, and how an edit from the canvas is applied.

## Keep it whole and unchanged

- **Do not rewrite, merge or shorten it.** The owners will update it; a rewritten copy goes out of date, and nobody sees it.
- **Do not put our rules into its files.** They go into the library skill.

## Where it lives

All of it goes into the pack, `packs/<name>/skills/`, next to the library skill. A skill in the pack does not load by its description: an agent reaches the library skill through the link in `packs/<name>/AGENTS.md`, and each other file only through a link from the library skill. Thus:

1. **If the guidance is a skill** (a folder with `SKILL.md`): copy the folder into `packs/<name>/skills/` under its own name: `SKILL.md` and each file that it links. Leave out a file that is not a part of the skill (a `README.md`, an `AGENTS.md` for the people who maintain it): an agent tool can load an `AGENTS.md` in a sub folder by itself, with rules that a screen does not permit. The name in its `SKILL.md` must be the same as the folder name. Link it from the library skill with the relative path `../<its name>/SKILL.md`.
2. **If it is one document** (an instruction file, a guide): put it into the folder of the library skill as `references/<name>.md`, unchanged, and link it from `SKILL.md`.
3. **If it is a web page or a large site**: do not copy it. The tool works with no network. Take what the contract needs into the library skill, in your own words, and name the page as the source.

For each copy, write into the library skill: where it came from (the repository or the package, the path), the version or the commit, the date, and how to update it (copy again, change the line).

## Before you copy

- **The user permits it.** Ask before you copy (question 7 of step 1 in `SKILL.md`). With no permission, the library skill points to where the guidance is and has what the contract needs, in your own words.
- **The version.** Copy the guidance of the version that is installed (its tag), not the newest state of the repository.

- **The licence.** Copy only what its licence permits, and keep the licence text next to the copy: a `LICENSE` file in the copied folder. That file is not a change of the guidance. If there is no licence, or you cannot tell, ask the user and copy nothing.
- **The rule of this repository about other tools.** A file that Git tracks must not name other design tools, editors or starter kits. Read the guidance for such names. If it has them, do not edit them out: tell the user, and leave that file out or keep it outside Git (`.git/info/exclude`).
- **Parts that do not apply.** Guidance for a framework or a tool that the screens do not use is not copied. Say in the library skill what you left out.
- **The size.** If the guidance is large, the library skill must say which part to read for which question; an agent cannot read all of it for each screen.

## Check it against the contract

Go through [The contract of a library skill](./contract.md), question by question, and mark for each: answered by the guidance (where), or open. The library skill then has a pointer for the first and an answer for the second. Do not repeat what the guidance says well.

## When the guidance and the other rules disagree

| The guidance of the library says | Against | Who wins |
|---|---|---|
| an explicit rule of behavior or content ("confirm each deletion") | a rule of the design skills | the guidance of the library. The agent reports the conflict, with the two rules. |
| nothing | a rule of the design skills | the design skills |
| how to style in general (a wrapper component, a change of the theme, global CSS) | the rules of a screen file in the root `AGENTS.md` | the tool. In a screen only a prop and the override at the place of use are permitted, because the editor must read each value. Say so in the library skill, with the reason. |
| a component exists for a thing | a rule of behavior of the design skills | the design skills. A component that only exists is not a rule. |

Write the conflicts that you find during the setup into the library skill, thus each later agent meets them decided.
