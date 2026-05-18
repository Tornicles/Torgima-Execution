import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { applyExecutionLanguage } from "@/lib/execution-language";

export interface AcademyOrderCardProps {
  order: {
    id: string;
    title?: string;
    instruction?: string;
    status?: string;
  };
  lessonNumber?: number;
  totalLessons?: number;
  skillCategory?: string;
  masteryDefinition?: string;
  selfCheck?: string[];
}

export function AcademyOrderCard({
  order,
  lessonNumber,
  totalLessons,
  skillCategory,
  masteryDefinition,
  selfCheck,
}: AcademyOrderCardProps) {
  const title = applyExecutionLanguage(order.title ?? "Capability Development Order");
  const instruction = order.instruction
    ? applyExecutionLanguage(order.instruction)
    : "Apply this execution skill with documented mastery evidence.";

  const progressLabel =
    lessonNumber && totalLessons
      ? `Execution step ${lessonNumber} of ${totalLessons}${skillCategory ? ` — ${skillCategory.replace(/_/g, " ")}` : ""}`
      : skillCategory
        ? `Execution skill: ${skillCategory.replace(/_/g, " ")}`
        : null;

  return (
    <section className="rounded-2xl border-2 border-indigo-900 bg-indigo-50/40 p-6 space-y-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-800">
            Capability Development
          </p>
          {progressLabel ? (
            <p className="text-xs text-indigo-700 mt-1 font-mono">{progressLabel}</p>
          ) : null}
          <h2 className="text-xl font-bold text-gray-900 mt-1">{title}</h2>
        </div>
        {order.status ? (
          <span className="text-xs font-mono uppercase text-indigo-600">{order.status}</span>
        ) : null}
      </div>
      <p className="text-sm text-gray-700 line-clamp-4">{instruction}</p>
      {masteryDefinition ? (
        <div className="rounded-lg border border-indigo-200 bg-white p-3 text-xs text-gray-800">
          <p className="font-semibold text-indigo-900 mb-1">Mastery evidence required</p>
          <p>{applyExecutionLanguage(masteryDefinition)}</p>
        </div>
      ) : null}
      {selfCheck && selfCheck.length > 0 ? (
        <ul className="text-xs text-gray-600 list-disc pl-4 space-y-1">
          {selfCheck.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
      ) : null}
      <Link href={`/tasks/${order.id}`}>
        <span className="inline-flex items-center gap-2 bg-indigo-900 text-white text-sm font-semibold px-5 py-3 rounded-xl hover:bg-indigo-800 cursor-pointer">
          Apply this capability
          <ChevronRight className="w-4 h-4" />
        </span>
      </Link>
    </section>
  );
}
