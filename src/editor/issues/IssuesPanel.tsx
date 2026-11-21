import type { Issue } from '../../requests/format.ts'
import { locOf } from '../edits/model.ts'
import { ListHeader } from '../inspector/ListHeader.tsx'
import { selectPlace } from '../inspector/select-place.ts'
import { cn } from '../ui/lib/utils.ts'
import { issueGroups, issueSummary } from './model.ts'
import { useScreenIssues } from './store.ts'

// The Issues list of a screen, in groups by kind: render errors, a broken
// relation to a different screen, links to a screen that does not exist,
// elements that are not from the library, values with no token link, and local
// overrides.
// The list is read with the open previews applied. A click on an issue selects
// its element in the frame. The editor writes the same list to the issues file
// of the screen.

type IssuesPanelProps = {
  screenId: string
  // The current frame document of the screen; null when it has none.
  document: Document | null
  className?: string
}

const groupTitle: Record<Issue['kind'], string> = {
  'render-error': 'Render errors',
  relation: 'Relation to a different screen',
  'broken-link': 'Broken links',
  'not-library': 'Not from the library',
  'no-token': 'No token link',
  override: 'Local overrides',
}

export function IssuesPanel({ screenId, document, className }: IssuesPanelProps) {
  const list = useScreenIssues(screenId)
  return (
    <section className={cn('flex min-h-0 flex-col', className)} data-issues={screenId}>
      <ListHeader title="Issues" name="issues" count={list?.length} />
      {list === undefined ? (
        <p className="m-0 px-3 pb-3 text-xs text-[color:var(--muted-foreground)]">Reading the issues…</p>
      ) : list.length === 0 ? (
        <p className="m-0 px-3 pb-3 text-xs text-[color:var(--muted-foreground)]">No issues in this screen.</p>
      ) : (
        <div className="min-h-0 overflow-y-auto pb-2">
          {issueGroups(list).map((group) => (
            <div key={group.kind} data-issue-group={group.kind}>
              <h4 className="m-0 flex items-baseline gap-2 px-3 pt-2 pb-0.5 text-[11px] font-medium text-[color:var(--muted-foreground)]">
                {groupTitle[group.kind]}
                <span className="tabular-nums">{group.issues.length}</span>
              </h4>
              <ul className="m-0 list-none p-0">
                {group.issues.map((issue, index) => (
                  <li key={index} className="px-1.5" data-issue={issue.kind}>
                    <IssueItem issue={issue} screenId={screenId} document={document} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function IssueItem({ issue, screenId, document }: { issue: Issue; screenId: string; document: Document | null }) {
  const summary = issueSummary(issue)
  if (issue.kind === 'render-error') {
    return (
      <p className="m-0 px-1.5 py-1 font-mono text-[11px] whitespace-pre-wrap text-[color:var(--destructive)]">{summary}</p>
    )
  }
  if (issue.kind === 'relation') {
    return (
      <p className="m-0 px-1.5 py-1 text-xs text-[color:var(--attention)]" data-issue-summary="">
        {summary}
      </p>
    )
  }
  const { target } = issue
  return (
    <button
      type="button"
      className="flex w-full min-w-0 cursor-pointer items-baseline gap-2 rounded-md border-0 bg-transparent px-1.5 py-1 text-left text-xs text-inherit hover:bg-[color:var(--muted)] disabled:cursor-default"
      title={`${target.tag}, line ${target.line}: ${summary}`}
      disabled={document === null}
      onClick={() => document && selectPlace(screenId, document, locOf(target))}
    >
      <span className="shrink-0 font-medium">{target.tag}</span>
      <span className="min-w-0 truncate text-[color:var(--muted-foreground)]" data-issue-summary="">
        {summary}
      </span>
    </button>
  )
}
