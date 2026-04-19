import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import DataTable from '../components/DataTable.jsx';

const today = new Date().toISOString().slice(0, 10);
const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

export default function Payments() {
  const [factories, setFactories] = useState([]);
  const [payments, setPayments] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [form, setForm] = useState({ factory_id: '', payment_date: today, amount: '', mode: 'bank', reference_no: '', notes: '' });

  async function load() {
    const [factoryRows, paymentRows, ledgerRows] = await Promise.all([api('/factories'), api('/payments'), api('/payments/ledger')]);
    setFactories(factoryRows);
    setPayments(paymentRows);
    setLedger(ledgerRows);
  }

  useEffect(() => { load().catch(console.error); }, []);

  async function submit(event) {
    event.preventDefault();
    await api('/payments', { method: 'POST', body: form });
    setForm({ factory_id: '', payment_date: today, amount: '', mode: 'bank', reference_no: '', notes: '' });
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <form onSubmit={submit} className="panel space-y-3 p-4">
          <h2 className="text-lg font-bold">Record Payment</h2>
          <div><label>Party</label><select value={form.factory_id} onChange={(e) => setForm({ ...form, factory_id: e.target.value })} required><option value="">Select</option>{factories.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
          <div><label>Date</label><input type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} required /></div>
          <div><label>Amount</label><input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></div>
          <div><label>Mode</label><input value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} /></div>
          <div><label>Reference</label><input value={form.reference_no} onChange={(e) => setForm({ ...form, reference_no: e.target.value })} /></div>
          <button className="btn-primary w-full">Save Payment</button>
        </form>
        <DataTable rows={ledger} columns={[
          { key: 'factory_name', label: 'Party' },
          { key: 'total_billing', label: 'Billing', render: (r) => money(r.total_billing) },
          { key: 'payments_received', label: 'Received', render: (r) => money(r.payments_received) },
          { key: 'pending_balance', label: 'Pending', render: (r) => money(r.pending_balance) }
        ]} />
      </div>
      <DataTable rows={payments} columns={[
        { key: 'payment_date', label: 'Date' },
        { key: 'factory_name', label: 'Party' },
        { key: 'amount', label: 'Amount', render: (r) => money(r.amount) },
        { key: 'mode', label: 'Mode' },
        { key: 'reference_no', label: 'Reference' }
      ]} />
    </div>
  );
}

