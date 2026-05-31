export function CompareTable({
  competitor,
  rows,
}: {
  competitor: string;
  rows: { feature: string; torgima: string; other: string }[];
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-dark-border">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-dark-border bg-dark-card">
            <th className="p-4 text-zinc-500 font-medium">Feature</th>
            <th className="p-4 text-primary-bright font-bold">Torgima</th>
            <th className="p-4 text-zinc-400">{competitor}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.feature} className="border-b border-dark-border/50">
              <td className="p-4 text-zinc-300">{row.feature}</td>
              <td className="p-4 text-white font-medium">{row.torgima}</td>
              <td className="p-4 text-zinc-500">{row.other}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
