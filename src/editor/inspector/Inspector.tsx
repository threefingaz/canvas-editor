import {
  ArrowsInCardinalIcon,
  ArrowsOutCardinalIcon,
  ChatCircleTextIcon,
  CheckIcon,
  CopyIcon,
  CursorClickIcon,
  ListChecksIcon,
  LinkSimpleIcon,
  MagnetIcon,
  SquaresFourIcon,
} from '@phosphor-icons/react'
import { Fragment, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import { library, screens, type ScreenEntry } from 'virtual:canvas-screens'
import type { Edit, Target } from '../../requests/format.ts'
import { messageOf } from '../../tokens/format.ts'
import { bubble } from '../comments/bubble-store.ts'
import { useCopy, type CopyState } from '../copy.ts'
import { editBlock } from '../edits/keep.ts'
import { edits, useScreenEdits } from '../edits/store.ts'
import { frameWindowOf, inLiveFrame } from '../frame-window.ts'
import { IssuesPanel } from '../issues/IssuesPanel.tsx'
import { breadcrumb, elementOf, fiberName, siteOf, type Fiber, type Site } from '../locate/fiber.ts'
import { ownTextNode } from '../preview/apply.ts'
import { editAttribute } from '../preview/css.ts'
import { Project } from '../project/Project.tsx'
import { nodesAt, pickElement } from '../selection/pick.ts'
import { selection, selectionKey, useSelection, type Selected } from '../selection/store.ts'
import { selectionTarget } from '../selection/target.ts'
import { useTokenFile } from '../tokens/editor-tokens.ts'
import { frameTokens } from '../tokens/frame-tokens.ts'
import { readStyles, type ElementStyles } from '../tokens/read-styles.ts'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  PanelContentSurface,
  PanelIconButton,
  PanelSection,
  PanelSurface,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TextInputControl,
} from '../ui'
import { Changes } from './Changes.tsx'
import {
  controlOf,
  inlineControl,
  isLayoutProperty,
  layoutEdit,
  rowAction,
  rowEdit,
  textEdit,
  textEditable,
} from './edit.ts'
import { LayoutControl, type Axes } from './LayoutControls.tsx'
import { inspectorModel, type InspectorRow, type InspectorSection, type SectionTitle, type SidesKey } from './model.ts'
import { isTab, type Tab } from './tabs.ts'
import { TokenControl } from './TokenControl.tsx'
import { ValueRow } from './ValueRow.tsx'

// The column at the right of the editor, with three tabs (`tabs.ts`). Design:
// for the selected element, its type, its component, its parents, its place
// in the screen file, and its style values with the state of each, with the
// full height of the column. A value of the sections in `editable` has a
// control that gives a token to the value, a "Link" or "Use nearest" action
// when it has no token link, and a row of four equal sides can be split into
// one row for each side. The Layout section has a segmented control for the
// direction, the wrap, the alignment and the justification of a flex or grid
// container. The Content section changes the text of an element whose place
// gives one text. With nothing selected, Design says so. Changes: the listed
// screen (the screen of the last click on a frame, its title or a pin), its
// title and file, its Changes list and then its Issues list, in one column
// that scrolls; the tab shows the count of the items of the Changes list.
// Its header has "Comment on the screen" and "Ask for options" of the screen
// (not for an option), as the title row of the frame has them: at a low zoom
// the title row has no room for its buttons. They move the canvas to the
// title row first (`onShowTitle`), where the bubble or the options panel
// opens. A click on a row selects its element and moves the canvas to it
// when it is not in the view (`onReveal`); the tab stays. A comment, a
// request for options, a move and a removal are made on the canvas: the bar
// of the selection (`SelectionBar.tsx`), the bubble of a comment and the
// options panel (`CommentBubble.tsx`). While a screen has an open request to keep an
// option, its elements take no edit (the option replaces their markup), and
// the view of an element says why. An edit goes to the edits store, and the
// preview shows it in the frame. Project: each screen of the project by flow,
// with its counts (`project/Project.tsx`); a click on a row lists the screen
// in Changes and fits its frame (`onOpenScreen`). With the Preview switch on, the editor does
// not render the column (`App.tsx`), and an error of the token file shows at
// the top of the canvas.

