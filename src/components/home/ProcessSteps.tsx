import { SectionHeading } from "@/components/shared/SectionHeading";

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
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <SectionHeading title="A simple process, from request to delivery." />
      <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="rounded-xl border border-border bg-card p-6"
          >
            <span className="font-serif text-3xl text-primary">{index + 1}</span>
            <h3 className="mt-3 text-lg leading-snug">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {step.description}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
