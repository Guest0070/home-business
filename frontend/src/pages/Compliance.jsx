import { useEffect, useMemo, useState } from 'react';
import { api, downloadApiFile } from '../api/client.js';
import DataTable from '../components/DataTable.jsx';
import MetricCard from '../components/MetricCard.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import SectionTabs from '../components/SectionTabs.jsx';

const documentOptions = [
  { id: 'insurance', label: 'Insurance' },
  { id: 'road_tax', label: 'Road Tax' },
  { id: 'fitness', label: 'Fitness' },
  { id: 'all_india_permit', label: 'All India Permit' },
  { id: 'pollution_certificate', label: 'Pollution Certificate' },
  { id: 'mining_certificate', label: 'Mining Certificate' }
];

const sectionMap = {
  compliance: { title: 'Compliance Overview', description: 'See the full reminder picture across every truck document.', documentType: null },
  'compliance-overview': { title: 'Compliance Overview', description: 'See the full reminder picture across every truck document.', documentType: null },
  'compliance-insurance': { title: 'Insurance', description: 'Keep policy renewals and insurer references separate from the rest of compliance.', documentType: 'insurance' },
  'compliance-road-tax': { title: 'Road Tax', description: 'Road tax is its own workflow, so keep it isolated with chassis last 5 always visible.', documentType: 'road_tax' },
  'compliance-fitness': { title: 'Fitness', description: 'Track fitness due dates without mixing them into permit or insurance work.', documentType: 'fitness' },
  'compliance-permit': { title: 'All India Permit', description: 'Keep permit renewals and validity windows in their own queue.', documentType: 'all_india_permit' },
  'compliance-pollution': { title: 'Pollution Certificate', description: 'Pollution expiry is frequent, so it gets its own focused screen.', documentType: 'pollution_certificate' },
  'compliance-mining': { title: 'Mining Certificate', description: 'Mining paperwork stays separate so it is easy to chase and renew.', documentType: 'mining_certificate' }
};

function stateClass(state) {
  if (state === 'completed') return 'bg-emerald-50 text-emerald-700';
  if (state === 'overdue') return 'bg-red-50 text-red-700';
  if (state === 'due_soon') return 'bg-amber-50 text-amber-700';
  return 'bg-sky-50 text-sky-700';
}

function createDefaultForm(documentType = 'insurance') {
  return {
    vehicle_id: '',
    document_type: documentType,
    reference_no: '',
    provider_name: '',
    issue_date: '',
    due_date: '',
    reminder_days: 15,
    notes: ''
  };
}

const complianceTabs = [
  { id: 'compliance-overview', label: 'Overview', hint: 'All reminders' },
  { id: 'compliance-insurance', label: 'Insurance', hint: 'Policy renewals' },
  { id: 'compliance-road-tax', label: 'Road Tax', hint: 'Chassis last 5' },
  { id: 'compliance-fitness', label: 'Fitness', hint: 'Vehicle checks' },
  { id: 'compliance-permit', label: 'Permit', hint: 'All India' },
  { id: 'compliance-pollution', label: 'Pollution', hint: 'PUC' },
  { id: 'compliance-mining', label: 'Mining', hint: 'Mine papers' }
];

