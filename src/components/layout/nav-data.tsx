import { Link } from "@tanstack/react-router";

export const navLinks = [
  { en: "Services", ro: "Servicii", to: "/services" },
  { en: "AI Automation", ro: "Automatizare AI", to: "/ai-automation" },
  { en: "Websites", ro: "Site-uri web", to: "/websites" },
  { en: "Consultancy", ro: "Consultanță", to: "/consultancy" },
  { en: "Portfolio", ro: "Portofoliu", to: "/portfolio" },
  { en: "Contact", ro: "Contact", to: "/contact" },
] as const;

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link to="/" className={className} aria-label="Vortex Hub home">
      <span className="flex items-center gap-2.5">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand text-lg font-bold text-primary-foreground glow-soft">
          V
        </span>
        <span className="flex flex-col font-sans text-lg font-semibold leading-[0.95] tracking-tight">
          <span>Vortex</span>
          <span>Hub</span>
        </span>
      </span>
    </Link>
  );
}
