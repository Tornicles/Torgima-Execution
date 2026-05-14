import { Link } from "wouter";

/** Browser UI for notification unsubscribe; token handling can be added when wired to API. */
export default function UnsubscribePage() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-8">
      <div className="max-w-lg w-full rounded-2xl border border-gray-200 bg-white p-8 shadow-sm space-y-4">
        <h1 className="text-xl font-bold text-gray-900">Notifications — unsubscribe</h1>
        <p className="text-sm text-gray-600 leading-relaxed">
          If you followed an email link, your preferences are processed server-side. This page is a fallback confirmation.
        </p>
        <p className="text-sm text-gray-500">Contact support if you still receive unwanted messages.</p>
        <Link href="/">
          <span className="inline-block text-sm font-semibold text-green-600 hover:underline cursor-pointer">Return home</span>
        </Link>
      </div>
    </div>
  );
}
