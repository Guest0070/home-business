export default function DataTable({ columns, rows, empty = 'No records found' }) {
  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
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
                <td className="px-3 py-6 text-center text-slate-500" colSpan={columns.length}>{empty}</td>
              </tr>
            ) : rows.map((row, index) => (
              <tr key={row.id || row.lr_number || row.vehicle_id || row.driver_name || index} className={row.abnormal_diesel ? 'bg-amber-50' : 'bg-white'}>
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

