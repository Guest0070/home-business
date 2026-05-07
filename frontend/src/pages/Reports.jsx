import { useEffect, useMemo, useState } from 'react';
import { api, downloadApiFile } from '../api/client.js';
import DataTable from '../components/DataTable.jsx';
import SectionTabs from '../components/SectionTabs.jsx';

const money = (value) => `Rs ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const tons = (value) => `${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })} t`;

const reportTabs = [
  { key: 'trip-profit', label: 'Trip Profit', hint: 'Operations' },
  { key: 'truck-profit', label: 'Truck Profit', hint: 'Operations' },
  { key: 'driver-performance', label: 'Driver Performance', hint: 'Operations' },
  { key: 'diesel-usage', label: 'Diesel Usage', hint: 'Operations' },
  { key: 'delivery-orders', label: 'D.O. Tracker', hint: 'Operations' },
  { key: 'payments', label: 'Payments', hint: 'Finance' },
  { key: 'salary-payments', label: 'Driver Salary', hint: 'Finance' },
  { key: 'bank-accounts', label: 'Bank Accounts', hint: 'Finance' },
  { key: 'bank-transactions', label: 'Bank Transactions', hint: 'Finance' },
  { key: 'bank-loans', label: 'Bank Loans', hint: 'Finance' },
  { key: 'loan-installments', label: 'Loan Schedule', hint: 'Finance' },
  { key: 'compliance-reminders', label: 'Compliance', hint: 'Compliance' }
];

const columns = {
  'trip-profit': [
    { key: 'trip_date', label: 'Date' },
    { key: 'lr_number', label: 'LR' },
    { key: 'vehicle_no', label: 'Truck' },
    { key: 'driver_name', label: 'Driver' },
    { key: 'outward_freight', label: 'Outward', render: (row) => money(row.outward_freight) },
    { key: 'return_freight', label: 'Return', render: (row) => money(row.return_freight) },
    { key: 'freight', label: 'Revenue', render: (row) => money(row.freight) },
    { key: 'total_expense', label: 'Expense', render: (row) => money(row.total_expense) },
    { key: 'profit', label: 'Profit', render: (row) => money(row.profit) }
  ],
  'truck-profit': [
    { key: 'vehicle_no', label: 'Truck' },
    { key: 'ownership', label: 'Type' },
    { key: 'trips', label: 'Trips' },
    { key: 'distance_km', label: 'KM' },
    { key: 'freight', label: 'Freight', render: (row) => money(row.freight) },
    { key: 'profit', label: 'Profit', render: (row) => money(row.profit) }
  ],
  'driver-performance': [
    { key: 'driver_name', label: 'Driver' },
    { key: 'total_trips', label: 'Trips' },
    { key: 'total_profit', label: 'Profit', render: (row) => money(row.total_profit) },
    { key: 'average_profit', label: 'Avg Profit', render: (row) => money(row.average_profit) },
    { key: 'mileage', label: 'Mileage' },
    { key: 'abnormal_diesel_trips', label: 'Diesel Flags' }
  ],
  'diesel-usage': [
    { key: 'trip_date', label: 'Date' },
    { key: 'lr_number', label: 'LR' },
    { key: 'vehicle_no', label: 'Truck' },
    { key: 'driver_name', label: 'Driver' },
    { key: 'diesel_litres', label: 'Diesel' },
    { key: 'mileage', label: 'Mileage' },
    { key: 'abnormal_diesel', label: 'Flag', render: (row) => row.abnormal_diesel ? 'Abnormal' : 'OK' }
  ],
  'delivery-orders': [
    { key: 'do_number', label: 'D.O.' },
    { key: 'issue_date', label: 'Issue Date' },
    { key: 'mine_name', label: 'Mine' },
    { key: 'factory_name', label: 'Party' },
    { key: 'total_tons', label: 'Ordered', render: (row) => tons(row.total_tons) },
    { key: 'delivered_tons', label: 'Delivered', render: (row) => tons(row.delivered_tons) },
    { key: 'pending_tons', label: 'Pending', render: (row) => tons(row.pending_tons) },
    { key: 'completion_percent', label: 'Completion %' },
    { key: 'tracking_status', label: 'Tracker' },
    { key: 'days_left', label: 'Days Left', render: (row) => row.days_left ?? '-' }
  ],
  payments: [
    { key: 'payment_date', label: 'Date' },
    { key: 'do_number', label: 'D.O.', render: (row) => row.do_number || '-' },
    { key: 'factory_name', label: 'Party' },
    { key: 'bank_account_name', label: 'Bank', render: (row) => row.bank_account_name || '-' },
    { key: 'amount', label: 'Amount', render: (row) => money(row.amount) },
    { key: 'mode', label: 'Mode' },
    { key: 'narration', label: 'Narration', render: (row) => row.narration || row.notes || '-' }
  ],
  'salary-payments': [
    { key: 'payment_date', label: 'Date' },
    { key: 'driver_name', label: 'Driver' },
    { key: 'driver_salary', label: 'Salary Set', render: (row) => money(row.driver_salary) },
    { key: 'amount', label: 'Paid', render: (row) => money(row.amount) },
    { key: 'reference_no', label: 'Reference', render: (row) => row.reference_no || '-' },
    { key: 'narration', label: 'Narration' },
    { key: 'notes', label: 'Notes', render: (row) => row.notes || '-' }
  ],
  'bank-accounts': [
    { key: 'account_name', label: 'Account' },
    { key: 'bank_name', label: 'Bank' },
    { key: 'account_holder_name', label: 'Holder', render: (row) => row.account_holder_name || '-' },
    { key: 'account_number_last4', label: 'A/C Last 4', render: (row) => row.account_number_last4 || '-' },
    { key: 'ifsc_code', label: 'IFSC', render: (row) => row.ifsc_code || '-' },
    { key: 'current_balance', label: 'Current Balance', render: (row) => money(row.current_balance) },
    { key: 'zoho_account_name', label: 'Sales Book', render: (row) => row.zoho_account_name || '-' },
    { key: 'tally_ledger_name', label: 'Ledger', render: (row) => row.tally_ledger_name || '-' }
  ],
  'bank-transactions': [
    { key: 'entry_date', label: 'Date' },
    { key: 'account_name', label: 'Account' },
    { key: 'direction', label: 'Direction' },
    { key: 'amount', label: 'Amount', render: (row) => money(row.amount) },
    { key: 'narration', label: 'Narration' },
    { key: 'reference_no', label: 'Reference', render: (row) => row.reference_no || '-' },
    { key: 'source_type', label: 'Source' }
  ],
  'bank-loans': [
    { key: 'loan_name', label: 'Loan' },
    { key: 'lender_name', label: 'Lender' },
    { key: 'account_name', label: 'Bank Account', render: (row) => row.account_name || '-' },
    { key: 'principal_amount', label: 'Principal', render: (row) => money(row.principal_amount) },
    { key: 'outstanding_amount', label: 'Outstanding', render: (row) => money(row.outstanding_amount) },
    { key: 'emi_amount', label: 'EMI', render: (row) => row.emi_amount ? money(row.emi_amount) : '-' },
    { key: 'next_installment_due', label: 'Next Due', render: (row) => row.next_installment_due || row.next_due_date || '-' }
  ],
  'loan-installments': [
    { key: 'due_date', label: 'Due Date' },
    { key: 'loan_name', label: 'Loan' },
    { key: 'lender_name', label: 'Lender' },
    { key: 'account_name', label: 'Bank Account', render: (row) => row.account_name || '-' },
    { key: 'amount', label: 'Amount', render: (row) => money(row.amount) },
    { key: 'status', label: 'Status' },
    { key: 'paid_on', label: 'Paid On', render: (row) => row.paid_on || '-' },
    { key: 'notes', label: 'Notes', render: (row) => row.notes || '-' }
  ],
  'compliance-reminders': [
    { key: 'vehicle_no', label: 'Vehicle' },
    { key: 'chassis_last5', label: 'Chassis Last 5', render: (row) => row.chassis_last5 || '-' },
    { key: 'document_type', label: 'Document' },
    { key: 'reference_no', label: 'Reference', render: (row) => row.reference_no || '-' },
    { key: 'due_date', label: 'Due Date' },
    { key: 'days_left', label: 'Days Left', render: (row) => row.days_left ?? '-' },
    { key: 'reminder_state', label: 'State' }
  ]
};

function buildQuery(filters) {
  const params = new URLSearchParams();
  if (filters.fromDate && filters.fromTime) params.set('from_at', `${filters.fromDate}T${filters.fromTime}`);
  else if (filters.fromDate) params.set('from', filters.fromDate);
  if (filters.toDate && filters.toTime) params.set('to_at', `${filters.toDate}T${filters.toTime}`);
  else if (filters.toDate) params.set('to', filters.toDate);
  return params.toString();
}

function exportWindowLabel(filters) {
  const from = filters.fromDate
    ? `${filters.fromDate}${filters.fromTime ? ` ${filters.fromTime}` : ''}`
    : 'Start';
  const to = filters.toDate
    ? `${filters.toDate}${filters.toTime ? ` ${filters.toTime}` : ''}`
    : 'Now';
  return `${from} to ${to}`;
}

function withQuickRange(mode, currentFilters) {
  const now = new Date();
  if (mode === 'today') {
    const todayText = now.toISOString().slice(0, 10);
    return {
      ...currentFilters,
      fromDate: todayText,
      fromTime: '00:00',
      toDate: todayText,
      toTime: '23:59'
    };
  }
  if (mode === 'month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      ...currentFilters,
      fromDate: monthStart.toISOString().slice(0, 10),
      fromTime: '00:00',
      toDate: now.toISOString().slice(0, 10),
      toTime: '23:59'
    };
  }
  return {
    ...currentFilters,
    fromDate: '',
    fromTime: '',
    toDate: '',
    toTime: ''
  };
}

export default function Reports() {
  const [tab, setTab] = useState('trip-profit');
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    fromDate: '',
    fromTime: '',
    toDate: '',
    toTime: '',
    preset: 'standard',
    format: 'csv'
  });

  const selectedTab = useMemo(
    () => reportTabs.find((item) => item.key === tab) || reportTabs[0],
    [tab]
  );

  useEffect(() => {
    const query = buildQuery(filters);
    setError('');
    api(`/reports/${tab}${query ? `?${query}` : ''}`)
      .then(setRows)
      .catch((err) => setError(err.message));
  }, [filters.fromDate, filters.fromTime, filters.toDate, filters.toTime, tab]);

  function exportCurrent() {
    const params = new URLSearchParams();
    if (filters.fromDate && filters.fromTime) params.set('from_at', `${filters.fromDate}T${filters.fromTime}`);
    else if (filters.fromDate) params.set('from', filters.fromDate);
    if (filters.toDate && filters.toTime) params.set('to_at', `${filters.toDate}T${filters.toTime}`);
    else if (filters.toDate) params.set('to', filters.toDate);
    params.set('preset', filters.preset);
    params.set('format', filters.format);
    const extension = filters.format === 'json' ? 'json' : 'csv';
    downloadApiFile(`/exports/${tab}?${params.toString()}`, `${tab}-${filters.preset}.${extension}`).catch((err) => setError(err.message));
  }

  return (
    <div className="report-page space-y-4">
      <div className="report-toolbar print-hide">
        <div className="report-toolbar-copy">
          <h2 className="text-lg font-bold">Reports, Exports, and Print</h2>
          <p className="text-sm text-slate-600">Pick an export window, open the dataset you need, then export it in a standard or accounting-friendly layout. If you set time too, the report uses the exact entry timestamp instead of only the business date.</p>
          <div className="mt-2 text-xs font-semibold uppercase tracking-normal" style={{ color: 'var(--muted)' }}>
            {filters.fromDate || filters.toDate ? `Export Window: ${exportWindowLabel(filters)}` : 'Export Window: All available records'}
          </div>
        </div>
        <div className="report-toolbar-actions">
          <button className="btn-muted" onClick={() => window.print()}>Print This View</button>
          <button className="btn-primary" onClick={exportCurrent}>Export Current Report</button>
        </div>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="glass glass-card space-y-4 p-4 print-hide">
        <SectionTabs
          items={reportTabs.map((item) => ({ id: item.key, label: item.label, hint: item.hint }))}
          value={tab}
          onChange={setTab}
          ariaLabel="Report sections"
        />

        <div className="report-filter-grid">
          <div>
            <label>From Date</label>
            <input type="date" value={filters.fromDate} onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })} />
          </div>
          <div>
            <label>From Time</label>
            <input type="time" value={filters.fromTime} onChange={(e) => setFilters({ ...filters, fromTime: e.target.value })} />
          </div>
          <div>
            <label>To Date</label>
            <input type="date" value={filters.toDate} onChange={(e) => setFilters({ ...filters, toDate: e.target.value })} />
          </div>
          <div>
            <label>To Time</label>
            <input type="time" value={filters.toTime} onChange={(e) => setFilters({ ...filters, toTime: e.target.value })} />
          </div>
          <div>
            <label>Export Style</label>
            <select value={filters.preset} onChange={(e) => setFilters({ ...filters, preset: e.target.value })}>
              <option value="standard">Standard</option>
              <option value="sales-book">Sales Book</option>
              <option value="ledger-voucher">Ledger Voucher</option>
            </select>
          </div>
          <div>
            <label>Format</label>
            <select value={filters.format} onChange={(e) => setFilters({ ...filters, format: e.target.value })}>
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </div>
        </div>

        <div className="report-quick-actions">
          <button className="btn-muted px-3 py-2" onClick={() => setFilters((current) => withQuickRange('today', current))}>Today</button>
          <button className="btn-muted px-3 py-2" onClick={() => setFilters((current) => withQuickRange('month', current))}>This Month</button>
          <button className="btn-muted px-3 py-2" onClick={() => setFilters((current) => withQuickRange('clear', current))}>Clear Window</button>
        </div>
      </div>

      <div className="glass glass-card p-4 print-only-block" style={{ display: 'none' }}>
        <div className="text-xl font-bold">{selectedTab.label}</div>
        <div className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
          {(filters.fromDate || filters.toDate) ? `Timeframe: ${exportWindowLabel(filters)}` : 'Timeframe: All available records'}
        </div>
      </div>

      <div className="report-table-shell">
        <DataTable rows={rows} columns={columns[tab]} />
      </div>
    </div>
  );
}
