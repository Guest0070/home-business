export default function DataTable({ columns, rows, empty = 'No records found' }) {
  return (
    <div className="data-table glass glass-card overflow-hidden">
      <div className="data-table-mobile md:hidden">
        {rows.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm" style={{ color: 'var(--muted)' }}>{empty}</div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {rows.map((row, index) => (
              <article
                key={row.id || row.lr_number || row.vehicle_id || row.driver_name || index}
                className={`space-y-3 px-4 py-4 ${row.abnormal_diesel ? 'bg-amber-50' : ''}`}
              >
                {columns.map((column) => (
                  <div key={column.key} className="flex items-start justify-between gap-3">
                    <div className="min-w-0 text-xs font-semibold uppercase tracking-normal" style={{ color: 'var(--muted)' }}>
                      {column.label}
                    </div>
                    <div className="min-w-0 text-right text-sm" style={{ color: 'var(--text)' }}>
                      {column.render ? column.render(row) : (row[column.key] ?? '-')}
                    </div>
                  </div>
                ))}
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="data-table-desktop hidden overflow-x-auto md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="data-table-head text-xs uppercase tracking-normal" style={{ color: 'var(--muted)' }}>
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="whitespace-nowrap px-3 py-3 font-semibold">{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center" style={{ color: 'var(--muted)' }} colSpan={columns.length}>{empty}</td>
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
