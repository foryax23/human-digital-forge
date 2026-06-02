import { Link } from "@tanstack/react-router";

export const navLinks = [
  { label: "Services", to: "/services" },
  { label: "AI Automation", to: "/ai-automation" },
  { label: "Websites", to: "/websites" },
  { label: "Consultancy", to: "/consultancy" },
  { label: "Portfolio", to: "/portfolio" },
  { label: "Contact", to: "/contact" },
] as const;

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link to="/" className={className} aria-label="Vortex Hub home">
      <span className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-gradient-brand text-[0.95rem] font-semibold text-primary-foreground">
          V
        </span>
        <span className="font-serif text-xl leading-none tracking-tight">Vortex Hub</span>
      </span>
    </Link>
  );
}
