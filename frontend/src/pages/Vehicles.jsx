import { useEffect, useMemo, useState } from 'react';
import { api, apiForm, downloadApiFile } from '../api/client.js';
import ImportReview from '../components/ImportReview.jsx';
import DataTable from '../components/DataTable.jsx';
import MetricCard from '../components/MetricCard.jsx';
import SectionTabs from '../components/SectionTabs.jsx';

const vehicleTabs = [
  { id: 'fleet', label: 'Fleet' },
  { id: 'add', label: 'Add Vehicle' },
  { id: 'bulk', label: 'Import / Export' }
];

const optionalFieldMeta = [
  { id: 'status', label: 'Initial Status' },
  { id: 'owner_name', label: 'Owner Name' },
  { id: 'chassis_last5', label: 'Chassis Last 5' }
];

function statusClass(status) {
  if (status === 'available') return 'bg-emerald-50 text-emerald-700';
  if (status === 'standby') return 'bg-sky-50 text-sky-700';
  if (status === 'on_trip') return 'bg-indigo-50 text-indigo-700';
  return 'bg-red-50 text-red-700';
}

export default function Vehicles() {
  const [tab, setTab] = useState('fleet');
  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState('');
  const [importSummary, setImportSummary] = useState(null);
  const [preview, setPreview] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [showFieldPicker, setShowFieldPicker] = useState(false);
  const [visibleFields, setVisibleFields] = useState(['status']);
  const [form, setForm] = useState({ vehicle_no: '', ownership: 'own', owner_name: '', chassis_last5: '', status: 'available' });

  const counts = useMemo(() => ({
    available: vehicles.filter((vehicle) => vehicle.status === 'available').length,
    standby: vehicles.filter((vehicle) => vehicle.status === 'standby').length,
    onTrip: vehicles.filter((vehicle) => vehicle.status === 'on_trip').length,
    repair: vehicles.filter((vehicle) => vehicle.status === 'repair').length
  }), [vehicles]);

  async function load() {
    setVehicles(await api('/vehicles'));
  }

  useEffect(() => { load().catch(console.error); }, []);

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      const payload = {
        vehicle_no: form.vehicle_no,
        ownership: form.ownership
      };
      if (visibleFields.includes('status')) payload.status = form.status;
      if (visibleFields.includes('owner_name')) payload.owner_name = form.owner_name;
      if (visibleFields.includes('chassis_last5')) payload.chassis_last5 = form.chassis_last5;

      await api('/vehicles', { method: 'POST', body: payload });
      setForm({ vehicle_no: '', ownership: 'own', owner_name: '', chassis_last5: '', status: 'available' });
      setVisibleFields(['status']);
      setShowFieldPicker(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function setStatus(vehicle, status) {
    setError('');
    try {
      await api(`/vehicles/${vehicle.id}/status`, { method: 'PATCH', body: { status } });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeVehicle(vehicle) {
    if (!window.confirm(`Remove vehicle ${vehicle.vehicle_no}?`)) return;
    setError('');
    try {
      const result = await api(`/vehicles/${vehicle.id}`, { method: 'DELETE' });
      await load();
      if (result?.message) window.alert(result.message);
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
      setPreview(await apiForm('/vehicles/import/preview', formData));
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
      setImportSummary(await apiForm('/vehicles/import', formData));
      setPreview(null);
      setPendingFile(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  function addField(fieldId) {
    setVisibleFields((current) => Array.from(new Set([...current, fieldId])));
    setShowFieldPicker(false);
  }

  function removeField(fieldId) {
    setVisibleFields((current) => current.filter((item) => item !== fieldId));
  }

  const remainingFields = optionalFieldMeta.filter((field) => !visibleFields.includes(field.id));

  return (
    <div className="space-y-4">
      <div className="report-toolbar print-hide">
        <div>
          <h2 className="text-lg font-bold">Vehicle Master</h2>
          <p className="text-sm text-slate-600">Fleet view, clean vehicle entry, and bulk Excel work are now split so the page stays calmer.</p>
        </div>
      </div>

      <SectionTabs items={vehicleTabs} value={tab} onChange={setTab} ariaLabel="Vehicle sections" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Available" value={counts.available} tone="money" />
        <MetricCard label="Standby" value={counts.standby} />
        <MetricCard label="On Trip" value={counts.onTrip} />
        <MetricCard label="Repair" value={counts.repair} tone="danger" />
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {tab === 'fleet' && (
        <DataTable rows={vehicles} columns={[
          { key: 'vehicle_no', label: 'Vehicle' },
          { key: 'ownership', label: 'Type' },
          { key: 'owner_name', label: 'Owner' },
          { key: 'chassis_last5', label: 'Chassis Last 5', render: (row) => row.chassis_last5 || '-' },
          { key: 'status', label: 'Status', render: (row) => <span className={`rounded px-2 py-1 text-xs font-semibold ${statusClass(row.status)}`}>{row.status.replace('_', ' ')}</span> },
          { key: 'is_active', label: 'Active', render: (row) => row.is_active ? 'Yes' : 'No' },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
              <div className="flex gap-2">
                <button className="btn-muted px-2 py-1" onClick={() => setStatus(row, 'available')}>Available</button>
                <button className="btn-muted px-2 py-1" onClick={() => setStatus(row, 'standby')}>Standby</button>
                <button className="btn-muted px-2 py-1" onClick={() => setStatus(row, 'repair')}>Repair</button>
                <button className="btn-muted px-2 py-1 text-red-700" onClick={() => removeVehicle(row)}>Remove</button>
              </div>
            )
          }
        ]} />
      )}

      {tab === 'add' && (
        <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
          <form onSubmit={submit} className="glass glass-card space-y-3 p-4">
            <h2 className="text-lg font-bold">Add Vehicle</h2>
            <div><label>Vehicle Number</label><input value={form.vehicle_no} onChange={(e) => setForm({ ...form, vehicle_no: e.target.value.toUpperCase() })} required /></div>
            <div><label>Ownership</label><select value={form.ownership} onChange={(e) => setForm({ ...form, ownership: e.target.value })}><option value="own">Own</option><option value="market">Market</option></select></div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="btn-muted" onClick={() => setShowFieldPicker((current) => !current)}>+ Add Field</button>
                {visibleFields.map((fieldId) => {
                  const field = optionalFieldMeta.find((item) => item.id === fieldId);
                  return (
                    <span key={fieldId} className="rounded border px-2 py-1 text-xs font-semibold" style={{ borderColor: 'var(--border)' }}>
                      {field?.label}
                      {fieldId !== 'status' && <button type="button" className="ml-2 text-xs" onClick={() => removeField(fieldId)}>x</button>}
                    </span>
                  );
                })}
              </div>

              {showFieldPicker && remainingFields.length > 0 && (
                <div className="glass glass-card space-y-2 p-3">
                  <div className="text-sm font-semibold">Choose what else to add</div>
                  <div className="flex flex-wrap gap-2">
                    {remainingFields.map((field) => (
                      <button key={field.id} type="button" className="btn-muted px-2 py-1" onClick={() => addField(field.id)}>
                        {field.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {visibleFields.includes('status') && (
              <div><label>Status</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="available">Available</option><option value="standby">Standby</option><option value="repair">Repair</option></select></div>
            )}
            {visibleFields.includes('owner_name') && (
              <div><label>Owner Name</label><input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} /></div>
            )}
            {visibleFields.includes('chassis_last5') && (
              <div><label>Chassis Last 5</label><input value={form.chassis_last5} maxLength={5} onChange={(e) => setForm({ ...form, chassis_last5: e.target.value.replace(/\D/g, '').slice(0, 5) })} placeholder="12345" /></div>
            )}
            <button className="btn-primary w-full">Save Vehicle</button>
          </form>

          <DataTable rows={vehicles.slice(0, 12)} columns={[
            { key: 'vehicle_no', label: 'Recent Vehicles' },
            { key: 'ownership', label: 'Type' },
            { key: 'status', label: 'Status', render: (row) => <span className={`rounded px-2 py-1 text-xs font-semibold ${statusClass(row.status)}`}>{row.status.replace('_', ' ')}</span> },
            { key: 'owner_name', label: 'Owner', render: (row) => row.owner_name || '-' }
          ]} />
        </div>
      )}

      {tab === 'bulk' && (
        <div className="space-y-4">
          {importSummary && (
            <div className="rounded border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
              <div>Imported {importSummary.totalRows} rows. Created {importSummary.created}, updated {importSummary.updated}, failed {importSummary.failed}.</div>
              {importSummary.errors?.length > 0 && (
                <div className="mt-2 space-y-1 text-red-700">
                  {importSummary.errors.slice(0, 5).map((item) => (
                    <div key={`${item.row}-${item.vehicle_no}`}>Row {item.row}: {item.errors.join(', ')}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          <ImportReview title="Vehicle Import Review" preview={preview} keyField="vehicle_no" onConfirm={confirmImport} busy={importing} />

          <section className="glass glass-card space-y-3 p-4">
            <h2 className="text-lg font-bold">Excel Import</h2>
            <p className="text-sm text-slate-600">Use Excel to add or update many trucks at once. Existing vehicle numbers are updated.</p>
            <button className="btn-muted w-full" onClick={() => downloadApiFile('/vehicles/template', 'vehicle-import-template.xlsx').catch((err) => setError(err.message))}>Download Template</button>
            <button className="btn-muted w-full" onClick={() => downloadApiFile('/vehicles/export', 'vehicles-export.xlsx').catch((err) => setError(err.message))}>Export Vehicles</button>
            <label className="block">
              Review Vehicle Excel
              <input className="mt-1" type="file" accept=".xlsx" onChange={reviewExcel} />
            </label>
          </section>
        </div>
      )}
    </div>
  );
}
