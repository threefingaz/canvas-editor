import {
  ArrowsInCardinalIcon,
  ArrowsOutCardinalIcon,
  CheckIcon,
  CopyIcon,
  CursorClickIcon,
  LinkSimpleIcon,
  MagnetIcon,
  PlayIcon,
  TrashIcon,
} from '@phosphor-icons/react'
import { Fragment, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import { library, screens, type ScreenEntry } from 'virtual:canvas-screens'
import type { Edit, Target } from '../../requests/format.ts'
import { useOperate } from '../canvas/operate.ts'
import { messageOf } from '../../tokens/format.ts'
import { useCopy, type CopyState } from '../copy.ts'
import type { Item } from '../edits/model.ts'
import { edits, useScreenEdits } from '../edits/store.ts'
import { typingInActive } from '../focus.ts'
import { frameWindowOf, inLiveFrame } from '../frame-window.ts'
import { IssuesPanel } from '../issues/IssuesPanel.tsx'
import { breadcrumb, elementOf, fiberName, siteOf, type Fiber, type Site } from '../locate/fiber.ts'
import { codeText, ownTextNode } from '../preview/apply.ts'
import { editAttribute } from '../preview/css.ts'
import { nodesAt, pickElement, siblingsOf } from '../selection/pick.ts'
import { selection, useSelection, type Selected } from '../selection/store.ts'
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
  TextInputControl,
} from '../ui'
import { Changes } from './Changes.tsx'
import { CommentBox } from './CommentBox.tsx'
import {
  controlOf,
  elementComment,
  isLayoutProperty,
  layoutEdit,
  movePlan,
  orderEdit,
  removeEdit,
  rowAction,
  rowEdit,
  screenComment,
  targetOf,
  textEdit,
  textEditable,
} from './edit.ts'
import { LayoutControl, MoveControls, type Axes } from './LayoutControls.tsx'
import { inspectorModel, type InspectorRow, type InspectorSection, type SectionTitle, type SidesKey } from './model.ts'
import { TokenControl } from './TokenControl.tsx'
import { ValueRow } from './ValueRow.tsx'

// The column at the right of the editor. For the selected element: its type,
// its component, its parents, its place in the screen file, and its style
// values with the state of each. A value of the sections in `editable` has a
// control that gives a token to the value, a "Link" or "Use nearest" action
// when it has no token link, and a row of four equal sides can be split into
// one row for each side. The Layout section has a segmented control for the
// direction, the wrap, the alignment and the justification of a flex or grid
// container, and the buttons that move the element among its siblings. The
// Content section changes the text of an element whose place gives one text.
// The comment box below the sections adds a comment for the agent on the
// element; with nothing selected, the box of the screen view adds a comment on
// the whole screen. A comment has no preview.
// The bin in the header (and the Delete and Backspace keys) removes the
// element and clears the selection. An edit goes to the edits store, and the
// preview shows it in the frame. The Changes list of the screen is at the
// bottom; with nothing selected, the inspector shows the list of the screen of
// the last click on a frame or its title, with the Issues list of the screen
// above it. With the Preview switch on, nothing can be selected, and the
// inspector says how to go back.

// The sections whose values have a control.
const editable: ReadonlySet<SectionTitle> = new Set(['Color', 'Elevation', 'Typography', 'Spacing', 'Corners'])

// Builds an edit from the target and the width of the frame.
type Build = (target: Target, width: number) => Edit | null

// Gives the edit that `build` makes to the edits store. `replaces`: the ids of
// the edits that the new edit replaces.
type Apply = (build: Build, replaces?: readonly string[]) => void

// The edits of the selected element: the target is read from the frame at the
// time of the change (the count of copies and the text can change), and the
// width is the width of the frame of the screen.
function applyFor(selected: Selected, site: Site): Apply {
  return (build, replaces) => {
    const width = screens.find((screen) => screen.id === selected.screenId)?.width
    if (width === undefined) return
    const copies = nodesAt(selected.node.ownerDocument, selected.loc).length
    const target = targetOf(
      site,
      selected.node.tagName.toLowerCase(),
      Math.max(copies, 1),
      // The text as the code renders it: a text edit of the preview does not
      // change the label, thus the edit is found again after a reload.
      codeText(selected.node),
    )
    const edit = build(target, width)
    if (edit) edits.apply(selected.screenId, edit, replaces)
  }
}

