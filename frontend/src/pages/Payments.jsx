import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import DataTable from '../components/DataTable.jsx';
import MetricCard from '../components/MetricCard.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import SectionTabs from '../components/SectionTabs.jsx';

const today = new Date().toISOString().slice(0, 10);
const money = (value) => `Rs ${Number(value || 0).toLocaleString('en-IN')}`;
const tons = (value) => `${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })} t`;

const paymentTabs = [
  { id: 'entry', label: 'Receive Payment', hint: 'Fast entry' },
  { id: 'ledger', label: 'Party Ledger', hint: 'Outstanding' },
  { id: 'history', label: 'Payment Log', hint: 'Audit trail' }
];

const tabMeta = {
  entry: {
    title: 'Receive Payment',
    description: 'Enter payment by D.O. first when you have it, let the party fill automatically, and keep the bank narration tied in.'
  },
  ledger: {
    title: 'Party Ledger',
    description: 'See who has paid, who still owes, and how much billing is sitting open.'
  },
  history: {
    title: 'Payment Log',
    description: 'Use the full payment trail for checking references, narration, and bank allocation.'
  }
};

export default function Payments() {
  const [tab, setTab] = useState('entry');
  const [factories, setFactories] = useState([]);
  const [deliveryOrders, setDeliveryOrders] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    factory_id: '',
    delivery_order_id: '',
    bank_account_id: '',
    payment_date: today,
    amount: '',
    mode: 'bank',
    reference_no: '',
    narration: '',
    notes: ''
  });

  async function load() {
    const [factoryRows, deliveryOrderRows, bankAccountRows, paymentRows, ledgerRows] = await Promise.all([
      api('/factories'),
      api('/delivery-orders'),
      api('/banking/accounts'),
      api('/payments'),
      api('/payments/ledger')
    ]);
    setFactories(factoryRows);
    setDeliveryOrders(deliveryOrderRows);
    setBankAccounts(bankAccountRows);
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

  const summary = useMemo(() => ({
    billing: ledger.reduce((sum, row) => sum + Number(row.total_billing || 0), 0),
    received: ledger.reduce((sum, row) => sum + Number(row.payments_received || 0), 0),
    pending: ledger.reduce((sum, row) => sum + Number(row.pending_balance || 0), 0),
    dueParties: ledger.filter((row) => Number(row.pending_balance || 0) > 0).length
  }), [ledger]);

  useEffect(() => {
    if (!selectedDeliveryOrder) return;
    setForm((current) => ({
      ...current,
      factory_id: selectedDeliveryOrder.factory_id || '',
      narration: current.narration || `Payment received against ${selectedDeliveryOrder.do_number}`
    }));
  }, [selectedDeliveryOrder]);

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      await api('/payments', { method: 'POST', body: form });
      setForm({
        factory_id: '',
        delivery_order_id: '',
        bank_account_id: '',
        payment_date: today,
        amount: '',
        mode: 'bank',
        reference_no: '',
        narration: '',
        notes: ''
      });
      await load();
      setTab('history');
    } catch (err) {
      setError(err.message);
    }
  }

  async function removePayment(payment) {
    if (!window.confirm(`Remove payment from ${payment.factory_name} on ${payment.payment_date}?`)) return;
    setError('');
    try {
      const result = await api(`/payments/${payment.id}`, { method: 'DELETE' });
      await load();
      if (result?.message) window.alert(result.message);
    } catch (err) {
      setError(err.message);
    }
  }

  function renderPaymentForm() {
    return (
      <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
        <form onSubmit={submit} className="glass glass-card space-y-3 p-4">
          <h2 className="text-lg font-bold">Record Payment</h2>
          <p className="text-sm text-slate-600">Pick the D.O. first if you have it. The party fills automatically, and the bank entry stays linked to the right account with narration.</p>

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

          <div>
            <label>Deposit Bank Account</label>
            <SearchableSelect
              id="payment-bank-account-options"
              value={form.bank_account_id}
              options={bankAccounts}
              onChange={(bankAccountId) => setForm((current) => ({ ...current, bank_account_id: bankAccountId }))}
              placeholder="Type bank account name"
              getOptionLabel={(account) => account.account_name}
              getSearchText={(account) => `${account.account_name} ${account.bank_name || ''} ${account.account_holder_name || ''}`}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div><label>Date</label><input type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} required /></div>
            <div><label>Amount</label><input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div><label>Mode</label><input value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} /></div>
            <div><label>Reference</label><input value={form.reference_no} onChange={(e) => setForm({ ...form, reference_no: e.target.value })} /></div>
          </div>

          <div><label>Narration</label><input value={form.narration} onChange={(e) => setForm({ ...form, narration: e.target.value })} placeholder="Narration for accounts and bank entry" /></div>
          <div><label>Notes</label><textarea rows="3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <button className="btn-primary w-full">Save Payment</button>
        </form>

        <DataTable
          rows={payments.slice(0, 12)}
          columns={[
            { key: 'payment_date', label: 'Date' },
            { key: 'do_number', label: 'D.O.', render: (row) => row.do_number || '-' },
            { key: 'factory_name', label: 'Party' },
            { key: 'bank_account_name', label: 'Bank', render: (row) => row.bank_account_name || '-' },
            { key: 'amount', label: 'Amount', render: (row) => money(row.amount) },
            { key: 'reference_no', label: 'Reference', render: (row) => row.reference_no || '-' }
          ]}
        />
      </div>
    );
  }

  function renderLedger() {
    return (
      <DataTable
        rows={ledger}
        columns={[
          { key: 'factory_name', label: 'Party' },
          { key: 'total_billing', label: 'Billing', render: (row) => money(row.total_billing) },
          { key: 'payments_received', label: 'Received', render: (row) => money(row.payments_received) },
          { key: 'pending_balance', label: 'Pending', render: (row) => money(row.pending_balance) }
        ]}
      />
    );
  }

  function renderHistory() {
    return (
      <DataTable
        rows={payments}
        columns={[
          { key: 'payment_date', label: 'Date' },
          { key: 'do_number', label: 'D.O.', render: (row) => row.do_number || '-' },
          { key: 'factory_name', label: 'Party' },
          { key: 'bank_account_name', label: 'Bank', render: (row) => row.bank_account_name || '-' },
          { key: 'amount', label: 'Amount', render: (row) => money(row.amount) },
          { key: 'mode', label: 'Mode' },
          { key: 'reference_no', label: 'Reference', render: (row) => row.reference_no || '-' },
          { key: 'narration', label: 'Narration', render: (row) => row.narration || row.notes || '-' },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => <button className="btn-muted px-2 py-1 text-red-700" onClick={() => removePayment(row)}>Remove</button>
          }
        ]}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="report-toolbar print-hide">
        <div>
          <h2 className="text-lg font-bold">{tabMeta[tab].title}</h2>
          <p className="text-sm text-slate-600">{tabMeta[tab].description}</p>
        </div>
      </div>

      <SectionTabs items={paymentTabs} value={tab} onChange={setTab} ariaLabel="Payment sections" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Billing" value={money(summary.billing)} />
        <MetricCard label="Payments Received" value={money(summary.received)} tone="money" />
        <MetricCard label="Pending Balance" value={money(summary.pending)} tone="danger" />
        <MetricCard label="Parties Pending" value={summary.dueParties} />
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {tab === 'entry' ? renderPaymentForm() : tab === 'ledger' ? renderLedger() : renderHistory()}
    </div>
  );
}