// The sections whose values have a control.
const editable: ReadonlySet<SectionTitle> = new Set(['Color', 'Elevation', 'Typography', 'Spacing', 'Corners'])

// Builds an edit from the target and the width of the frame.
type Build = (target: Target, width: number) => Edit | null

// Gives the edit that `build` makes to the edits store. `replaces`: the ids of
// the edits that the new edit replaces.
type Apply = (build: Build, replaces?: readonly string[]) => void

// The edits of the selected element: the target is read from the frame at the
// time of the change (`selectionTarget`), and the width is the width of the
// frame of the screen.
function applyFor(selected: Selected, site: Site): Apply {
  return (build, replaces) => {
    const width = screens.find((screen) => screen.id === selected.screenId)?.width
    if (width === undefined) return
    const edit = build(selectionTarget(selected, site), width)
    if (edit) edits.apply(selected.screenId, edit, replaces)
  }
}

type InspectorProps = {
  // The listed screen: the screen of the last click on a frame, on its title
  // or on a pin. The Changes tab shows it.
  screenId: string | null
  // The current document of each frame, by screen id.
  documents: ReadonlyMap<string, Document>
  // The open tab, and the change of it by a click on a tab.
  tab: Tab
  onTab: (tab: Tab) => void
  // Moves the canvas to the frame of a screen: a click on a `keep` item in
  // the Changes list shows its option.
  onShowScreen: (id: string) => void
  // Lists a screen in the Changes tab and fits its frame: a click on a row of
  // the Project tab.
  onOpenScreen: (id: string) => void
  // Moves the canvas to the title row of the frame of a screen when it is not
  // in the view: a panel of the screen opens next to it.
  onShowTitle: (id: string) => void
  // Moves the canvas to the selected element when it is not in the view: a
  // click on a row of the Changes list or of the Issues list selected it.
  onReveal: () => void
}

export function Inspector({
  screenId,
  documents,
  tab,
  onTab,
  onShowScreen,
  onOpenScreen,
  onShowTitle,
  onReveal,
}: InspectorProps) {
  const selected = useSelection()
  const screen = screenId === null ? undefined : screens.find((entry) => entry.id === screenId)
  return (
    <aside className="relative h-full w-[300px] shrink-0" data-inspector="">
      <PanelSurface className="flex h-full flex-col rounded-none border-y-0 border-r-0">
        <Tabs
          value={tab}
          onValueChange={(value) => isTab(value) && onTab(value)}
          className="min-h-0 flex-1 gap-0"
          data-inspector-tabs={tab}
        >
          <div className="shrink-0 border-b border-[color:var(--editor-line)] px-2 pt-1.5 pb-1">
            <TabsList variant="line" className="w-full justify-start">
              <TabsTrigger value="design" className="flex-none" data-inspector-tab="design">
                Design
              </TabsTrigger>
              <TabsTrigger value="changes" className="flex-none" data-inspector-tab="changes">
                Changes
                {screen && <ChangesCount screenId={screen.id} />}
              </TabsTrigger>
              <TabsTrigger value="project" className="flex-none" data-inspector-tab="project">
                Project
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="design" className="flex min-h-0 flex-col">
            {selected ? (
              <ElementView key={selectionKey(selected)} selected={selected} />
            ) : (
              <NothingSelected />
            )}
          </TabsContent>
          <TabsContent value="changes" className="flex min-h-0 flex-col">
            {screen ? (
              <ScreenChanges
                screen={screen}
                document={documents.get(screen.id) ?? null}
                onShowScreen={onShowScreen}
                onShowTitle={onShowTitle}
                onReveal={onReveal}
              />
            ) : (
              <NoScreen />
            )}
          </TabsContent>
          <TabsContent value="project" className="flex min-h-0 flex-col">
            <Project listed={screenId} onOpenScreen={onOpenScreen} />
          </TabsContent>
        </Tabs>
      </PanelSurface>
    </aside>
  )
}

// The count of the items of the Changes list of a screen, in the tab.
function ChangesCount({ screenId }: { screenId: string }) {
  const count = useScreenEdits(screenId).length
  return (
    <span className="font-normal text-[color:var(--muted-foreground)] tabular-nums" data-inspector-tab-count={count}>
      {count}
    </span>
  )
}

