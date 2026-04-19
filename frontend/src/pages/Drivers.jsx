import { useEffect, useMemo, useState } from 'react';
import { api, getToken } from '../api/client.js';
import DataTable from '../components/DataTable.jsx';
import MetricCard from '../components/MetricCard.jsx';

const today = new Date().toISOString().slice(0, 10);
const money = (value) => `Rs ${Number(value || 0).toLocaleString('en-IN')}`;

function statusClass(status) {
  if (status === 'available') return 'bg-emerald-50 text-emerald-700';
  if (status === 'on_duty') return 'bg-sky-50 text-sky-700';
  if (status === 'vacation') return 'bg-amber-50 text-amber-700';
  return 'bg-slate-100 text-slate-700';
}

export default function Drivers() {
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState('');
  const [importSummary, setImportSummary] = useState(null);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    license_no: '',
    salary: '',
    per_trip_allowance: '',
    current_vehicle_id: ''
  });

  const counts = useMemo(() => ({
    total: drivers.length,
    available: drivers.filter((driver) => driver.status === 'available').length,
    onDuty: drivers.filter((driver) => driver.status === 'on_duty').length,
    vacation: drivers.filter((driver) => driver.status === 'vacation').length
  }), [drivers]);

  async function load() {
    const [driverRows, vehicleRows] = await Promise.all([
      api('/drivers?activeOnly=true'),
      api('/vehicles')
    ]);
    setDrivers(driverRows);
    setVehicles(vehicleRows);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      await api('/drivers', { method: 'POST', body: form });
      setForm({ name: '', phone: '', license_no: '', salary: '', per_trip_allowance: '', current_vehicle_id: '' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function setStatus(driver, status) {
    setError('');
    const body = { status };
    if (status === 'on_duty') body.current_vehicle_id = driver.current_vehicle_id || '';
    if (status === 'vacation') {
      body.vacation_from = today;
      body.vacation_to = today;
    }
    try {
      await api(`/drivers/${driver.id}/status`, { method: 'PATCH', body });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function assignDuty(event, driver) {
    event.preventDefault();
    const vehicleId = event.currentTarget.elements.current_vehicle_id.value;
    if (!vehicleId) {
      setError('Select a vehicle before assigning duty');
      return;
    }
    setError('');
    try {
      await api(`/drivers/${driver.id}/status`, {
        method: 'PATCH',
        body: { status: 'on_duty', current_vehicle_id: vehicleId }
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function giveVacation(event, driver) {
    event.preventDefault();
    const vacationFrom = event.currentTarget.elements.vacation_from.value;
    const vacationTo = event.currentTarget.elements.vacation_to.value;
    setError('');
    try {
      await api(`/drivers/${driver.id}/status`, {
        method: 'PATCH',
        body: { status: 'vacation', vacation_from: vacationFrom, vacation_to: vacationTo }
      });
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
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/drivers/import`, {
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
        <MetricCard label="Total Drivers" value={counts.total} />
        <MetricCard label="Available" value={counts.available} tone="money" />
        <MetricCard label="On Duty" value={counts.onDuty} />
        <MetricCard label="On Vacation" value={counts.vacation} tone="danger" />
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {importSummary && (
        <div className="rounded border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          <div>Imported {importSummary.totalRows} rows. Created {importSummary.created}, updated {importSummary.updated}, failed {importSummary.failed}.</div>
          {importSummary.errors?.length > 0 && (
            <div className="mt-2 space-y-1 text-red-700">
              {importSummary.errors.slice(0, 5).map((item) => (
                <div key={`${item.row}-${item.name}`}>Row {item.row}: {item.errors.join(', ')}</div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <form onSubmit={submit} className="panel space-y-3 p-4">
            <h2 className="text-lg font-bold">Add Driver</h2>
            <div><label>Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div><label>Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><label>License Number</label><input value={form.license_no} onChange={(e) => setForm({ ...form, license_no: e.target.value })} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label>Salary</label><input type="number" step="0.01" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} /></div>
              <div><label>Per Trip Allowance</label><input type="number" step="0.01" value={form.per_trip_allowance} onChange={(e) => setForm({ ...form, per_trip_allowance: e.target.value })} /></div>
            </div>
            <div>
              <label>Default Vehicle</label>
              <select value={form.current_vehicle_id} onChange={(e) => setForm({ ...form, current_vehicle_id: e.target.value })}>
                <option value="">No fixed vehicle</option>
                {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.vehicle_no}</option>)}
              </select>
            </div>
            <button className="btn-primary w-full">Save Driver</button>
          </form>

          <section className="panel space-y-3 p-4">
            <h2 className="text-lg font-bold">Excel Import</h2>
            <p className="text-sm text-slate-600">Add or update drivers in bulk. Use license number to update existing drivers.</p>
            <button className="btn-muted w-full" onClick={() => downloadFile('/drivers/template', 'driver-import-template.xlsx')}>Download Template</button>
            <button className="btn-muted w-full" onClick={() => downloadFile('/drivers/export', 'drivers-export.xlsx')}>Export Drivers</button>
            <label className="block">
              Upload Driver Excel
              <input className="mt-1" type="file" accept=".xlsx" onChange={uploadExcel} />
            </label>
          </section>
        </div>

        <DataTable
          rows={drivers}
          columns={[
            { key: 'name', label: 'Driver' },
            { key: 'phone', label: 'Phone' },
            { key: 'license_no', label: 'License' },
            { key: 'status', label: 'Status', render: (row) => <span className={`rounded px-2 py-1 text-xs font-semibold ${statusClass(row.status)}`}>{row.status.replace('_', ' ')}</span> },
            { key: 'current_vehicle_no', label: 'Vehicle' },
            { key: 'salary', label: 'Salary', render: (row) => money(row.salary) },
            { key: 'per_trip_allowance', label: 'Allowance', render: (row) => money(row.per_trip_allowance) },
            { key: 'total_trips', label: 'Trips' },
            { key: 'total_profit', label: 'Profit', render: (row) => money(row.total_profit) }
          ]}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {drivers.map((driver) => (
          <section key={driver.id} className="panel p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-coal">{driver.name}</h3>
                <p className="text-sm text-slate-500">{driver.phone || 'No phone'} / {driver.current_vehicle_no || 'No vehicle assigned'}</p>
              </div>
              <span className={`rounded px-2 py-1 text-xs font-semibold ${statusClass(driver.status)}`}>{driver.status.replace('_', ' ')}</span>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              <form onSubmit={(event) => assignDuty(event, driver)} className="space-y-2">
                <label>Assign Duty</label>
                <select name="current_vehicle_id" defaultValue={driver.current_vehicle_id || ''}>
                  <option value="">Select vehicle</option>
                  {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.vehicle_no}</option>)}
                </select>
                <button className="btn-primary w-full">Mark On Duty</button>
              </form>

              <form onSubmit={(event) => giveVacation(event, driver)} className="space-y-2">
                <label>Give Vacation</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input name="vacation_from" type="date" defaultValue={today} required />
                  <input name="vacation_to" type="date" defaultValue={today} required />
                </div>
                <button className="btn-muted w-full">Mark Vacation</button>
              </form>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn-muted" onClick={() => setStatus(driver, 'available')}>Mark Available</button>
              <button className="btn-muted" onClick={() => setStatus(driver, 'inactive')}>Mark Inactive</button>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
