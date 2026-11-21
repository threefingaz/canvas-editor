// The header of a list in the inspector column: its title and, when it is
// known, the count of its items in a muted color. The count carries the
// attribute `data-<name>-count` for a check from the console.
export function ListHeader({ title, name, count }: { title: string; name: string; count?: number }) {
  return (
    <h3 className="m-0 flex shrink-0 items-baseline gap-2 px-3 pt-3 pb-1 text-xs font-semibold">
      {title}
      {count !== undefined && (
        <span className="font-normal text-[color:var(--muted-foreground)] tabular-nums" {...{ [`data-${name}-count`]: count }}>
          {count}
        </span>
      )}
    </h3>
  )
}