export default function Compliance({ page, setPage }) {
  const section = sectionMap[page] && page !== 'compliance' ? page : 'compliance-overview';
  const activeDocType = sectionMap[section].documentType;
  const [vehicles, setVehicles] = useState([]);
  const [summary, setSummary] = useState({ overdue: 0, due_soon: 0, active: 0, total: 0 });
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(createDefaultForm(activeDocType || 'insurance'));
  const [error, setError] = useState('');

  async function load() {
    const [vehicleRows, summaryRow, itemRows] = await Promise.all([
      api('/vehicles'),
      api('/compliance/summary'),
      api('/compliance')
    ]);
    setVehicles(vehicleRows);
    setSummary(summaryRow);
    setItems(itemRows);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    setForm((current) => ({ ...createDefaultForm(activeDocType || current.document_type), vehicle_id: current.vehicle_id || '' }));
  }, [activeDocType]);

  const filteredItems = useMemo(
    () => activeDocType ? items.filter((item) => item.document_type === activeDocType) : items,
    [activeDocType, items]
  );

  const filteredSummary = useMemo(() => ({
    overdue: filteredItems.filter((item) => item.reminder_state === 'overdue').length,
    dueSoon: filteredItems.filter((item) => item.reminder_state === 'due_soon').length,
    active: filteredItems.filter((item) => item.reminder_state === 'ok').length,
    total: filteredItems.length
  }), [filteredItems]);

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === form.vehicle_id) || null,
    [form.vehicle_id, vehicles]
  );

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      await api('/compliance', { method: 'POST', body: { ...form, document_type: activeDocType || form.document_type } });
      setForm(createDefaultForm(activeDocType || form.document_type));
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function updateStatus(item, status) {
    setError('');
    try {
      await api(`/compliance/${item.id}`, {
        method: 'PATCH',
        body: {
          document_type: item.document_type,
          reference_no: item.reference_no || '',
          provider_name: item.provider_name || '',
          issue_date: item.issue_date?.slice(0, 10) || '',
          due_date: item.due_date?.slice(0, 10) || '',
          reminder_days: item.reminder_days,
          status,
          notes: item.notes || ''
        }
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeItem(item) {
    if (!window.confirm(`Remove ${String(item.document_type).replaceAll('_', ' ')} reminder for ${item.vehicle_no}?`)) return;
    setError('');
    try {
      const result = await api(`/compliance/${item.id}`, { method: 'DELETE' });
      await load();
      if (result?.message) window.alert(result.message);
    } catch (err) {
      setError(err.message);
    }
  }

  function exportCurrent() {
    downloadApiFile('/exports/compliance-reminders?format=csv&preset=standard', 'vehicle-compliance.csv').catch((err) => setError(err.message));
  }

  const topSummary = activeDocType ? filteredSummary : {
    overdue: summary.overdue,
    dueSoon: summary.due_soon,
    active: summary.active,
    total: summary.total
  };

  const formDocumentLabel = documentOptions.find((option) => option.id === (activeDocType || form.document_type))?.label || 'Document';

  return (
    <div className="space-y-4">
      <div className="report-toolbar print-hide">
        <div>
          <h2 className="text-lg font-bold">{sectionMap[section].title}</h2>
          <p className="text-sm text-slate-600">{sectionMap[section].description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-muted" onClick={exportCurrent}>Export Compliance</button>
        </div>
      </div>

      <SectionTabs items={complianceTabs} value={section} onChange={setPage} ariaLabel="Compliance sections" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Overdue" value={topSummary.overdue} tone="danger" />
        <MetricCard label="Due Soon" value={topSummary.dueSoon} />
        <MetricCard label="Active" value={topSummary.active} tone="money" />
        <MetricCard label="Total Items" value={topSummary.total} />
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {activeDocType ? (
        <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
          <form onSubmit={submit} className="glass glass-card space-y-3 p-4">
            <h2 className="text-lg font-bold">Add {formDocumentLabel} Reminder</h2>
            <div>
              <label>Vehicle</label>
              <SearchableSelect
                id={`compliance-vehicle-${activeDocType}`}
                value={form.vehicle_id}
                options={vehicles}
                onChange={(vehicleId) => setForm({ ...form, vehicle_id: vehicleId })}
                placeholder="Type vehicle number"
                required
                getOptionLabel={(vehicle) => vehicle.vehicle_no}
                getSearchText={(vehicle) => `${vehicle.vehicle_no} ${vehicle.owner_name || ''} ${vehicle.chassis_last5 || ''}`}
              />
            </div>

            {selectedVehicle && (
              <div className="trip-do-summary">
                <div className="trip-do-summary-row">
                  <span>Ownership</span>
                  <strong>{selectedVehicle.ownership}</strong>
                </div>
                <div className="trip-do-summary-row">
                  <span>Owner</span>
                  <strong>{selectedVehicle.owner_name || '-'}</strong>
                </div>
                <div className="trip-do-summary-row">
                  <span>Chassis Last 5</span>
                  <strong>{selectedVehicle.chassis_last5 || '-'}</strong>
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div><label>Reference No.</label><input value={form.reference_no} onChange={(e) => setForm({ ...form, reference_no: e.target.value })} /></div>
              <div><label>Provider</label><input value={form.provider_name} onChange={(e) => setForm({ ...form, provider_name: e.target.value })} /></div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div><label>Issue Date</label><input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} /></div>
              <div><label>Due Date</label><input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} required /></div>
            </div>

            <div><label>Reminder Days Before Due</label><input type="number" min="0" value={form.reminder_days} onChange={(e) => setForm({ ...form, reminder_days: e.target.value })} /></div>
            <div><label>Notes</label><textarea rows="3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <button className="btn-primary w-full">Save Reminder</button>
          </form>

          <DataTable
            rows={filteredItems}
            columns={[
              { key: 'vehicle_no', label: 'Vehicle' },
              { key: 'chassis_last5', label: 'Chassis Last 5', render: (row) => row.chassis_last5 || '-' },
              { key: 'reference_no', label: 'Reference', render: (row) => row.reference_no || '-' },
              { key: 'provider_name', label: 'Provider', render: (row) => row.provider_name || '-' },
              { key: 'due_date', label: 'Due Date' },
              { key: 'days_left', label: 'Days Left', render: (row) => row.days_left ?? '-' },
              {
                key: 'reminder_state',
                label: 'State',
                render: (row) => <span className={`rounded px-2 py-1 text-xs font-semibold ${stateClass(row.reminder_state)}`}>{String(row.reminder_state).replace('_', ' ')}</span>
              },
              {
                key: 'actions',
                label: 'Actions',
                render: (row) => (
                  <div className="flex gap-2">
                    {row.status !== 'completed' && <button className="btn-muted px-2 py-1" onClick={() => updateStatus(row, 'completed')}>Complete</button>}
                    {row.status !== 'active' && <button className="btn-muted px-2 py-1" onClick={() => updateStatus(row, 'active')}>Reopen</button>}
                    <button className="btn-muted px-2 py-1 text-red-700" onClick={() => removeItem(row)}>Remove</button>
                  </div>
                )
              }
            ]}
          />
        </div>
      ) : (
        <DataTable
          rows={items}
          columns={[
            { key: 'vehicle_no', label: 'Vehicle' },
            { key: 'document_type', label: 'Document', render: (row) => String(row.document_type).replaceAll('_', ' ') },
            { key: 'chassis_last5', label: 'Chassis Last 5', render: (row) => row.chassis_last5 || '-' },
            { key: 'reference_no', label: 'Reference', render: (row) => row.reference_no || '-' },
            { key: 'provider_name', label: 'Provider', render: (row) => row.provider_name || '-' },
            { key: 'due_date', label: 'Due Date' },
            { key: 'days_left', label: 'Days Left', render: (row) => row.days_left ?? '-' },
            {
              key: 'reminder_state',
              label: 'State',
              render: (row) => <span className={`rounded px-2 py-1 text-xs font-semibold ${stateClass(row.reminder_state)}`}>{String(row.reminder_state).replace('_', ' ')}</span>
            },
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => <button className="btn-muted px-2 py-1 text-red-700" onClick={() => removeItem(row)}>Remove</button>
            }
          ]}
        />
      )}
    </div>
  );
}
