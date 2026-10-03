import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type TagTone = "violet" | "blue" | "sky" | "mint" | "neutral" | "outline";

const TONES: Record<TagTone, string> = {
  violet: "border-[#6c63ff]/45 bg-[#6c63ff]/15 text-[#cdc8ff]",
  blue: "border-[#5b8cf0]/45 bg-[#5b8cf0]/12 text-[#c3d5fb]",
  sky: "border-[#89cbf6]/35 bg-[#89cbf6]/10 text-[#c4e6fb]",
  mint: "border-[#5fe3d0]/35 bg-[#5fe3d0]/10 text-[#aef2e8]",
  neutral: "border-white/12 bg-white/[0.05] text-white/75",
  outline: "border-dashed border-white/25 bg-transparent text-white/65",
};

/** Small pill for categories, statuses and phase tags. */
export function Tag({
  tone = "neutral",
  icon,
  children,
  className,
}: {
  tone?: TagTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "type-label inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:shrink-0",
        TONES[tone],
        className,
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}
