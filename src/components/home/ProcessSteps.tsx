import { motion, useReducedMotion } from "motion/react";

import { SectionHeading } from "@/components/shared/SectionHeading";
import { Reveal } from "@/components/cinematic/Reveal";

const steps = [
  {
    title: "Tell us what you need",
    description: "Submit your idea, request or business challenge.",
  },
  {
    title: "Receive a clear proposal",
    description: "We outline the scope, timeline and price before any work begins.",
  },
  {
    title: "Work begins",
    description: "Follow progress and share feedback through your client area.",
  },
  {
    title: "Review the result",
    description: "Approve designs, test your website or discuss your automation solution.",
  },
  {
    title: "Receive your delivery",
    description: "Download completed files or launch your completed digital solution.",
  },
];

export function ProcessSteps() {
  const reduce = useReducedMotion();

  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <Reveal>
        <SectionHeading title="A simple process, from request to delivery." />
      </Reveal>

      <div className="relative mt-14">
        {/* Illuminated connecting line */}
        <motion.div
          aria-hidden
          className="absolute left-0 top-7 hidden h-px w-full origin-left bg-gradient-to-r from-primary via-teal to-transparent lg:block"
          initial={reduce ? false : { scaleX: 0 }}
          whileInView={reduce ? undefined : { scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map((step, index) => (
            <Reveal key={step.title} delay={index * 0.1}>
              <li className="relative rounded-xl border border-border glass-panel p-6">
                <span className="grid h-14 w-14 place-items-center rounded-full border border-border bg-background font-serif text-2xl text-primary glow-soft">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-lg leading-snug">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
