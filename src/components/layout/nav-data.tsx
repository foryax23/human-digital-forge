import { Link } from "@tanstack/react-router";

import wordmarkAsset from "@/assets/brand/vortex-hub-wordmark.png.asset.json";
import markAsset from "@/assets/brand/vortex-hub-mark.png.asset.json";

export const navLinks = [
  { en: "Services", ro: "Servicii", to: "/services" },
  { en: "AI Automation", ro: "Automatizare AI", to: "/ai-automation" },
  { en: "Websites", ro: "Site-uri web", to: "/websites" },
  { en: "Consultancy", ro: "Consultanță", to: "/consultancy" },
  { en: "Portfolio", ro: "Portofoliu", to: "/portfolio" },
  { en: "Contact", ro: "Contact", to: "/contact" },
] as const;

export const brandAssets = {
  wordmark: wordmarkAsset.url,
  mark: markAsset.url,
};

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link to="/" className={className} aria-label="Vortex Hub home">
      <span className="flex items-center gap-2.5">
        <img
          src={brandAssets.mark}
          alt=""
          aria-hidden
          width={40}
          height={40}
          className="h-10 w-10 shrink-0 drop-shadow-[0_0_12px_oklch(0.66_0.22_305/0.55)] sm:hidden"
        />
        <img
          src={brandAssets.wordmark}
          alt="Vortex Hub"
          width={160}
          height={44}
          className="hidden h-10 w-auto object-contain drop-shadow-[0_0_18px_oklch(0.66_0.22_305/0.35)] sm:block"
        />
      </span>
    </Link>
  );
}
