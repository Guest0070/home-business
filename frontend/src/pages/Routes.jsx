import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import DataTable from '../components/DataTable.jsx';

export default function Routes() {
  const [data, setData] = useState({ routes: [], mines: [], factories: [] });
  const [form, setForm] = useState({ mine_id: '', factory_id: '', distance_km: '', expected_diesel_litres: '' });

  async function load() {
    const [routes, mines, factories] = await Promise.all([api('/routes'), api('/mines'), api('/factories')]);
    setData({ routes, mines, factories });
  }

  useEffect(() => { load().catch(console.error); }, []);

  async function submit(event) {
    event.preventDefault();
    await api('/routes', { method: 'POST', body: form });
    setForm({ mine_id: '', factory_id: '', distance_km: '', expected_diesel_litres: '' });
    await load();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <form onSubmit={submit} className="panel space-y-3 p-4">
        <h2 className="text-lg font-bold">Create Route</h2>
        <div><label>Mine</label><select value={form.mine_id} onChange={(e) => setForm({ ...form, mine_id: e.target.value })} required><option value="">Select</option>{data.mines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
        <div><label>Factory</label><select value={form.factory_id} onChange={(e) => setForm({ ...form, factory_id: e.target.value })} required><option value="">Select</option>{data.factories.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
        <div><label>Distance KM</label><input type="number" step="0.01" value={form.distance_km} onChange={(e) => setForm({ ...form, distance_km: e.target.value })} required /></div>
        <div><label>Expected Diesel</label><input type="number" step="0.01" value={form.expected_diesel_litres} onChange={(e) => setForm({ ...form, expected_diesel_litres: e.target.value })} /></div>
        <button className="btn-primary w-full">Save Route</button>
      </form>
      <DataTable rows={data.routes} columns={[
        { key: 'mine_name', label: 'Mine' },
        { key: 'factory_name', label: 'Factory' },
        { key: 'distance_km', label: 'Distance KM' },
        { key: 'expected_diesel_litres', label: 'Expected Diesel' }
      ]} />
    </div>
  );
}

