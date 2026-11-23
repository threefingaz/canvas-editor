// The config of the canvas tool. Plain data only: the editor and the Node
// tools read it, and it must not load the library. All that is specific to
// the library is in its pack, `packs/<name>/`, which the tool finds by itself
// (`tools/pack.ts`).

export type CanvasConfig = {
  // The frame widths that a screen can have, in px.
  widths: readonly number[]
  // The folder of the screen files, relative to the project root.
  screens: string
  // The token file, relative to the project root.
  tokens: string
  // The work folder of the tool (request and issues files), relative to the
  // project root. Git ignores it.
  work: string
  // The way of "Send to the agent" (`tools/agent.ts`, `agentOf`):
  // - `'auto'`: the preset `vscode` when the dev server runs in a terminal of
  //   VS Code, else the clipboard. The default of a project with no `agent`.
  // - `'clipboard'`, or `null` (the form of an older config): the toolbar has
  //   one button, "Copy for the agent", which copies the fixed sentence.
  // - the name of a preset (`'vscode'`: the command line of VS Code, which
  //   opens the chat of its agent).
  // - `{ command, args }`: a command of the user. The dev server starts it on
  //   this machine, with the fixed sentence for the agent as the last
  //   argument.
  agent: AgentSetting
}

// The name of the preset of `agent` (`vscodeLine` in `tools/agent.ts`).
export type AgentPreset = 'vscode'

export type AgentSetting = 'auto' | 'clipboard' | AgentPreset | { command: string; args: readonly string[] } | null

export const config = {
  widths: [1440, 1024, 390],
  screens: 'screens',
  tokens: 'tokens.json',
  work: '.canvas',
  agent: { command: 'code', args: ['chat', '--mode', 'agent', '--reuse-window'] },
} as const satisfies CanvasConfig