// The move of the element among the sibling elements of its parent, for the
// Layout section.
type Move = { position: number; count: number; previewed: boolean; onMove: (next: number) => void }

// The move of the selected element (`movePlan`); null when a sequence edit
// is not possible.
function moveOf(selected: Selected, items: readonly Item[], copies: number, onEdit: Apply | null): Move | null {
  if (!onEdit) return null
  const document = selected.node.ownerDocument
  const parent = selected.node.parentElement
  const plan = movePlan(
    selected.loc,
    siblingsOf(selected.node, selected.loc, copies),
    items,
    (loc) => nodesAt(document, loc)[0]?.parentElement === parent,
  )
  if (!plan) return null
  const { position, count, previewed, replaced } = plan
  return {
    position,
    count,
    previewed,
    onMove: (next) => onEdit((target, width) => orderEdit(position, next, count, previewed, target, width), replaced),
  }
}

type InspectorProps = {
  // The screen of the last click on a frame or on its title: with nothing
  // selected, the inspector shows the Changes list of that screen.
  screenId: string | null
  // The current document of each frame, by screen id.
  documents: ReadonlyMap<string, Document>
}

export function Inspector({ screenId, documents }: InspectorProps) {
  const selected = useSelection()
  const operating = useOperate()
  const tokenFile = useTokenFile()
  const screen = screenId === null ? undefined : screens.find((entry) => entry.id === screenId)
  return (
    <aside className="relative h-full w-[300px] shrink-0" data-inspector="">
      <PanelSurface className="flex h-full flex-col rounded-none border-y-0 border-r-0">
        {library !== null && tokenFile.error !== null && (
          <div className="shrink-0 p-3" data-token-file-error="">
            <Alert variant="destructive">
              <AlertTitle>The tokens are not loaded</AlertTitle>
              <AlertDescription>{tokenFile.error}</AlertDescription>
            </Alert>
          </div>
        )}
        {operating ? (
          <PreviewOn />
        ) : selected ? (
          <ElementView key={`${selected.screenId}|${selected.loc}|${selected.index}`} selected={selected} />
        ) : screen ? (
          <ScreenView screen={screen} document={documents.get(screen.id) ?? null} />
        ) : (
          <NothingSelected />
        )}
      </PanelSurface>
    </aside>
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

function PreviewOn() {
  return (
    <Empty className="text-xs" data-inspector-operate="">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <PlayIcon />
        </EmptyMedia>
        <EmptyTitle>Preview is on</EmptyTitle>
        <EmptyDescription>
          A click on a link in a frame goes to the frame of its screen. Turn Preview off in the toolbar to select and edit
          elements.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

// A screen with nothing selected: its title, its file, its Issues list, the
// box for a comment on the screen, and its Changes list below it.
function ScreenView({ screen, document }: { screen: ScreenEntry; document: Document | null }) {
  return (
    <>
      <header className="flex shrink-0 flex-col gap-1 p-3" data-inspector-screen={screen.id}>
        <h2 className="m-0 min-w-0 truncate text-sm font-semibold">{screen.title}</h2>
        <code className="min-w-0 truncate font-mono text-[11px] text-[color:var(--muted-foreground)]" title={screen.file}>
          {screen.file}
        </code>
        <p className="m-0 text-xs text-[color:var(--muted-foreground)]">Click an element in the frame to edit it.</p>
      </header>
      <IssuesPanel screenId={screen.id} document={document} className="flex-1" />
      <CommentBox
        key={screen.id}
        name="screen"
        submit="Add"
        className="border-t border-[color:var(--border)] p-3"
        onSubmit={(text) => {
          const comment = screenComment(screen.width, text)
          if (comment) edits.apply(screen.id, comment)
        }}
      />
      <Changes screenId={screen.id} document={document} empty="No changes in this screen." className="max-h-[40%]" />
    </>
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

// Calls `remove` on the Delete and Backspace keys, when no field that takes
// text has the focus.
function useRemoveKeys(remove: (() => void) | null) {
  const current = useRef(remove)
  useEffect(() => {
    current.current = remove
  })
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
      if (!current.current || typingInActive()) return
      event.preventDefault()
      current.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
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
  // A change of the styles reads them again: a new key gives a new view.
  const changes = useStyleChanges(selected.node)
  const tag = selected.node.tagName.toLowerCase()
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

  const onEdit = site ? applyFor(selected, site) : null
  const move = moveOf(selected, items, copies, onEdit)
  // The selection is cleared only when the remove edit went to the store: the
  // preview then hides the element.
  const remove = onEdit
    ? () => {
        const before = edits.get(selected.screenId)
        onEdit((target, width) => removeEdit(target, width))
        if (edits.get(selected.screenId) !== before) selection.clear()
      }
    : null
  useRemoveKeys(remove)

  const selectParent = (parent: Fiber) => {
    const picked = pickElement(selected.node.ownerDocument, parent)
    if (picked) selection.select({ ...picked, screenId: selected.screenId })
  }

  return (
    <>
      <header className="flex shrink-0 flex-col gap-2 p-3" data-inspector-header="">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex min-w-0 flex-1 items-baseline gap-2">
            <h2 className="m-0 min-w-0 truncate text-sm font-semibold" data-element-name="">
              {selected.name}
            </h2>
            <span className="min-w-0 truncate text-xs text-[color:var(--muted-foreground)]" data-element-type="">
              {site?.origin === 'host' ? 'HTML element' : `component${component ? ` ${component}` : ''}, renders <${tag}>`}
            </span>
          </div>
          {remove && (
            <span className="shrink-0" data-remove-element="">
              <PanelIconButton label="Remove the element (Delete)" onClick={remove}>
                <TrashIcon />
              </PanelIconButton>
            </span>
          )}
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
        key={changes}
        node={selected.node}
        onEdit={onEdit}
        move={move}
        split={split}
        onSplit={toggleSplit}
        content={
          onEdit && text !== null ? (
            <ContentSection text={text} onText={(next) => onEdit((target, width) => textEdit(text, next, target, width))} />
          ) : null
        }
      />
      {onEdit && (
        <CommentBox
          name="element"
          submit="Add"
          className="border-t border-[color:var(--border)] p-3"
          onSubmit={(comment) => onEdit((target, width) => elementComment(target, width, comment))}
        />
      )}
      <Changes screenId={selected.screenId} document={selected.node.ownerDocument} className="max-h-[40%]" />
    </>
  )
}

// The count of the values with no token link and the sections of the values.
// With no `onEdit` (an element with no place in the code) the values are
// read-only.
type StylesProps = {
  node: Element
  onEdit: Apply | null
  // The move of the element among its siblings; null when it cannot move.
  move: Move | null
  split: ReadonlySet<SidesKey>
  onSplit: (key: SidesKey) => void
  // The Content section, first in the sections; null when the text cannot
  // change.
  content: ReactNode
}

function StylesView({ node, onEdit, move, split, onSplit, content }: StylesProps) {
  const read = useMemo(() => stylesOf(node), [node])
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
      {model && (
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
                  return (
                    <ValueRow
                      key={row.label}
                      row={row}
                      control={
                        edit && controlOf(row) ? (
                          <TokenControl
                            row={row}
                            onPick={(token) => edit((target, width) => rowEdit(row, token, target, width))}
                          />
                        ) : undefined
                      }
                      actions={
                        edit && (rowAction(row) !== null || row.sides) ? (
                          <RowActions row={row} onEdit={edit} onSplit={onSplit} />
                        ) : undefined
                      }
                    />
                  )
                })}
                {section.title === 'Layout' && move && <MoveControls {...move} />}
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
function ContentSection({ text, onText }: { text: string; onText: (text: string) => void }) {
  return (
    <PanelSection title="Content" spacing="technical" data-section="Content">
      <TextInputControl name="Text" value={text} commitOnBlur onValueChange={onText} />
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