function NothingSelected() {
  return (
    <Empty className="text-xs" data-inspector-empty="">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CursorClickIcon />
        </EmptyMedia>
        <EmptyTitle>Nothing selected</EmptyTitle>
        <EmptyDescription>Click an element in a frame to see its place in the code and its style values.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function NoScreen() {
  return (
    <Empty className="text-xs" data-inspector-no-screen="">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ListChecksIcon />
        </EmptyMedia>
        <EmptyTitle>No screen</EmptyTitle>
        <EmptyDescription>Click a frame or its title to see the changes and the issues of its screen.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

// The Changes tab of a screen: its title and its file, its Changes list, and
// its Issues list below it, in one column that scrolls.
type ScreenChangesProps = {
  screen: ScreenEntry
  document: Document | null
  onShowScreen: (id: string) => void
  onShowTitle: (id: string) => void
  onReveal: () => void
}

function ScreenChanges({ screen, document, onShowScreen, onShowTitle, onReveal }: ScreenChangesProps) {
  const target = { screenId: screen.id, loc: null }
  return (
    <PanelContentSurface scrollFadeMode="overflow" data-inspector-changes={screen.id}>
      <header className="flex flex-col gap-1 px-3 pt-3" data-inspector-screen={screen.id}>
        <div className="flex min-w-0 items-center gap-1">
          <h2 className="m-0 min-w-0 flex-1 truncate text-sm font-semibold">{screen.title}</h2>
          <span className="shrink-0" data-changes-comment="">
            <PanelIconButton
              label="Comment on the screen"
              onClick={() => {
                onShowTitle(screen.id)
                bubble.send({ type: 'open-new', target })
              }}
            >
              <ChatCircleTextIcon />
            </PanelIconButton>
          </span>
          {screen.optionOf === undefined && (
            <span className="shrink-0" data-changes-ask-options="">
              <PanelIconButton
                label="Ask for options of the screen"
                onClick={() => {
                  onShowTitle(screen.id)
                  bubble.send({ type: 'open-options', target })
                }}
              >
                <SquaresFourIcon />
              </PanelIconButton>
            </span>
          )}
        </div>
        <code className="min-w-0 truncate font-mono text-[11px] text-[color:var(--muted-foreground)]" title={screen.file}>
          {screen.file}
        </code>
      </header>
      <Changes
        screenId={screen.id}
        document={document}
        empty="No changes in this screen."
        onShowScreen={onShowScreen}
        onShowTitle={onShowTitle}
        onReveal={onReveal}
      />
      <IssuesPanel
        screenId={screen.id}
        document={document}
        className="border-t border-[color:var(--editor-line)]"
        onReveal={onReveal}
      />
    </PanelContentSurface>
  )
}

type ReadResult = { styles: ElementStyles | null; error: string | null }

// The styles of the element. No styles when the node is no longer in a live
// frame (a frame reloads, and the selection finds the element again; until
// then the node stays in the old document, which has no window). An error of
// the reading is shown in place of the sections.
function stylesOf(node: Element): ReadResult {
  if (!inLiveFrame(node)) return { styles: null, error: null }
  try {
    return { styles: readStyles(node), error: null }
  } catch (error) {
    console.error(error)
    return { styles: null, error: messageOf(error) }
  }
}

// A count that grows when the styles of the node can have changed: its class,
// its inline style or the edits of the preview on it, or the style elements of
// its frame (a hot update of the theme of the library writes new rules there,
// and the preview writes its rules there). The end of a transition counts
// too: the computed value of a property with a transition (the fill of a
// Button) reaches the new value only at the end.
function useStyleChanges(node: Element): number {
  const [count, increase] = useReducer((value: number) => value + 1, 0)
  useEffect(() => {
    const frameWindow = frameWindowOf(node.ownerDocument)
    if (!frameWindow) return
    const observer = new frameWindow.MutationObserver(() => increase())
    observer.observe(node, { attributes: true, attributeFilter: ['class', 'style', editAttribute] })
    const head = node.ownerDocument.head
    if (head) observer.observe(head, { childList: true, subtree: true, characterData: true })
    const ended = (event: Event) => {
      if (event.target === node) increase()
    }
    node.addEventListener('transitionend', ended)
    node.addEventListener('transitioncancel', ended)
    return () => {
      observer.disconnect()
      node.removeEventListener('transitionend', ended)
      node.removeEventListener('transitioncancel', ended)
    }
  }, [node])
  return count
}

// Renders again when the own text of the node changes: the preview of a text
// edit sets it, and React can put in a new text node. A change of a text
// deeper in the node does not count.
function useTextChanges(node: Element) {
  const [, increase] = useReducer((value: number) => value + 1, 0)
  useEffect(() => {
    const frameWindow = frameWindowOf(node.ownerDocument)
    if (!frameWindow) return
    const observer = new frameWindow.MutationObserver((records) => {
      if (records.some((record) => record.target === node || record.target.parentNode === node)) increase()
    })
    observer.observe(node, { childList: true, characterData: true, subtree: true })
    return () => observer.disconnect()
  }, [node])
}

function ElementView({ selected }: { selected: Selected }) {
  // The element is read from the location of the selection, not from the
  // node: an element that renders no node of its own shares its node with an
  // inner element.
  const element = useMemo(() => elementOf(selected.node, selected.loc), [selected.node, selected.loc])
  const site = element && siteOf(element)
  // The name of the component of the record, when the tag of the screen file
  // names it differently.
  const component = element && fiberName(element) !== selected.name ? fiberName(element) : null
  const parents = useMemo(() => (element ? breadcrumb(element).reverse() : []), [element])
  // A change of the styles reads them again (`changes` of `StylesView`). The
  // view stays mounted, thus a control keeps its focus after an edit: a pick
  // in a select changes the preview, and the preview changes the styles.
  const changes = useStyleChanges(selected.node)
  const tag = selected.node.tagName.toLowerCase()
  const role = site?.origin === 'host' ? 'HTML element' : `component${component ? ` ${component}` : ''}, renders <${tag}>`
  // The count of copies that the place in the code draws: an edit changes
  // each of them. It is read at each render: a change of the styles renders
  // the view again.
  const nodes = nodesAt(selected.node.ownerDocument, selected.loc)
  const copies = nodes.length
  // The text of the place: one text node in each copy, the same in all.
  useTextChanges(selected.node)
  const texts = nodes.map((node) => ownTextNode(node)?.nodeValue ?? null)
  const text = textEditable(texts) ? texts[0] : null
  const items = useScreenEdits(selected.screenId)
  // The rows of four sides that the user split; they stay split while the
  // element is selected.
  const [split, setSplit] = useState<ReadonlySet<SidesKey>>(() => new Set())
  const toggleSplit = (key: SidesKey) =>
    setSplit((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  // An open `keep` of the screen: the element takes no edit.
  const blocked = editBlock(items)
  const onEdit = site && blocked === null ? applyFor(selected, site) : null

  const selectParent = (parent: Fiber) => {
    const picked = pickElement(selected.node.ownerDocument, parent)
    if (picked) selection.select({ ...picked, screenId: selected.screenId })
  }

  return (
    <>
      <header className="flex shrink-0 flex-col gap-2 p-3" data-inspector-header="">
        {/* The name keeps its width; the role text after it is cut first. */}
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="m-0 max-w-full shrink-0 truncate text-sm font-semibold" title={selected.name} data-element-name="">
            {selected.name}
          </h2>
          <span className="min-w-0 truncate text-xs text-[color:var(--muted-foreground)]" title={role} data-element-type="">
            {role}
          </span>
        </div>
        {parents.length > 0 && (
          <Breadcrumb>
            <BreadcrumbList className="gap-1 text-[11px]">
              {parents.map((parent, index) => (
                <Fragment key={index}>
                  <BreadcrumbItem>
                    <BreadcrumbLink
                      render={<button type="button" className="border-0 bg-transparent p-0 text-inherit" />}
                      onClick={() => selectParent(parent)}
                      data-breadcrumb-item=""
                    >
                      {siteOf(parent)?.tag ?? fiberName(parent)}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                </Fragment>
              ))}
              <BreadcrumbItem>
                <BreadcrumbPage>{selected.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        )}
        {site && <CodePlace place={site.loc} />}
        {blocked !== null && (
          <p className="m-0 text-xs text-[color:var(--attention)]" data-edit-blocked="">
            {blocked}
          </p>
        )}
        {copies > 1 && (
          <p
            className="m-0 text-xs text-[color:var(--attention)]"
            title={`This place in the code draws ${copies} copies. An edit changes all of them.`}
            data-copies={copies}
          >
            {copies} copies change
          </p>
        )}
      </header>
      <StylesView
        changes={changes}
        node={selected.node}
        onEdit={onEdit}
        split={split}
        onSplit={toggleSplit}
        content={
          onEdit && text !== null ? (
            <ContentSection text={text} onText={(next) => onEdit((target, width) => textEdit(text, next, target, width))} />
          ) : null
        }
      />
    </>
  )
}

// The count of the values with no token link and the sections of the values.
// At the level `connected` of the library (its tokens are not set up), a note
// in place of the count: the rows then have no token control.
// With no `onEdit` (an element with no place in the code) the values are
// read-only.
type StylesProps = {
  node: Element
  // The count of `useStyleChanges`: a new count reads the styles again.
  changes: number
  onEdit: Apply | null
  split: ReadonlySet<SidesKey>
  onSplit: (key: SidesKey) => void
  // The Content section, first in the sections; null when the text cannot
  // change.
  content: ReactNode
}

function StylesView({ node, changes, onEdit, split, onSplit, content }: StylesProps) {
  // A new count of `changes` is the reason to read the styles again; its value
  // is not used.
  const read = useMemo(() => {
    void changes
    return stylesOf(node)
  }, [node, changes])
  const tokenFile = useTokenFile()
  const model = useMemo(
    () =>
      read.styles && tokenFile.tokens
        ? inspectorModel(read.styles, frameTokens(tokenFile.tokens, node.ownerDocument), split)
        : null,
    [node, read, split, tokenFile],
  )
  return (
    <>
      {read.error !== null && (
        <div className="shrink-0 px-3 pb-2" data-styles-error="">
          <Alert variant="destructive">
            <AlertTitle>The styles cannot be read</AlertTitle>
            <AlertDescription>{read.error}</AlertDescription>
          </Alert>
        </div>
      )}
      {model && library?.level === 'connected' && (
        <p className="m-0 shrink-0 px-3 pb-2 text-xs text-[color:var(--muted-foreground)]" data-no-tokens-note="">
          The tokens are not set up: the values have no token controls yet, and no value counts as a deviation.
        </p>
      )}
      {model && library?.level !== 'connected' && (
        <p className="m-0 shrink-0 px-3 pb-2 text-xs" data-no-token-count={model.noToken}>
          {model.noToken === 0 ? (
            <span className="text-[color:var(--muted-foreground)]">Each value uses a token.</span>
          ) : (
            <span className="text-[color:var(--attention)]">
              {model.noToken === 1 ? '1 value has no token link.' : `${model.noToken} values have no token link.`}
            </span>
          )}
        </p>
      )}
      {(model || content) && (
        <PanelContentSurface scrollFadeMode="overflow" data-inspector-sections="">
          {content}
          {model?.sections.map((section) => (
            <PanelSection key={section.title} title={section.title} spacing="technical" data-section={section.title}>
              <div className="flex flex-col gap-1">
                {section.rows.map((row) => {
                  if (section.title === 'Layout') {
                    return <LayoutRow key={row.label} row={row} section={section} onEdit={onEdit} />
                  }
                  const edit = onEdit && editable.has(section.title) ? onEdit : null
                  const control =
                    edit && controlOf(row) ? (
                      <TokenControl
                        row={row}
                        onPick={(token) => edit((target, width) => rowEdit(row, token, target, width))}
                      />
                    ) : undefined
                  const inline = control !== undefined && inlineControl(row)
                  return (
                    <ValueRow
                      key={row.label}
                      row={row}
                      value={inline ? control : undefined}
                      control={inline ? undefined : control}
                      actions={
                        edit && (rowAction(row) !== null || row.sides) ? (
                          <RowActions row={row} onEdit={edit} onSplit={onSplit} />
                        ) : undefined
                      }
                    />
                  )
                })}
              </div>
            </PanelSection>
          ))}
        </PanelContentSurface>
      )}
    </>
  )
}

// The axes of the container of the Layout section, from its Display and
// Direction rows.
function axesOf(section: InspectorSection): Axes {
  const value = (property: string) => section.rows.find((row) => row.properties[0] === property)?.value ?? ''
  return { grid: value('display').includes('grid'), direction: value('flex-direction') }
}

// A row of the Layout section: a direction, wrap, alignment or justification
// value has a segmented control of its keywords; the display stays
// read-only. The rows other than the display show only for a flex or grid
// container (see `inspectorModel`).
function LayoutRow({ row, section, onEdit }: { row: InspectorRow; section: InspectorSection; onEdit: Apply | null }) {
  const property = row.properties[0]
  if (!onEdit || property === undefined || !isLayoutProperty(property)) return <ValueRow row={row} />
  return (
    <ValueRow
      row={row}
      control={
        <LayoutControl
          property={property}
          value={row.value}
          label={row.label}
          axes={axesOf(section)}
          onPick={(value) => onEdit((target, width) => layoutEdit(property, row.value, value, target, width, row.media))}
        />
      }
    />
  )
}

// The buttons of a row: "Link" for a value equal to a token, "Use nearest"
// for a value with a nearest token, and the split or the join of four sides.
function RowActions({ row, onEdit, onSplit }: { row: InspectorRow; onEdit: Apply; onSplit: (key: SidesKey) => void }) {
  const action = rowAction(row)
  const state = row.state
  const nearest = state?.state === 'none' ? state.nearest : null
  const sides = row.sides
  return (
    <>
      {action === 'link' && state?.state === 'equal' && (
        <Button
          size="xs"
          variant="ghost"
          title={`Link to ${state.token.name}`}
          onClick={() => onEdit((target, width) => rowEdit(row, state.token, target, width))}
          data-row-action="link"
        >
          <LinkSimpleIcon data-icon="inline-start" />
          Link
        </Button>
      )}
      {action === 'nearest' && nearest && (
        <Button
          size="xs"
          variant="ghost"
          title={`Use ${nearest.name}`}
          onClick={() => onEdit((target, width) => rowEdit(row, nearest, target, width))}
          data-row-action="nearest"
        >
          <MagnetIcon data-icon="inline-start" />
          Use nearest
        </Button>
      )}
      {sides && (
        <span data-row-action={sides.split ? 'join' : 'split'}>
          <PanelIconButton
            label={sides.split ? 'One value for all sides' : 'One value for each side'}
            onClick={() => onSplit(sides.key)}
          >
            {sides.split ? <ArrowsInCardinalIcon /> : <ArrowsOutCardinalIcon />}
          </PanelIconButton>
        </span>
      )}
    </>
  )
}

// The text of the element. The input saves the text on Enter and when it loses
// the focus; Escape puts back the text. An empty text puts back the text too.
// The text field commits on Enter and again on the blur that Enter calls, in
// one run of the event, before the panel renders the new text. The second
// commit of the same value in that run does nothing: after a text back to its
// code value, the first one took the edit out, and the second one, with the
// shown (previewed) text of this render, would make a new edit from it back
// to the code. The mark goes away when the run ends.
function ContentSection({ text, onText }: { text: string; onText: (text: string) => void }) {
  const sent = useRef<string | null>(null)
  const commit = (next: string) => {
    if (sent.current === next) return
    sent.current = next
    queueMicrotask(() => {
      sent.current = null
    })
    onText(next)
  }
  return (
    <PanelSection title="Content" spacing="technical" data-section="Content">
      <TextInputControl name="Text" value={text} commitOnBlur onValueChange={commit} />
    </PanelSection>
  )
}

const copyLabels: Record<CopyState, string> = {
  idle: 'Copy the place in the code',
  copied: 'Copied',
  failed: 'Cannot copy to the clipboard',
}

// The place of the element in the screen file, with a button that copies it.
function CodePlace({ place }: { place: string }) {
  const [copied, copy] = useCopy(place)

  return (
    <div className="flex min-w-0 items-center gap-1" data-code-place="">
      <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-[color:var(--muted-foreground)]" title={place}>
        {place}
      </code>
      <PanelIconButton label={copyLabels[copied]} onClick={copy}>
        {copied === 'copied' ? <CheckIcon /> : <CopyIcon />}
      </PanelIconButton>
    </div>
  )
}
