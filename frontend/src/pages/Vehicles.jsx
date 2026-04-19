import { useEffect, useMemo, useState } from 'react';
import { api, getToken } from '../api/client.js';
import DataTable from '../components/DataTable.jsx';
import MetricCard from '../components/MetricCard.jsx';

function statusClass(status) {
  if (status === 'available') return 'bg-emerald-50 text-emerald-700';
  if (status === 'standby') return 'bg-sky-50 text-sky-700';
  if (status === 'on_trip') return 'bg-indigo-50 text-indigo-700';
  return 'bg-red-50 text-red-700';
}

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState('');
  const [importSummary, setImportSummary] = useState(null);
  const [form, setForm] = useState({ vehicle_no: '', ownership: 'own', owner_name: '', status: 'available' });

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
      await api('/vehicles', { method: 'POST', body: form });
      setForm({ vehicle_no: '', ownership: 'own', owner_name: '', status: 'available' });
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

  async function downloadFile(path, filename) {
    setError('');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}${path}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  async function uploadExcel(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setImportSummary(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/vehicles/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || 'Import failed');
      setImportSummary(data);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      event.target.value = '';
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Available" value={counts.available} tone="money" />
        <MetricCard label="Standby" value={counts.standby} />
        <MetricCard label="On Trip" value={counts.onTrip} />
        <MetricCard label="Repair" value={counts.repair} tone="danger" />
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
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

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <form onSubmit={submit} className="panel space-y-3 p-4">
            <h2 className="text-lg font-bold">Add Vehicle</h2>
            <div><label>Vehicle Number</label><input value={form.vehicle_no} onChange={(e) => setForm({ ...form, vehicle_no: e.target.value.toUpperCase() })} required /></div>
            <div><label>Ownership</label><select value={form.ownership} onChange={(e) => setForm({ ...form, ownership: e.target.value })}><option value="own">Own</option><option value="market">Market</option></select></div>
            <div><label>Status</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="available">Available</option><option value="standby">Standby</option><option value="repair">Repair</option></select></div>
            <div><label>Owner Name</label><input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} /></div>
            <button className="btn-primary w-full">Save Vehicle</button>
          </form>

          <section className="panel space-y-3 p-4">
            <h2 className="text-lg font-bold">Excel Import</h2>
            <p className="text-sm text-slate-600">Use Excel to add or update many trucks at once. Existing vehicle numbers are updated.</p>
            <button className="btn-muted w-full" onClick={() => downloadFile('/vehicles/template', 'vehicle-import-template.xlsx')}>Download Template</button>
            <button className="btn-muted w-full" onClick={() => downloadFile('/vehicles/export', 'vehicles-export.xlsx')}>Export Vehicles</button>
            <label className="block">
              Upload Vehicle Excel
              <input className="mt-1" type="file" accept=".xlsx" onChange={uploadExcel} />
            </label>
          </section>
        </div>
        <DataTable rows={vehicles} columns={[
          { key: 'vehicle_no', label: 'Vehicle' },
          { key: 'ownership', label: 'Type' },
          { key: 'owner_name', label: 'Owner' },
          { key: 'status', label: 'Status', render: (r) => <span className={`rounded px-2 py-1 text-xs font-semibold ${statusClass(r.status)}`}>{r.status.replace('_', ' ')}</span> },
          { key: 'is_active', label: 'Active', render: (r) => r.is_active ? 'Yes' : 'No' },
          {
            key: 'actions',
            label: 'Actions',
            render: (r) => (
              <div className="flex gap-2">
                <button className="btn-muted px-2 py-1" onClick={() => setStatus(r, 'available')}>Available</button>
                <button className="btn-muted px-2 py-1" onClick={() => setStatus(r, 'standby')}>Standby</button>
                <button className="btn-muted px-2 py-1" onClick={() => setStatus(r, 'repair')}>Repair</button>
              </div>
            )
          }
        ]} />
      </div>
    </div>
  );
}
