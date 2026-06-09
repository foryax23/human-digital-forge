import { cn } from "@/lib/utils";

export function AnimatedGradient({ className }: { className?: string }) {
  return <div aria-hidden className={cn("pointer-events-none absolute inset-0 bg-aurora", className)} />;
}
