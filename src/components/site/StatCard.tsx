import type { ReactNode } from "react";

/** Compact hero credibility tile: a big figure, a label and a glyph. */
export function StatCard({
  value,
  label,
  icon,
}: {
  value: string;
  label: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-5 rounded-2xl bento-panel px-6 py-5 text-left">
      <div>
        <div className="text-3xl font-bold leading-none sm:text-4xl">{value}</div>
        <div className="mt-2 text-sm text-muted-foreground">{label}</div>
      </div>
      {icon && (
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-brand text-primary-foreground glow-soft">
          {icon}
        </span>
      )}
    </div>
  );
}
