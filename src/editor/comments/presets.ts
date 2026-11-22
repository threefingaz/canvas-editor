import type { Origin } from '../../requests/format.ts'

// The quick requests: comments with a fixed text, which the user adds with
// one click and no typing. A preset is not a new kind of request: the item
// in the request file is a plain comment with `text`, thus the agent needs
// no new rule. Each text is a whole task that an agent can do with only the
// guide of the requests: it names the result, and where the guide has a form
// for it (a state with `stateOf`, the address of a screen), it names that
// form. The functions are pure; the bubble gives them the origin of the
// element, the screen and the list of screens.

export type Preset = {
  // Unique in its list; the value of `data-quick-request`.
  key: string
  // The text of the button, two to four words.
  label: string
  // The comment that the agent gets.
  text: string
}

const rebuild: Preset = {
  key: 'rebuild',
  label: 'Rebuild with the library',
  text: 'Rebuild this element with parts of the library; keep its content.',
}

const duplicate: Preset = {
  key: 'duplicate',
  label: 'Duplicate',
  text: 'Duplicate this element, and put the copy after it.',
}

const standOutMore: Preset = {
  key: 'stand-out-more',
  label: 'Stand out more',
  text: 'Make this element stand out more on the screen. Stay inside the rules of the design skills, and use only the parts and the tokens of the library.',
}

const standOutLess: Preset = {
  key: 'stand-out-less',
  label: 'Stand out less',
  text: 'Make this element stand out less on the screen. Stay inside the rules of the design skills, and use only the parts and the tokens of the library.',
}

const shortenText: Preset = {
  key: 'shorten-text',
  label: 'Shorten the text',
  text: 'Shorten the text of this element; keep its meaning.',
}

const betterPart: Preset = {
  key: 'better-part',
  label: 'Use a better part',
  text: 'Replace this with the part of the library that fits its purpose better; keep its content.',
}

const nextState: Preset = {
  key: 'next-state',
  label: 'Draw the next state',
  text: 'Draw the state of the screen after a person uses this control, as a new screen file with `stateOf`, and link this control to it.',
}

const simplifyPart: Preset = {
  key: 'simplify',
  label: 'Simplify',
  text: 'Remove what the task of the screen does not need in this part.',
}

// The quick requests of an element. An element that is not from the library
// gets the rebuild first, because that is its most likely task, and no
// "better part": the rebuild already chooses the part. `option`: the screen
// is an option, which has no states, thus no next state is drawn from it.
export function elementPresets(origin: Origin, option: boolean): Preset[] {
  return [
    ...(origin === 'library' ? [] : [rebuild]),
    duplicate,
    standOutMore,
    standOutLess,
    shortenText,
    ...(origin === 'library' ? [betterPart] : []),
    ...(option ? [] : [nextState]),
    simplifyPart,
  ]
}

type LinkScreen = { id: string; title: string; optionOf?: string }

// One request for each screen that a control can link to: each screen but the
// current one and the options, because no screen links to an option. The
// label is the title of the screen, with its id when a second screen of the
// list has the same title.
export function linkPresets(screens: readonly LinkScreen[], currentId: string): Preset[] {
  const targets = screens.filter((screen) => screen.id !== currentId && screen.optionOf === undefined)
  return targets.map((screen) => {
    const twice = targets.some((other) => other !== screen && other.title === screen.title)
    return {
      key: `link:${screen.id}`,
      label: twice ? `${screen.title} (${screen.id})` : screen.title,
      text: `Link this control to the screen \`${screen.id}\`: \`href="#/${screen.id}"\`.`,
    }
  })
}

type PresetScreen = { id: string; width: number; stateOf?: string; optionOf?: string }

// The quick requests of the whole screen. Only a base screen has states and
// a second file for a different width; `hasStates` says that the list has a
// state of this screen. `widths` are the widths of the config.
export function screenPresets(screen: PresetScreen, widths: readonly number[], hasStates: boolean): Preset[] {
  const base = screen.stateOf === undefined && screen.optionOf === undefined
  const others = [...new Set(widths)].filter((width) => width !== screen.width)
  return [
    ...(base
      ? [
          {
            key: 'missing-states',
            label: 'Draw the missing states',
            text: 'Draw the states that this screen can have and that no screen file shows yet (after an error, during a wait, with nothing to show, after an action), each as a screen file with `stateOf`, and link each control that leads to one. Name each state that you do not draw.',
          },
          ...others.map((width) => ({
            key: `width-${width}`,
            label: `Draw at ${width} px`,
            text: `Draw this screen for the width ${width} px as a new screen file in the same flow.`,
          })),
        ]
      : []),
    ...(base && hasStates
      ? [
          {
            key: 'update-states',
            label: 'Update the states',
            text: 'Bring the states of this screen up to date with it: each state shows the same screen with its one difference.',
          },
        ]
      : []),
    {
      key: 'fix-deviations',
      label: 'Fix the deviations',
      text: `Fix the deviations of this screen from the design system: run \`npm run check -- ${screen.id}\`, read the issues file of the screen, link each value to a token, and rebuild each element that is not from the library with parts of the library. Do not change what an edit or a comment of the user asked for. Name what cannot be fixed.`,
    },
    {
      key: 'design-check',
      label: 'Check the design',
      text: 'Check this screen against the design skills and fix what fails; name each change. Do not change what an edit or a comment of the user asked for.',
    },
    {
      key: 'simplify-screen',
      label: 'Simplify',
      text: 'Make this screen simpler: remove each step, field and element that the task does not need.',
    },
    {
      key: 'link-flow',
      label: 'Link the flow',
      text: 'Link the controls of this screen to the screens that they lead to; name each control whose target is not drawn.',
    },
  ]
}

// The keys of the presets whose text is already a comment of the place: the
// bubble shows them as done, thus a second click adds no second comment.
export function donePresets(presets: readonly Preset[], texts: readonly string[]): Set<string> {
  return new Set(presets.filter((preset) => texts.includes(preset.text)).map((preset) => preset.key))
}
