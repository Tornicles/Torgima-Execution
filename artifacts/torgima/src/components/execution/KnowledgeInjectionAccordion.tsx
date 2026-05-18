import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export interface KnowledgeInjection {
  sop?: string;
  benchmark?: string;
  tools?: string[] | string;
  commonMistakes?: string[] | string;
  goodOutputExample?: string;
}

export function KnowledgeInjectionAccordion({
  injection,
}: {
  injection: KnowledgeInjection | null | undefined;
}) {
  if (!injection || Object.keys(injection).length === 0) return null;

  const tools =
    Array.isArray(injection.tools) ? injection.tools
    : typeof injection.tools === "string" ? [injection.tools]
    : [];
  const mistakes =
    Array.isArray(injection.commonMistakes) ? injection.commonMistakes
    : typeof injection.commonMistakes === "string" ? [injection.commonMistakes]
    : [];

  return (
    <Accordion type="single" collapsible className="rounded-2xl border border-gray-200 bg-white">
      <AccordionItem value="intel">
        <AccordionTrigger className="px-5 text-sm font-semibold text-gray-900">
          Execution Intelligence
        </AccordionTrigger>
        <AccordionContent className="px-5 pb-5 space-y-4 text-sm text-gray-700">
          {injection.sop ? (
            <section>
              <p className="text-xs font-semibold uppercase text-gray-400 mb-1">SOP</p>
              <p className="whitespace-pre-wrap">{injection.sop}</p>
            </section>
          ) : null}
          {injection.benchmark ? (
            <section>
              <p className="text-xs font-semibold uppercase text-gray-400 mb-1">Benchmark</p>
              <p>{injection.benchmark}</p>
            </section>
          ) : null}
          {tools.length > 0 ? (
            <section>
              <p className="text-xs font-semibold uppercase text-gray-400 mb-1">Tools</p>
              <ul className="list-disc pl-5 space-y-1">
                {tools.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {mistakes.length > 0 ? (
            <section>
              <p className="text-xs font-semibold uppercase text-gray-400 mb-1">Common mistakes</p>
              <ul className="list-disc pl-5 space-y-1">
                {mistakes.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {injection.goodOutputExample ? (
            <section>
              <p className="text-xs font-semibold uppercase text-gray-400 mb-1">Good output example</p>
              <p className="bg-gray-50 rounded-lg p-3 font-mono text-xs">{injection.goodOutputExample}</p>
            </section>
          ) : null}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
