import { Bell, ChevronDown } from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";
import { Link } from "wouter";

export function PageHeaderActions() {
  const { data: me } = useGetMe();
  const displayName = me?.displayName ?? me?.email?.split("@")[0] ?? "Builder";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <>
      <button
        type="button"
        className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
      </button>
      <Link href="/settings">
        <div className="flex items-center gap-1.5 cursor-pointer rounded-lg hover:bg-gray-50 pl-1 pr-2 py-1">
          <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center">
            <span className="text-white text-sm font-bold">{initial}</span>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400 hidden sm:block" />
        </div>
      </Link>
    </>
  );
}
