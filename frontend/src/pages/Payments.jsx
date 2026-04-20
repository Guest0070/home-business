import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import DataTable from '../components/DataTable.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';

const today = new Date().toISOString().slice(0, 10);
const money = (value) => `Rs ${Number(value || 0).toLocaleString('en-IN')}`;
const tons = (value) => `${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })} t`;

export default function Payments() {
  const [factories, setFactories] = useState([]);
  const [deliveryOrders, setDeliveryOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    factory_id: '',
    delivery_order_id: '',
    payment_date: today,
    amount: '',
    mode: 'bank',
    reference_no: '',
    notes: ''
  });

  async function load() {
    const [factoryRows, deliveryOrderRows, paymentRows, ledgerRows] = await Promise.all([
      api('/factories'),
      api('/delivery-orders'),
      api('/payments'),
      api('/payments/ledger')
    ]);
    setFactories(factoryRows);
    setDeliveryOrders(deliveryOrderRows);
    setPayments(paymentRows);
    setLedger(ledgerRows);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  const selectedDeliveryOrder = useMemo(
    () => deliveryOrders.find((order) => order.id === form.delivery_order_id) || null,
    [deliveryOrders, form.delivery_order_id]
  );

  useEffect(() => {
    if (!selectedDeliveryOrder) return;
    setForm((current) => ({
      ...current,
      factory_id: selectedDeliveryOrder.factory_id || '',
      notes: current.notes || `Payment received against ${selectedDeliveryOrder.do_number}`
    }));
  }, [selectedDeliveryOrder]);

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      await api('/payments', { method: 'POST', body: form });
      setForm({ factory_id: '', delivery_order_id: '', payment_date: today, amount: '', mode: 'bank', reference_no: '', notes: '' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-4">
      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <form onSubmit={submit} className="glass glass-card space-y-3 p-4">
          <h2 className="text-lg font-bold">Record Payment</h2>
          <p className="text-sm text-slate-600">Pick the D.O. first if you have it. The party will fill automatically so payment entry stays quick.</p>

          <div>
            <label>D.O. Number</label>
            <SearchableSelect
              id="payment-do-options"
              value={form.delivery_order_id}
              options={deliveryOrders}
              onChange={(deliveryOrderId) => setForm((current) => ({ ...current, delivery_order_id: deliveryOrderId }))}
              placeholder="Type D.O. number"
              getOptionLabel={(order) => order.do_number}
              getSearchText={(order) => `${order.do_number} ${order.factory_name || ''} ${order.mine_name || ''}`}
            />
          </div>

          {selectedDeliveryOrder && (
            <div className="trip-do-summary">
              <div className="trip-do-summary-row">
                <span>Party</span>
                <strong>{selectedDeliveryOrder.factory_name || 'No party linked'}</strong>
              </div>
              <div className="trip-do-summary-row">
                <span>Mine</span>
                <strong>{selectedDeliveryOrder.mine_name || '-'}</strong>
              </div>
              <div className="trip-do-summary-row">
                <span>Pending Tons</span>
                <strong>{tons(selectedDeliveryOrder.pending_tons)}</strong>
              </div>
            </div>
          )}

          <div>
            <label>Party</label>
            <SearchableSelect
              id="payment-factory-options"
              value={form.factory_id}
              options={factories}
              onChange={(factoryId) => setForm((current) => ({ ...current, factory_id: factoryId }))}
              placeholder={selectedDeliveryOrder ? 'Linked from delivery order' : 'Type party name'}
              required
              getOptionLabel={(factory) => factory.name}
              getSearchText={(factory) => `${factory.name} ${factory.contact_name || ''} ${factory.phone || ''}`}
              disabled={Boolean(selectedDeliveryOrder)}
            />
          </div>
          <div><label>Date</label><input type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} required /></div>
          <div><label>Amount</label><input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></div>
          <div><label>Mode</label><input value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} /></div>
          <div><label>Reference</label><input value={form.reference_no} onChange={(e) => setForm({ ...form, reference_no: e.target.value })} /></div>
          <div><label>Notes</label><textarea rows="3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <button className="btn-primary w-full">Save Payment</button>
        </form>

        <DataTable rows={ledger} columns={[
          { key: 'factory_name', label: 'Party' },
          { key: 'total_billing', label: 'Billing', render: (row) => money(row.total_billing) },
          { key: 'payments_received', label: 'Received', render: (row) => money(row.payments_received) },
          { key: 'pending_balance', label: 'Pending', render: (row) => money(row.pending_balance) }
        ]} />
      </div>

      <DataTable rows={payments} columns={[
        { key: 'payment_date', label: 'Date' },
        { key: 'do_number', label: 'D.O.', render: (row) => row.do_number || '-' },
        { key: 'factory_name', label: 'Party' },
        { key: 'amount', label: 'Amount', render: (row) => money(row.amount) },
        { key: 'mode', label: 'Mode' },
        { key: 'reference_no', label: 'Reference' }
      ]} />
    </div>
  );
}
