import { useEffect, useMemo, useState } from 'react';
import { api, apiForm, downloadApiFile } from '../api/client.js';
import DataTable from '../components/DataTable.jsx';
import ImportReview from '../components/ImportReview.jsx';
import MetricCard from '../components/MetricCard.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import SectionTabs from '../components/SectionTabs.jsx';

const today = new Date().toISOString().slice(0, 10);

const sectionMeta = {
  'delivery-orders': {
    title: 'D.O. Tracker',
    description: 'Track ordered tons, progress, dispatch pressure, and expiry risk.',
    exportLabel: 'Export D.O. Tracker'
  },
  'do-tracker': {
    title: 'D.O. Tracker',
    description: 'Track ordered tons, progress, dispatch pressure, and expiry risk.',
    exportLabel: 'Export D.O. Tracker'
  },
  'do-entry': {
    title: 'Add Delivery Order',
    description: 'A focused screen for entering or updating delivery orders without the tracker noise.',
    exportLabel: 'Export Delivery Orders'
  },
  'do-import': {
    title: 'Import Delivery Orders',
    description: 'Bulk update D.O. workloads in one sheet and review before saving.',
    exportLabel: 'Export Delivery Orders'
  }
};

function tons(value) {
  return `${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })} t`;
}

function money(value) {
  return `Rs ${Number(value || 0).toLocaleString('en-IN')}`;
}

function trackerClass(status) {
  if (status === 'completed') return 'bg-emerald-50 text-emerald-700';
  if (status === 'behind') return 'bg-amber-50 text-amber-700';
  if (status === 'expired') return 'bg-red-50 text-red-700';
  if (status === 'cancelled') return 'bg-slate-100 text-slate-600';
  return 'bg-sky-50 text-sky-700';
}

function createDefaultForm() {
  return {
    do_number: '',
    issue_date: today,
    mine_id: '',
    factory_id: '',
    total_tons: '',
    rate_per_ton: '',
    dispatch_target_date: '',
    valid_until: '',
    broker_name: '',
    priority: 'normal',
    status: 'open',
    notes: ''
  };
}

const doTabs = [
  { id: 'do-tracker', label: 'Tracker', hint: 'Progress' },
  { id: 'do-entry', label: 'Add D.O.', hint: 'Single entry' },
  { id: 'do-import', label: 'Import / Export', hint: 'Excel' }
];

