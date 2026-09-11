import { Link } from "@tanstack/react-router";

import logoAsset from "@/assets/brand/vortex-logo.png.asset.json";


export const navLinks = [
  { en: "Services", ro: "Servicii", to: "/services" },
  { en: "Free audit", ro: "Audit gratuit", to: "/audit" },
  { en: "AI Automation", ro: "Automatizare AI", to: "/ai-automation" },
  { en: "Websites", ro: "Site-uri web", to: "/websites" },
  { en: "Consultancy", ro: "Consultanță", to: "/consultancy" },
  { en: "Portfolio", ro: "Portofoliu", to: "/portfolio" },
  { en: "Contact", ro: "Contact", to: "/contact" },
] as const;

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link to="/" className={className} aria-label="Vortex Hub home">
      <img
        src={logoAsset.url}
        alt="Vortex Hub"
        width={1376}
        height={768}
        className="h-10 w-auto drop-shadow-[0_0_18px_oklch(0.585_0.225_277_/_0.45)] sm:h-11"
      />
    </Link>
  );
}
