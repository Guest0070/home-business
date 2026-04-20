export default function ImportReview({ title, preview, keyField = 'name', onConfirm, busy }) {
  if (!preview) return null;

  return (
    <section className="panel space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold">{title}</h3>
        <button className="btn-primary" onClick={onConfirm} disabled={busy}>
          {busy ? 'Importing...' : 'Confirm Import'}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded border border-slate-200 px-3 py-2 text-sm">Creates: <strong>{preview.creates}</strong></div>
        <div className="rounded border border-slate-200 px-3 py-2 text-sm">Updates: <strong>{preview.updates}</strong></div>
        <div className="rounded border border-slate-200 px-3 py-2 text-sm">Failed: <strong>{preview.failed}</strong></div>
      </div>

      <div className="space-y-3 md:hidden">
        {preview.rows.slice(0, 12).map((row) => (
          <article key={`${row.rowNumber}-${row[keyField] || row.vehicle_no || row.name}`} className="rounded border border-slate-200 p-3 text-sm">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="font-semibold">Row {row.rowNumber}</div>
              {row.errors?.length ? (
                <span className="rounded bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">Error</span>
              ) : (
                <span className="rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">Ready</span>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs font-semibold uppercase text-slate-600">Action</span>
                <span className="text-right">{row.action}</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs font-semibold uppercase text-slate-600">{keyField}</span>
                <span className="text-right">{row[keyField] || row.vehicle_no || '-'}</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs font-semibold uppercase text-slate-600">Details</span>
                <span className="text-right text-slate-600">
                  {row.errors?.length ? row.errors.join(', ') : 'Will import with current preview values'}
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2">Row</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">{keyField}</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {preview.rows.slice(0, 12).map((row) => (
              <tr key={`${row.rowNumber}-${row[keyField] || row.vehicle_no || row.name}`}>
                <td className="px-3 py-2">{row.rowNumber}</td>
                <td className="px-3 py-2">{row.action}</td>
                <td className="px-3 py-2">{row[keyField] || row.vehicle_no}</td>
                <td className="px-3 py-2">
                  {row.errors?.length ? (
                    <span className="rounded bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">Error</span>
                  ) : (
                    <span className="rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">Ready</span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {row.errors?.length ? row.errors.join(', ') : 'Will import with current preview values'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
