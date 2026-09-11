import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function FaqAccordion({
  items,
}: {
  items: { question: string; answer: string }[];
}) {
  return (
    <Accordion type="single" collapsible className="w-full">
      {items.map((item, i) => (
        <AccordionItem
          key={item.question}
          value={`item-${i}`}
          className="border-b border-border"
        >
          <AccordionTrigger className="py-6 text-left text-lg font-semibold hover:no-underline">
            {item.question}
          </AccordionTrigger>
          <AccordionContent className="pb-6 text-base leading-relaxed text-muted-foreground">
            {item.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
