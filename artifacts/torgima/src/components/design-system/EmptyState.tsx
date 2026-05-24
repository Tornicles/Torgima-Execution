export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
      <p className="font-semibold text-gray-900">{title}</p>
      {message && <p className="mt-2 text-sm text-gray-600">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
