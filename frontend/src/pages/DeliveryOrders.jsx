import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import DataTable from '../components/DataTable.jsx';
import MetricCard from '../components/MetricCard.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';

const today = new Date().toISOString().slice(0, 10);

function tons(value) {
  return `${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })} t`;
}

function money(value) {
  return `Rs ${Number(value || 0).toLocaleString('en-IN')}`;
}

export default function DeliveryOrders() {
  const [orders, setOrders] = useState([]);
  const [mines, setMines] = useState([]);
  const [factories, setFactories] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    do_number: '',
    issue_date: today,
    mine_id: '',
    factory_id: '',
    total_tons: '',
    rate_per_ton: '',
    notes: ''
  });

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

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      await api('/delivery-orders', { method: 'POST', body: form });
      setForm({
        do_number: '',
        issue_date: today,
        mine_id: '',
        factory_id: '',
        total_tons: '',
        rate_per_ton: '',
        notes: ''
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const totals = useMemo(() => ({
    open: orders.filter((order) => order.status === 'open').length,
    totalTons: orders.reduce((sum, order) => sum + Number(order.total_tons || 0), 0),
    delivered: orders.reduce((sum, order) => sum + Number(order.delivered_tons || 0), 0),
    pending: orders.reduce((sum, order) => sum + Number(order.pending_tons || 0), 0)
  }), [orders]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Open D.O." value={totals.open} />
        <MetricCard label="Ordered Tons" value={tons(totals.totalTons)} />
        <MetricCard label="Delivered Tons" value={tons(totals.delivered)} tone="money" />
        <MetricCard label="Pending Tons" value={tons(totals.pending)} tone="danger" />
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <form onSubmit={submit} className="glass glass-card space-y-3 p-4">
          <h2 className="text-lg font-bold">New Delivery Order</h2>
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
            />
          </div>
          <div><label>Total Tons</label><input type="number" step="0.001" value={form.total_tons} onChange={(e) => setForm({ ...form, total_tons: e.target.value })} required /></div>
          <div><label>Rate Per Ton</label><input type="number" step="0.01" value={form.rate_per_ton} onChange={(e) => setForm({ ...form, rate_per_ton: e.target.value })} /></div>
          <div><label>Notes</label><textarea rows="3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <button className="btn-primary w-full">Save Delivery Order</button>
        </form>

        <DataTable
          rows={orders}
          columns={[
            { key: 'do_number', label: 'D.O.' },
            { key: 'issue_date', label: 'Date' },
            { key: 'mine_name', label: 'Mine' },
            { key: 'factory_name', label: 'Party' },
            { key: 'total_tons', label: 'Ordered', render: (row) => tons(row.total_tons) },
            { key: 'delivered_tons', label: 'Delivered', render: (row) => tons(row.delivered_tons) },
            { key: 'pending_tons', label: 'Pending', render: (row) => tons(row.pending_tons) },
            { key: 'rate_per_ton', label: 'Rate', render: (row) => row.rate_per_ton ? money(row.rate_per_ton) : '-' },
            { key: 'status', label: 'Status' }
          ]}
        />
      </div>
    </div>
  );
}
