import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import DataTable from '../components/DataTable.jsx';
import MetricCard from '../components/MetricCard.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';

export default function GpsTracking() {
  const [data, setData] = useState({ vehicles: [], portalUrl: '', apiReady: false });
  const [error, setError] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [form, setForm] = useState({ gps_provider: 'wheelseye', gps_vehicle_ref: '' });

  async function load() {
    setData(await api('/gps/vehicles'));
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  const selectedVehicle = useMemo(
    () => data.vehicles.find((vehicle) => vehicle.id === selectedVehicleId) || null,
    [data.vehicles, selectedVehicleId]
  );

  useEffect(() => {
    if (!selectedVehicle) return;
    setForm({
      gps_provider: selectedVehicle.gps_provider || 'wheelseye',
      gps_vehicle_ref: selectedVehicle.gps_vehicle_ref || ''
    });
  }, [selectedVehicle]);

  async function saveConfig(event) {
    event.preventDefault();
    if (!selectedVehicleId) return;
    setError('');
    try {
      await api(`/gps/vehicles/${selectedVehicleId}`, { method: 'PATCH', body: form });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const summary = useMemo(() => ({
    configured: data.vehicles.filter((vehicle) => vehicle.gps_vehicle_ref).length,
    onTrip: data.vehicles.filter((vehicle) => vehicle.gps_vehicle_ref && vehicle.status === 'on_trip').length,
    standby: data.vehicles.filter((vehicle) => vehicle.gps_vehicle_ref && vehicle.status === 'standby').length,
    missing: data.vehicles.filter((vehicle) => !vehicle.gps_vehicle_ref).length
  }), [data.vehicles]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="GPS Linked" value={summary.configured} tone="money" />
        <MetricCard label="On Trip Linked" value={summary.onTrip} />
        <MetricCard label="Standby Linked" value={summary.standby} />
        <MetricCard label="Needs Setup" value={summary.missing} tone="danger" />
      </div>

      <section className="glass glass-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">WheelsEye GPS Hub</h2>
            <p className="mt-1 text-sm text-slate-600">
              Vehicles can be linked to their WheelsEye reference here. Portal mode is active now. Live API mode can be enabled later if WheelsEye shares enterprise API details.
            </p>
          </div>
          <div className="text-sm text-slate-600">
            {data.apiReady ? 'API mode ready' : 'Portal mode active'}
          </div>
        </div>
      </section>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <form onSubmit={saveConfig} className="glass glass-card space-y-3 p-4">
          <h2 className="text-lg font-bold">Link Vehicle GPS</h2>
          <div>
            <label>Vehicle</label>
            <SearchableSelect
              id="gps-vehicle-options"
              value={selectedVehicleId}
              options={data.vehicles}
              onChange={(vehicleId) => setSelectedVehicleId(vehicleId)}
              placeholder="Type vehicle number"
              getOptionLabel={(vehicle) => vehicle.vehicle_no}
              getSearchText={(vehicle) => `${vehicle.vehicle_no} ${vehicle.status} ${vehicle.ownership}`}
            />
          </div>
          <div>
            <label>Provider</label>
            <select value={form.gps_provider} onChange={(e) => setForm({ ...form, gps_provider: e.target.value })}>
              <option value="wheelseye">WheelsEye</option>
            </select>
          </div>
          <div>
            <label>WheelsEye Vehicle Reference</label>
            <input
              value={form.gps_vehicle_ref}
              onChange={(e) => setForm({ ...form, gps_vehicle_ref: e.target.value })}
              placeholder="Vehicle ref / device ref"
            />
          </div>
          <button className="btn-primary w-full" disabled={!selectedVehicleId}>Save GPS Link</button>
          <a className="btn-muted inline-flex w-full items-center justify-center no-underline" href={data.portalUrl || 'https://wheelseye.com/portal/'} target="_blank" rel="noreferrer">
            Open WheelsEye Portal
          </a>
        </form>

        <DataTable
          rows={data.vehicles}
          columns={[
            { key: 'vehicle_no', label: 'Vehicle' },
            { key: 'status', label: 'Status' },
            { key: 'gps_provider', label: 'Provider', render: (row) => row.gps_provider || '-' },
            { key: 'gps_vehicle_ref', label: 'GPS Ref', render: (row) => row.gps_vehicle_ref || '-' },
            { key: 'last_trip_date', label: 'Last Trip', render: (row) => row.last_trip_date || '-' },
            { key: 'last_driver_name', label: 'Last Driver', render: (row) => row.last_driver_name || '-' }
          ]}
        />
      </div>
    </div>
  );
}
