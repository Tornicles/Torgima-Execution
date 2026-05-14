import { Link } from "wouter";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm text-center space-y-4">
        <div className="flex justify-center gap-2 items-center">
          <AlertCircle className="h-8 w-8 text-red-500 shrink-0" />
          <h1 className="text-2xl font-bold text-gray-900">Page not found</h1>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">
          This path is not part of your execution workspace. Use the links below to get back on track.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link href="/">
            <span className="inline-flex justify-center items-center px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-800 hover:bg-gray-50 cursor-pointer w-full sm:w-auto">
              Home
            </span>
          </Link>
          <Link href="/dashboard">
            <span className="inline-flex justify-center items-center px-5 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 cursor-pointer w-full sm:w-auto">
              Dashboard
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
