import { cn } from "@/lib/utils";

export type ListItem = { title: string; description?: string };

/**
 * Numbered hairline list for the service pages ("Ce construim", "Ce automatizăm"): a rule
 * on top, one row per item with its number in the label colour, the title and an optional
 * line under it. Two columns from sm, three from lg when `columns` is 3.
 */
export function ItemList({
  items,
  columns = 3,
  className,
}: {
  items: ListItem[];
  columns?: 2 | 3;
  className?: string;
}) {
  return (
    <ol
      className={cn(
        "grid border-t border-rule sm:grid-cols-2 sm:gap-x-8",
        columns === 3 && "lg:grid-cols-3",
        className,
      )}
    >
      {items.map((item, index) => (
        <li
          key={item.title}
          className="grid grid-cols-[2rem_minmax(0,1fr)] items-baseline gap-x-3 border-b border-line-1 py-4"
        >
          <span aria-hidden className="type-pnum text-[0.8125rem] text-fg-3">
            {index + 1}
          </span>
          <div className="min-w-0">
            <h3 className="type-h4 text-pretty text-fg">{item.title}</h3>
            {item.description && (
              <p className="type-body-sm mt-1 max-w-[60ch] text-pretty text-fg-2">
                {item.description}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
