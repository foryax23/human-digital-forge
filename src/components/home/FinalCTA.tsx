import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/cinematic/Reveal";
import { Magnetic } from "@/components/cinematic/Magnetic";
import { useI18n } from "@/i18n";
import swirlLoop from "@/assets/brand/vortex-swirl-loop.mp4.asset.json";
import swirlPoster from "@/assets/brand/vortex-swirl.png.asset.json";


export function FinalCTA() {
  const { t } = useI18n();
  return (
    <section className="relative isolate overflow-hidden border-t border-border bg-ink text-ink-foreground">
      <video
        src={swirlLoop.url}
        poster={swirlPoster.url}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[38rem] w-[38rem] -translate-x-1/2 -translate-y-1/2 object-contain opacity-25 mix-blend-screen motion-reduce:hidden"
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-aurora opacity-40" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_70%_at_50%_50%,transparent_20%,oklch(0.085_0.026_286/0.92)_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-brand opacity-25 blur-3xl animate-glow-pulse"
      />

      <div className="relative mx-auto max-w-4xl px-4 py-28 text-center sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="text-4xl leading-tight sm:text-5xl lg:text-6xl">
            {t("Have a digital project in mind?", "Ai un proiect digital în minte?")}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-ink-foreground/70">
            {t("Tell Vortex Hub what you would like to create, improve or automate.", "Spune-i Vortex Hub ce ai vrea să creezi, să îmbunătățești sau să automatizezi.")}
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Magnetic>
              <Button asChild size="lg" className="glow-soft">
                <Link to="/contact">
                  {t("Start a project", "Începe un proiect")}
                  <ArrowRight />
                </Link>
              </Button>
            </Magnetic>
            <Magnetic>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-ink-foreground/30 text-ink-foreground hover:bg-ink-foreground/10 hover:text-ink-foreground"
              >
                <Link to="/consultancy">{t("Book a consultation", "Programează o consultanță")}</Link>
              </Button>
            </Magnetic>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
