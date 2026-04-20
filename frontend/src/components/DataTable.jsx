export default function DataTable({ columns, rows, empty = 'No records found' }) {
  return (
    <div className="glass glass-card overflow-hidden">
      <div className="md:hidden">
        {rows.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-white/70">{empty}</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <article
                key={row.id || row.lr_number || row.vehicle_id || row.driver_name || index}
                className={`space-y-3 px-4 py-4 ${row.abnormal_diesel ? 'bg-amber-50' : ''}`}
              >
                {columns.map((column) => (
                  <div key={column.key} className="flex items-start justify-between gap-3">
                    <div className="min-w-0 text-xs font-semibold uppercase tracking-normal text-slate-600">
                      {column.label}
                    </div>
                    <div className="min-w-0 text-right text-sm text-white">
                      {column.render ? column.render(row) : (row[column.key] ?? '-')}
                    </div>
                  </div>
                ))}
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-normal text-slate-600">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="whitespace-nowrap px-3 py-3 font-semibold">{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-white/70" colSpan={columns.length}>{empty}</td>
              </tr>
            ) : rows.map((row, index) => (
              <tr key={row.id || row.lr_number || row.vehicle_id || row.driver_name || index} className={row.abnormal_diesel ? 'bg-amber-50' : 'glass'}>
                {columns.map((column) => (
                  <td key={column.key} className="whitespace-nowrap px-3 py-3">
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
