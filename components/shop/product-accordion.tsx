import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function ProductAccordion({
  description,
  shippingNote,
  freeShippingNote,
}: {
  description: string | null;
  shippingNote: string | null;
  freeShippingNote: string | null;
}) {
  return (
    <Accordion type="single" collapsible className="border-t border-line">
      {description && (
        <AccordionItem value="descricao">
          <AccordionTrigger className="text-label !text-fg">
            Descrição
          </AccordionTrigger>
          <AccordionContent className="whitespace-pre-line text-sm text-ink-muted">
            {description}
          </AccordionContent>
        </AccordionItem>
      )}
      <AccordionItem value="entrega">
        <AccordionTrigger className="text-label !text-fg">
          Entrega
        </AccordionTrigger>
        <AccordionContent className="text-sm text-ink-muted">
          {shippingNote ?? "Consulte o prazo de entrega no checkout."}
          {freeShippingNote ? ` ${freeShippingNote}.` : ""}
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="trocas">
        <AccordionTrigger className="text-label !text-fg">
          Trocas e devoluções
        </AccordionTrigger>
        <AccordionContent className="text-sm text-ink-muted">
          Trocas em até 30 dias após o recebimento.{" "}
          <Link
            href="/trocas-e-devolucoes"
            className="underline underline-offset-4 hover:text-fg"
          >
            Ver política completa
          </Link>
          .
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