export default function DeliveryOrders({ page, setPage }) {
  const section = ['do-tracker', 'do-entry', 'do-import'].includes(page) ? page : 'do-tracker';
  const [orders, setOrders] = useState([]);
  const [mines, setMines] = useState([]);
  const [factories, setFactories] = useState([]);
  const [editingOrderId, setEditingOrderId] = useState('');
  const [error, setError] = useState('');
  const [importSummary, setImportSummary] = useState(null);
  const [preview, setPreview] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [trackerFilter, setTrackerFilter] = useState('attention');
  const [trackerSearch, setTrackerSearch] = useState('');
  const [form, setForm] = useState(createDefaultForm());

  async function load() {
    const [orderRows, mineRows, factoryRows] = await Promise.all([
      api('/delivery-orders'),
      api('/mines'),
      api('/factories')
    ]);
    setOrders(orderRows);
    setMines(mineRows);
    setFactories(factoryRows);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  function resetForm() {
    setEditingOrderId('');
    setForm(createDefaultForm());
  }

  function startEdit(order) {
    setEditingOrderId(order.id);
    setForm({
      do_number: order.do_number || '',
      issue_date: order.issue_date?.slice(0, 10) || today,
      mine_id: order.mine_id || '',
      factory_id: order.factory_id || '',
      total_tons: order.total_tons || '',
      rate_per_ton: order.rate_per_ton || '',
      dispatch_target_date: order.dispatch_target_date?.slice(0, 10) || '',
      valid_until: order.valid_until?.slice(0, 10) || '',
      broker_name: order.broker_name || '',
      priority: order.priority || 'normal',
      status: order.status || 'open',
      notes: order.notes || ''
    });
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      if (editingOrderId) {
        await api(`/delivery-orders/${editingOrderId}`, { method: 'PATCH', body: form });
      } else {
        await api('/delivery-orders', { method: 'POST', body: form });
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function reviewExcel(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setImportSummary(null);
    setPreview(null);
    setPendingFile(file);
    const formData = new FormData();
    formData.append('file', file);
    try {
      setPreview(await apiForm('/delivery-orders/import/preview', formData));
    } catch (err) {
      setError(err.message);
      setPendingFile(null);
    } finally {
      event.target.value = '';
    }
  }

  async function confirmImport() {
    if (!pendingFile) return;
    setImporting(true);
    setError('');
    const formData = new FormData();
    formData.append('file', pendingFile);
    try {
      setImportSummary(await apiForm('/delivery-orders/import', formData));
      setPreview(null);
      setPendingFile(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  async function removeDeliveryOrder(order) {
    if (!window.confirm(`Remove delivery order ${order.do_number}?`)) return;
    setError('');
    try {
      const result = await api(`/delivery-orders/${order.id}`, { method: 'DELETE' });
      if (editingOrderId === order.id) resetForm();
      await load();
      if (result?.message) window.alert(result.message);
    } catch (err) {
      setError(err.message);
    }
  }

  const totals = useMemo(() => ({
    open: orders.filter((order) => order.status === 'open').length,
    onTrack: orders.filter((order) => order.tracking_status === 'on_track').length,
    behind: orders.filter((order) => order.tracking_status === 'behind').length,
    expired: orders.filter((order) => order.tracking_status === 'expired').length,
    totalTons: orders.reduce((sum, order) => sum + Number(order.total_tons || 0), 0),
    delivered: orders.reduce((sum, order) => sum + Number(order.delivered_tons || 0), 0),
    pending: orders.reduce((sum, order) => sum + Number(order.pending_tons || 0), 0)
  }), [orders]);

  const filteredOrders = useMemo(() => {
    const search = trackerSearch.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesStatus = trackerFilter === 'all'
        || (trackerFilter === 'attention' && ['behind', 'expired'].includes(order.tracking_status))
        || (trackerFilter === 'open' && order.status === 'open')
        || order.tracking_status === trackerFilter
        || order.priority === trackerFilter;
      const matchesSearch = !search
        || [
          order.do_number,
          order.mine_name,
          order.factory_name,
          order.broker_name,
          order.priority,
          order.tracking_status
        ].some((value) => String(value || '').toLowerCase().includes(search));
      return matchesStatus && matchesSearch;
    });
  }, [orders, trackerFilter, trackerSearch]);

  function renderTable() {
    return (
      <DataTable
        rows={filteredOrders}
        columns={[
          { key: 'do_number', label: 'D.O.' },
          { key: 'issue_date', label: 'Issue Date' },
          { key: 'mine_name', label: 'Mine' },
          { key: 'factory_name', label: 'Party' },
          { key: 'broker_name', label: 'Broker', render: (row) => row.broker_name || '-' },
          { key: 'priority', label: 'Priority', render: (row) => row.priority || '-' },
          { key: 'total_tons', label: 'Ordered', render: (row) => tons(row.total_tons) },
          { key: 'delivered_tons', label: 'Delivered', render: (row) => tons(row.delivered_tons) },
          { key: 'pending_tons', label: 'Pending', render: (row) => tons(row.pending_tons) },
          {
            key: 'completion_percent',
            label: 'Progress',
            render: (row) => (
              <div className="min-w-[150px]">
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${Math.min(Number(row.completion_percent || 0), 100)}%` }} />
                </div>
                <div className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{Number(row.completion_percent || 0).toFixed(1)}%</div>
              </div>
            )
          },
          { key: 'dispatch_target_date', label: 'Dispatch Target', render: (row) => row.dispatch_target_date || '-' },
          { key: 'valid_until', label: 'Valid Until', render: (row) => row.valid_until || '-' },
          {
            key: 'tracking_status',
            label: 'Tracker',
            render: (row) => (
              <span className={`rounded px-2 py-1 text-xs font-semibold ${trackerClass(row.tracking_status)}`}>
                {String(row.tracking_status || '-').replace('_', ' ')}
              </span>
            )
          },
          { key: 'days_left', label: 'Days Left', render: (row) => row.days_left ?? '-' },
          { key: 'rate_per_ton', label: 'Rate', render: (row) => row.rate_per_ton ? money(row.rate_per_ton) : '-' },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
              <div className="flex gap-2">
                <button className="btn-muted px-2 py-1" onClick={() => startEdit(row)}>Edit</button>
                <button className="btn-muted px-2 py-1 text-red-700" onClick={() => removeDeliveryOrder(row)}>Remove</button>
              </div>
            )
          }
        ]}
      />
    );
  }

  function renderForm() {
    return (
      <form onSubmit={submit} className="glass glass-card space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{editingOrderId ? 'Update Delivery Order' : 'New Delivery Order'}</h2>
          {editingOrderId && <button type="button" className="btn-muted" onClick={resetForm}>Cancel</button>}
        </div>

        <div><label>D.O. Number</label><input value={form.do_number} onChange={(e) => setForm({ ...form, do_number: e.target.value.toUpperCase() })} required /></div>
        <div><label>Issue Date</label><input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} required /></div>

        <div>
          <label>Mine</label>
          <SearchableSelect
            id="delivery-order-mine-options"
            value={form.mine_id}
            options={mines}
            onChange={(mineId) => setForm({ ...form, mine_id: mineId })}
            placeholder="Type mine name"
            getOptionLabel={(mine) => mine.name}
            getSearchText={(mine) => `${mine.name} ${mine.location || ''}`}
          />
        </div>

        <div>
          <label>Party</label>
          <SearchableSelect
            id="delivery-order-factory-options"
            value={form.factory_id}
            options={factories}
            onChange={(factoryId) => setForm({ ...form, factory_id: factoryId })}
            placeholder="Type party name"
            getOptionLabel={(factory) => factory.name}
            getSearchText={(factory) => `${factory.name} ${factory.contact_name || ''} ${factory.phone || ''}`}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div><label>Total Tons</label><input type="number" step="0.001" value={form.total_tons} onChange={(e) => setForm({ ...form, total_tons: e.target.value })} required /></div>
          <div><label>Rate Per Ton</label><input type="number" step="0.01" value={form.rate_per_ton} onChange={(e) => setForm({ ...form, rate_per_ton: e.target.value })} /></div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div><label>Dispatch Target</label><input type="date" value={form.dispatch_target_date} onChange={(e) => setForm({ ...form, dispatch_target_date: e.target.value })} /></div>
          <div><label>Valid Until</label><input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} /></div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div><label>Broker</label><input value={form.broker_name} onChange={(e) => setForm({ ...form, broker_name: e.target.value })} /></div>
          <div>
            <label>Priority</label>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        <div>
          <label>Status</label>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="open">Open</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div><label>Notes</label><textarea rows="3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <button className="btn-primary w-full">{editingOrderId ? 'Update Delivery Order' : 'Save Delivery Order'}</button>
      </form>
    );
  }

  function renderImport() {
    return (
      <div className="space-y-4">
        {importSummary && (
          <div className="rounded border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
            <div>Imported {importSummary.totalRows} rows. Created {importSummary.created}, updated {importSummary.updated}, failed {importSummary.failed}.</div>
            {importSummary.errors?.length > 0 && (
              <div className="mt-2 space-y-1 text-red-700">
                {importSummary.errors.slice(0, 5).map((item) => (
                  <div key={`${item.row}-${item.do_number}`}>Row {item.row}: {item.errors.join(', ')}</div>
                ))}
              </div>
            )}
          </div>
        )}
        <ImportReview title="Delivery Order Import Review" preview={preview} keyField="do_number" onConfirm={confirmImport} busy={importing} />

        <section className="glass glass-card space-y-3 p-4">
          <h2 className="text-lg font-bold">Excel Import</h2>
          <p className="text-sm text-slate-600">Bulk add or update delivery orders. Keep the D.O. number stable and leave optional cells blank to keep current values on update.</p>
          <button className="btn-muted w-full" onClick={() => downloadApiFile('/delivery-orders/template', 'delivery-order-import-template.xlsx').catch((err) => setError(err.message))}>Download Template</button>
          <button className="btn-muted w-full" onClick={() => downloadApiFile('/delivery-orders/export', 'delivery-orders-export.xlsx').catch((err) => setError(err.message))}>Export Delivery Orders</button>
          <label className="block">
            Review Delivery Order Excel
            <input className="mt-1" type="file" accept=".xlsx" onChange={reviewExcel} />
          </label>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="report-toolbar print-hide">
        <div>
          <h2 className="text-lg font-bold">{sectionMeta[section].title}</h2>
          <p className="text-sm text-slate-600">{sectionMeta[section].description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-muted" onClick={() => downloadApiFile('/exports/delivery-orders?format=csv&preset=standard', 'delivery-orders.csv').catch((err) => setError(err.message))}>
            {sectionMeta[section].exportLabel}
          </button>
        </div>
      </div>

      <SectionTabs items={doTabs} value={section} onChange={setPage} ariaLabel="Delivery order sections" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Open D.O." value={totals.open} />
        <MetricCard label="On Track" value={totals.onTrack} tone="money" />
        <MetricCard label="Behind" value={totals.behind} />
        <MetricCard label="Expired" value={totals.expired} tone="danger" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Ordered Tons" value={tons(totals.totalTons)} />
        <MetricCard label="Delivered Tons" value={tons(totals.delivered)} tone="money" />
        <MetricCard label="Pending Tons" value={tons(totals.pending)} tone="danger" />
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {section === 'do-tracker' && (
        <section className="glass glass-card space-y-3 p-3 print-hide">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              value={trackerSearch}
              onChange={(event) => setTrackerSearch(event.target.value)}
              placeholder="Search D.O., party, mine, broker, priority"
            />
            <div className="flex flex-wrap gap-2">
              {[
                ['attention', 'Needs Attention'],
                ['all', 'All'],
                ['open', 'Open'],
                ['on_track', 'On Track'],
                ['behind', 'Behind'],
                ['expired', 'Expired'],
                ['urgent', 'Urgent']
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={trackerFilter === value ? 'btn-primary px-3 py-2' : 'btn-muted px-3 py-2'}
                  onClick={() => setTrackerFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="text-xs font-semibold uppercase tracking-normal" style={{ color: 'var(--muted)' }}>
            Showing {filteredOrders.length} of {orders.length} delivery orders
          </div>
        </section>
      )}

      {section === 'do-entry' ? (
        <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
          {renderForm()}
          {renderTable()}
        </div>
      ) : section === 'do-import' ? (
        <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
          {renderImport()}
          {renderTable()}
        </div>
      ) : (
        renderTable()
      )}
    </div>
  );
}
