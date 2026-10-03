import { useRef, useState, type ReactNode } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Small "i" button that reveals where a number comes from. A popover rather
 * than a tooltip so it also opens on tap and stays readable on phones; mouse
 * users get it on hover too.
 */
export function InfoTip({
  label,
  children,
  className,
  side = "top",
}: {
  /** Accessible name of the button, e.g. "How we estimate this". */
  label: string;
  children: ReactNode;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hoverOpen = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hoverClose = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    closeTimer.current = setTimeout(() => setOpen(false), 140);
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger
        type="button"
        aria-label={label}
        onPointerEnter={hoverOpen}
        onPointerLeave={hoverClose}
        className={cn(
          "inline-grid h-6 w-6 shrink-0 place-items-center rounded-full text-white/45 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#89cbf6]/80",
          className,
        )}
      >
        <Info aria-hidden className="h-3.5 w-3.5" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side={side}
          sideOffset={6}
          collisionPadding={12}
          onPointerEnter={hoverOpen}
          onPointerLeave={hoverClose}
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="type-micro z-50 max-w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-white/12 bg-[#0b0e26]/95 px-3.5 py-2.5 text-white/85 shadow-[0_18px_50px_-20px_rgb(0_0_0/0.9)] backdrop-blur-xl data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          {children}
          <PopoverPrimitive.Arrow className="fill-[#0b0e26]" width={10} height={5} />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
