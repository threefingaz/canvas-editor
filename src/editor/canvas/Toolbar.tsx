import {
  ArrowUUpLeftIcon,
  ArrowUUpRightIcon,
  BoundingBoxIcon,
  FlowArrowIcon,
  FrameCornersIcon,
  MinusIcon,
  MoonIcon,
  PlayIcon,
  PlusIcon,
  SunIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react'
import { edits, useCanRedo, useCanUndo } from '../edits/store.ts'
import { useFileErrors } from '../requests/file-errors.ts'
import { RequestsButton } from '../requests/RequestsButton.tsx'
import { Button, PanelIconButton, PanelSurface, Separator, Toggle, Tooltip, TooltipContent, TooltipTrigger } from '../ui'
import type { EditorTheme } from '../theme.ts'
import { maxScale, minScale } from './viewport.ts'

// The floating bar at the bottom center of the canvas: the Preview switch
// (`operate.ts`), which says next to it that Preview is on, undo and redo of
// the edits of all screens, the buttons that give the sentence to the agent
// with the count of the changes as a badge (`RequestsButton.tsx`: "Copy for
// the agent", or "Send to the agent" and a copy button), an error of the save of the request
// files, the switch of the markers of the elements that are not from the
// library, the switch of the arrows of the links between the screens
// (`FlowLayer.tsx`), the zoom, and the theme of the editor. The zoom keeps the
// selection in the view when it is there; the titles of the buttons name
// their keys.

type ToolbarProps = {
  operate: boolean
  onToggleOperate: () => void
  scale: number
  onZoomOut: () => void
  onZoomIn: () => void
  onZoomReset: () => void
  onFitAll: () => void
  markers: boolean
  onToggleMarkers: () => void
  // The arrows of the links between the screens show.
  links: boolean
  onToggleLinks: () => void
  theme: EditorTheme
  onToggleTheme: () => void
}

export function Toolbar({
  operate,
  onToggleOperate,
  scale,
  onZoomOut,
  onZoomIn,
  onZoomReset,
  onFitAll,
  markers,
  onToggleMarkers,
  links,
  onToggleLinks,
  theme,
  onToggleTheme,
}: ToolbarProps) {
  const canUndo = useCanUndo()
  const canRedo = useCanRedo()
  const errors = [...useFileErrors().values()]
  return (
    <PanelSurface
      className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-xl p-1 shadow-lg"
      data-toolbar=""
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <Toggle
              data-operate-switch={operate ? 'on' : 'off'}
              onPressedChange={onToggleOperate}
              pressed={operate}
              size="lg"
            />
          }
        >
          <PlayIcon weight={operate ? 'fill' : 'regular'} />
          Preview
        </TooltipTrigger>
        <TooltipContent className="max-w-80" side="top">
          {operate
            ? 'Turn Preview off to select and edit elements'
            : 'Turn Preview on: a click on a link goes to the frame of its screen'}
        </TooltipContent>
      </Tooltip>
      {operate && (
        <span className="px-1.5 text-xs whitespace-nowrap text-[color:var(--muted-foreground)]" data-operate-state="" role="status">
          Preview is on
        </span>
      )}
      <Separator className="mx-1 h-4 data-vertical:self-center" orientation="vertical" />
      <span data-undo="">
        <PanelIconButton label="Undo" disabled={!canUndo} onClick={edits.undo}>
          <ArrowUUpLeftIcon />
        </PanelIconButton>
      </span>
      <span data-redo="">
        <PanelIconButton label="Redo" disabled={!canRedo} onClick={edits.redo}>
          <ArrowUUpRightIcon />
        </PanelIconButton>
      </span>
      <Separator className="mx-1 h-4 data-vertical:self-center" orientation="vertical" />
      <RequestsButton />
      {errors.length > 0 && <SaveError errors={errors} />}
      <Separator className="mx-1 h-4 data-vertical:self-center" orientation="vertical" />
      <span data-markers-switch={markers ? 'on' : 'off'}>
        <PanelIconButton
          className={markers ? 'text-[color:var(--attention)]' : undefined}
          label={markers ? 'Hide markers' : 'Show markers'}
          onClick={onToggleMarkers}
        >
          <BoundingBoxIcon weight={markers ? 'bold' : 'regular'} />
        </PanelIconButton>
      </span>
      <span data-links-switch={links ? 'on' : 'off'}>
        <PanelIconButton
          className={links ? 'text-[color:var(--accent)]' : undefined}
          label={links ? 'Hide links between screens' : 'Show links between screens'}
          onClick={onToggleLinks}
        >
          <FlowArrowIcon weight={links ? 'bold' : 'regular'} />
        </PanelIconButton>
      </span>
      <PanelIconButton label="Zoom out" disabled={scale <= minScale} onClick={onZoomOut}>
        <MinusIcon />
      </PanelIconButton>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label="Zoom to 100%"
              className="w-14 tabular-nums"
              onClick={onZoomReset}
              type="button"
              variant="ghost"
            />
          }
        >
          {Math.round(scale * 100)}%
        </TooltipTrigger>
        <TooltipContent side="top">Zoom to 100% (Shift+0)</TooltipContent>
      </Tooltip>
      <PanelIconButton label="Zoom in" disabled={scale >= maxScale} onClick={onZoomIn}>
        <PlusIcon />
      </PanelIconButton>
      <PanelIconButton label="Fit all frames (Shift+1)" onClick={onFitAll}>
        <FrameCornersIcon />
      </PanelIconButton>
      <Separator className="mx-1 h-4 data-vertical:self-center" orientation="vertical" />
      <PanelIconButton label={theme === 'dark' ? 'Light theme' : 'Dark theme'} onClick={onToggleTheme}>
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </PanelIconButton>
    </PanelSurface>
  )
}

// The errors of the files of the work folder: a load or a save of a request
// file, a save of an issues file, and a reading of an Issues list. The edits
// stay in the editor when a save fails; the next change saves them again.
function SaveError({ errors }: { errors: string[] }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            aria-label={errors.join('\n')}
            className="inline-flex size-8 items-center justify-center text-[color:var(--destructive)]"
            data-save-error=""
            role="status"
          />
        }
      >
        <WarningCircleIcon className="size-4" />
      </TooltipTrigger>
      <TooltipContent className="max-w-80 whitespace-pre-line" side="top">
        {`${errors.join('\n')}\nThe changes stay in the editor.`}
      </TooltipContent>
    </Tooltip>
  )
}
