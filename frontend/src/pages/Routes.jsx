import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import DataTable from '../components/DataTable.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';

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
    if (!form.mine_id || !form.factory_id) return;
    await api('/routes', { method: 'POST', body: form });
    setForm({ mine_id: '', factory_id: '', distance_km: '', expected_diesel_litres: '' });
    await load();
  }

  async function removeRoute(route) {
    if (!window.confirm(`Remove route ${route.mine_name} to ${route.factory_name}?`)) return;
    try {
      const result = await api(`/routes/${route.id}`, { method: 'DELETE' });
      await load();
      if (result?.message) window.alert(result.message);
    } catch (error) {
      window.alert(error.message);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <form onSubmit={submit} className="glass glass-card space-y-3 p-4">
        <h2 className="text-lg font-bold">Create Route</h2>
        <div>
          <label>Mine</label>
          <SearchableSelect
            id="route-mine-options"
            value={form.mine_id}
            options={data.mines}
            onChange={(mineId) => setForm({ ...form, mine_id: mineId })}
            placeholder="Type mine name"
            required
            getOptionLabel={(mine) => mine.name}
          />
        </div>
        <div>
          <label>Factory</label>
          <SearchableSelect
            id="route-factory-options"
            value={form.factory_id}
            options={data.factories}
            onChange={(factoryId) => setForm({ ...form, factory_id: factoryId })}
            placeholder="Type factory name"
            required
            getOptionLabel={(factory) => factory.name}
          />
        </div>
        <div><label>Distance KM</label><input type="number" step="0.01" value={form.distance_km} onChange={(e) => setForm({ ...form, distance_km: e.target.value })} required /></div>
        <div><label>Expected Diesel</label><input type="number" step="0.01" value={form.expected_diesel_litres} onChange={(e) => setForm({ ...form, expected_diesel_litres: e.target.value })} /></div>
        <button className="btn-primary w-full">Save Route</button>
      </form>
      <DataTable rows={data.routes} columns={[
        { key: 'mine_name', label: 'Mine' },
        { key: 'factory_name', label: 'Factory' },
        { key: 'distance_km', label: 'Distance KM' },
        { key: 'expected_diesel_litres', label: 'Expected Diesel' },
        {
          key: 'actions',
          label: 'Actions',
          render: (row) => <button className="btn-muted px-2 py-1 text-red-700" onClick={() => removeRoute(row)}>Remove</button>
        }
      ]} />
    </div>
  );
}
