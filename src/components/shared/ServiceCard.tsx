import { Link } from "@tanstack/react-router";
import { ArrowRight, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function ServiceCard({
  icon: Icon,
  title,
  description,
  linkLabel,
  to,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  linkLabel: string;
  to: string;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "group flex flex-col rounded-sm border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm",
        className,
      )}
    >
      <span className="grid h-11 w-11 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-5 text-xl">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
        {linkLabel}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
