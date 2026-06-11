import { Link } from "wouter";
import { Mail, ArrowLeft } from "lucide-react";

/**
 * Shown when Supabase signup succeeds but email confirmation is required.
 * User has no session yet — must not redirect to onboarding or protected routes.
 */
export default function SignupCheckEmailPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-8">
        <Link href="/signup">
          <div className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 cursor-pointer w-fit">
            <ArrowLeft className="w-4 h-4" /> Back to signup
          </div>
        </Link>

        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center space-y-5">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <Mail className="w-7 h-7 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Check your email</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            We sent a confirmation link to your email address. Click the link to activate your
            account, then sign in to continue to onboarding.
          </p>
          <p className="text-xs text-gray-400">
            Did not receive it? Check spam or wait a few minutes, then try signing up again.
          </p>
          <Link href="/login">
            <span className="inline-block w-full bg-gray-900 text-white font-semibold py-3.5 rounded-xl hover:bg-gray-800 cursor-pointer">
              Go to sign in
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
