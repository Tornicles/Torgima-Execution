import { useParams, Link } from "wouter";
import { MessageSquare, CheckCircle2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

export default function FeedbackPage() {
  const params = useParams<{ orderId?: string }>();
  const orderId = params.orderId;

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-8 pb-16">
      <header className="space-y-2 border-b border-gray-200 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center border border-green-100">
            <MessageSquare className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Feedback</h1>
            {orderId ? (
              <p className="text-sm text-gray-500 mt-0.5">
                Order <span className="font-mono text-gray-700">{orderId}</span>
              </p>
            ) : (
              <p className="text-sm text-gray-500 mt-0.5">Weekly review and reflection</p>
            )}
          </div>
        </div>
      </header>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
        <div>
          <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Cycle</p>
          <h2 className="text-lg font-bold text-gray-900">Weekly review</h2>
          <p className="text-sm text-gray-500 mt-1">
            Honest feedback keeps signals and daily orders aligned with your reality.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-800">Overall rating (1–10)</label>
          <div className="flex flex-wrap gap-2">
            {[...Array(10)].map((_, i) => (
              <button
                key={i}
                type="button"
                className="w-9 h-9 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:border-green-500 hover:text-green-700 transition-colors bg-white"
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-800">Wins</label>
          <Textarea className="min-h-[88px] border-gray-200" placeholder="What went well this cycle?" />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-800">Challenges</label>
          <Textarea className="min-h-[88px] border-gray-200" placeholder="What blocked execution?" />
        </div>

        <button
          type="button"
          className="w-full py-3.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors"
        >
          Submit review
        </button>

        <div className="flex flex-wrap gap-4 text-sm text-gray-600 border-t border-gray-100 pt-4">
          <Link href="/dashboard">
            <span className="text-green-600 font-medium cursor-pointer hover:underline">Dashboard</span>
          </Link>
          {orderId && (
            <Link href={`/tasks/${orderId}`}>
              <span className="text-green-600 font-medium cursor-pointer hover:underline inline-flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Back to task
              </span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
