import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-md bg-fill-2 motion-safe:animate-pulse", className)} {...props} />
  );
}

export { Skeleton };
