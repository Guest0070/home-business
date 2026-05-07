import { useEffect, useMemo, useState } from 'react';
import { api, apiForm, downloadApiFile } from '../api/client.js';
import DataTable from '../components/DataTable.jsx';
import ImportReview from '../components/ImportReview.jsx';
import MetricCard from '../components/MetricCard.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import SectionTabs from '../components/SectionTabs.jsx';

const today = new Date().toISOString().slice(0, 10);
const money = (value) => `Rs ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

function appendTimeframe(query, filters) {
  if (filters.fromDate && filters.fromTime) query.set('from_at', `${filters.fromDate}T${filters.fromTime}`);
  else if (filters.fromDate) query.set('from', filters.fromDate);
  if (filters.toDate && filters.toTime) query.set('to_at', `${filters.toDate}T${filters.toTime}`);
  else if (filters.toDate) query.set('to', filters.toDate);
}

function quickWindow(mode, currentFilters) {
  const now = new Date();
  if (mode === 'today') {
    const value = now.toISOString().slice(0, 10);
    return { ...currentFilters, fromDate: value, fromTime: '00:00', toDate: value, toTime: '23:59' };
  }
  if (mode === 'month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      ...currentFilters,
      fromDate: monthStart.toISOString().slice(0, 10),
      fromTime: '00:00',
      toDate: now.toISOString().slice(0, 10),
      toTime: '23:59'
    };
  }
  return { ...currentFilters, fromDate: '', fromTime: '', toDate: '', toTime: '' };
}

function exportWindowLabel(filters) {
  const from = filters.fromDate
    ? `${filters.fromDate}${filters.fromTime ? ` ${filters.fromTime}` : ''}`
    : 'Start';
  const to = filters.toDate
    ? `${filters.toDate}${filters.toTime ? ` ${filters.toTime}` : ''}`
    : 'Now';
  return `${from} to ${to}`;
}

const sectionMeta = {
  banking: {
    title: 'Bank Accounts',
    description: 'Keep all bank identities clean and mapped for exports.',
    exportLabel: 'Export Accounts',
    exportPath: '/exports/bank-accounts?format=csv&preset=standard'
  },
  'bank-accounts': {
    title: 'Bank Accounts',
    description: 'One clear place for every account name, bank, holder, and ledger mapping.',
    exportLabel: 'Export Accounts',
    exportPath: '/exports/bank-accounts?format=csv&preset=standard'
  },
  'bank-entries': {
    title: 'Bank Entries',
    description: 'Use this for manual credits, debits, narration, and corrections.',
    exportLabel: 'Export Entries',
    exportPath: '/exports/bank-transactions?format=csv&preset=standard'
  },
  'bank-statements': {
    title: 'Bank Statements',
    description: 'Review statement rows before import and let duplicates skip automatically.',
    exportLabel: 'Export Statements',
    exportPath: '/exports/bank-transactions?format=csv&preset=sales-book'
  },
  'bank-loans': {
    title: 'Bank Loans',
    description: 'Track sanction details, EMI plans, due dates, and installment payments separately from daily banking.',
    exportLabel: 'Export Loan Schedule',
    exportPath: '/exports/loan-installments?format=csv&preset=ledger-voucher'
  }
};

function loanStatusClass(row) {
  if (Number(row.overdue_installments || 0) > 0) return 'bg-red-50 text-red-700';
  if (Number(row.due_installments || 0) > 0) return 'bg-amber-50 text-amber-700';
  return 'bg-emerald-50 text-emerald-700';
}

function installmentClass(status) {
  if (status === 'paid') return 'bg-emerald-50 text-emerald-700';
  if (status === 'overdue') return 'bg-red-50 text-red-700';
  if (status === 'skipped') return 'bg-slate-100 text-slate-600';
  return 'bg-amber-50 text-amber-700';
}

const bankingTabs = [
  { id: 'bank-accounts', label: 'Accounts', hint: 'Master data' },
  { id: 'bank-entries', label: 'Entries', hint: 'Manual postings' },
  { id: 'bank-statements', label: 'Statements', hint: 'Import review' },
  { id: 'bank-loans', label: 'Loans', hint: 'EMI tracking' }
];

export default function Banking({ page, setPage }) {
  const section = ['bank-accounts', 'bank-entries', 'bank-statements', 'bank-loans'].includes(page) ? page : 'bank-accounts';
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loans, setLoans] = useState([]);
  const [installments, setInstallments] = useState([]);
  const [error, setError] = useState('');
  const [importSummary, setImportSummary] = useState(null);
  const [preview, setPreview] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [statementAccountId, setStatementAccountId] = useState('');
  const [busy, setBusy] = useState(false);
  const [exportFilters, setExportFilters] = useState({
    fromDate: '',
    fromTime: '',
    toDate: '',
    toTime: ''
  });
  const [transactionFilters, setTransactionFilters] = useState({
    accountId: '',
    source: 'all',
    direction: 'all',
    search: ''
  });
  const [loanFilter, setLoanFilter] = useState('due');
  const [accountForm, setAccountForm] = useState({
    account_name: '',
    bank_name: '',
    account_holder_name: '',
    account_number_last4: '',
    ifsc_code: '',
    opening_balance: '',
    zoho_account_name: '',
    tally_ledger_name: ''
  });
  const [transactionForm, setTransactionForm] = useState({
    bank_account_id: '',
    entry_date: today,
    value_date: '',
    direction: 'credit',
    amount: '',
    narration: '',
    reference_no: '',
    balance_after: ''
  });
  const [loanForm, setLoanForm] = useState({
    bank_account_id: '',
    loan_name: '',
    lender_name: '',
    sanction_date: '',
    disbursement_date: '',
    principal_amount: '',
    outstanding_amount: '',
    emi_amount: '',
    interest_rate: '',
    repayment_day: '',
    next_due_date: '',
    end_date: '',
    reminder_days: 7,
    narration: '',
    zoho_loan_name: '',
    tally_ledger_name: ''
  });

  async function load() {
    const [accountRows, transactionRows, loanPayload] = await Promise.all([
      api('/banking/accounts'),
      api('/banking/transactions'),
      api('/banking/loans')
    ]);
    setAccounts(accountRows);
    setTransactions(transactionRows);
    setLoans(loanPayload.loans);
    setInstallments(loanPayload.installments);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  const summary = useMemo(() => ({
    accounts: accounts.length,
    totalBalance: accounts.reduce((sum, account) => sum + Number(account.current_balance || 0), 0),
    activeLoans: loans.filter((loan) => loan.is_active).length,
    dueInstallments: installments.filter((item) => item.status === 'due' || item.status === 'overdue').length
  }), [accounts, installments, loans]);

  const filteredTransactions = useMemo(() => {
    const search = transactionFilters.search.trim().toLowerCase();
    return transactions.filter((transaction) => {
      const matchesAccount = !transactionFilters.accountId || transaction.bank_account_id === transactionFilters.accountId;
      const matchesSource = transactionFilters.source === 'all' || transaction.source_type === transactionFilters.source;
      const matchesDirection = transactionFilters.direction === 'all' || transaction.direction === transactionFilters.direction;
      const matchesSearch = !search
        || [
          transaction.account_name,
          transaction.bank_name,
          transaction.narration,
          transaction.reference_no,
          transaction.source_type
        ].some((value) => String(value || '').toLowerCase().includes(search));
      return matchesAccount && matchesSource && matchesDirection && matchesSearch;
    });
  }, [transactions, transactionFilters]);

  const filteredLoans = useMemo(() => loans.filter((loan) => {
    if (loanFilter === 'all') return true;
    if (loanFilter === 'overdue') return Number(loan.overdue_installments || 0) > 0;
    if (loanFilter === 'due') return Number(loan.overdue_installments || 0) > 0 || Number(loan.due_installments || 0) > 0;
    return loan.is_active;
  }), [loanFilter, loans]);

  const filteredInstallments = useMemo(() => installments.filter((installment) => {
    if (loanFilter === 'all') return true;
    if (loanFilter === 'overdue') return installment.status === 'overdue';
    if (loanFilter === 'due') return installment.status === 'due' || installment.status === 'overdue';
    return installment.status !== 'paid';
  }), [installments, loanFilter]);

  async function submitAccount(event) {
    event.preventDefault();
    setError('');
    try {
      await api('/banking/accounts', { method: 'POST', body: accountForm });
      setAccountForm({
        account_name: '',
        bank_name: '',
        account_holder_name: '',
        account_number_last4: '',
        ifsc_code: '',
        opening_balance: '',
        zoho_account_name: '',
        tally_ledger_name: ''
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitTransaction(event) {
    event.preventDefault();
    setError('');
    try {
      await api('/banking/transactions', { method: 'POST', body: transactionForm });
      setTransactionForm({
        bank_account_id: '',
        entry_date: today,
        value_date: '',
        direction: 'credit',
        amount: '',
        narration: '',
        reference_no: '',
        balance_after: ''
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitLoan(event) {
    event.preventDefault();
    setError('');
    try {
      await api('/banking/loans', { method: 'POST', body: loanForm });
      setLoanForm({
        bank_account_id: '',
        loan_name: '',
        lender_name: '',
        sanction_date: '',
        disbursement_date: '',
        principal_amount: '',
        outstanding_amount: '',
        emi_amount: '',
        interest_rate: '',
        repayment_day: '',
        next_due_date: '',
        end_date: '',
        reminder_days: 7,
        narration: '',
        zoho_loan_name: '',
        tally_ledger_name: ''
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function reviewStatement(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!statementAccountId) {
      setError('Select a bank account before reviewing the statement file');
      event.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('bank_account_id', statementAccountId);
    formData.append('file', file);

    setError('');
    setImportSummary(null);
    setPreview(null);
    setPendingFile(file);

    try {
      setPreview(await apiForm('/banking/statement/preview', formData));
    } catch (err) {
      setError(err.message);
      setPendingFile(null);
    } finally {
      event.target.value = '';
    }
  }

  async function confirmImport() {
    if (!pendingFile || !statementAccountId) return;
    const formData = new FormData();
    formData.append('bank_account_id', statementAccountId);
    formData.append('file', pendingFile);

    setBusy(true);
    setError('');
    try {
      setImportSummary(await apiForm('/banking/statement/import', formData));
      setPreview(null);
      setPendingFile(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function markInstallmentPaid(item) {
    setError('');
    try {
      await api(`/banking/installments/${item.id}`, {
        method: 'PATCH',
        body: { status: 'paid', paid_on: today, notes: item.notes || '' }
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeAccount(account) {
    if (!window.confirm(`Remove bank account ${account.account_name}?`)) return;
    setError('');
    try {
      const result = await api(`/banking/accounts/${account.id}`, { method: 'DELETE' });
      await load();
      if (result?.message) window.alert(result.message);
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeTransaction(item) {
    if (!window.confirm(`Remove bank transaction for ${item.account_name} on ${item.entry_date}?`)) return;
    setError('');
    try {
      const result = await api(`/banking/transactions/${item.id}`, { method: 'DELETE' });
      await load();
      if (result?.message) window.alert(result.message);
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeLoan(item) {
    if (!window.confirm(`Remove bank loan ${item.loan_name}?`)) return;
    setError('');
    try {
      const result = await api(`/banking/loans/${item.id}`, { method: 'DELETE' });
      await load();
      if (result?.message) window.alert(result.message);
    } catch (err) {
      setError(err.message);
    }
  }

  function exportCurrent() {
    const meta = sectionMeta[section];
    const filenameMap = {
      'bank-accounts': 'bank-accounts.csv',
      'bank-entries': 'bank-transactions.csv',
      'bank-statements': 'bank-statements.csv',
      'bank-loans': 'loan-installments-ledger-voucher.csv',
      banking: 'bank-accounts.csv'
    };
    const [path, rawQuery = ''] = meta.exportPath.split('?');
    const params = new URLSearchParams(rawQuery);
    if (section !== 'bank-accounts') {
      appendTimeframe(params, exportFilters);
    }
    const query = params.toString();
    downloadApiFile(`${path}${query ? `?${query}` : ''}`, filenameMap[section] || 'banking-export.csv').catch((err) => setError(err.message));
  }

  function renderAccounts() {
    return (
      <>
        <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
          <form onSubmit={submitAccount} className="glass glass-card space-y-3 p-4">
            <h2 className="text-lg font-bold">Add Bank Account</h2>
            <div><label>Account Name</label><input value={accountForm.account_name} onChange={(e) => setAccountForm({ ...accountForm, account_name: e.target.value })} required /></div>
            <div><label>Bank Name</label><input value={accountForm.bank_name} onChange={(e) => setAccountForm({ ...accountForm, bank_name: e.target.value })} required /></div>
            <div><label>Account Holder</label><input value={accountForm.account_holder_name} onChange={(e) => setAccountForm({ ...accountForm, account_holder_name: e.target.value })} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label>A/C Last 4</label><input value={accountForm.account_number_last4} maxLength={4} onChange={(e) => setAccountForm({ ...accountForm, account_number_last4: e.target.value.replace(/\D/g, '').slice(0, 4) })} /></div>
              <div><label>IFSC</label><input value={accountForm.ifsc_code} onChange={(e) => setAccountForm({ ...accountForm, ifsc_code: e.target.value.toUpperCase() })} /></div>
            </div>
            <div><label>Opening Balance</label><input type="number" step="0.01" value={accountForm.opening_balance} onChange={(e) => setAccountForm({ ...accountForm, opening_balance: e.target.value })} /></div>
            <div><label>Sales Book Name</label><input value={accountForm.zoho_account_name} onChange={(e) => setAccountForm({ ...accountForm, zoho_account_name: e.target.value })} /></div>
            <div><label>Ledger Name</label><input value={accountForm.tally_ledger_name} onChange={(e) => setAccountForm({ ...accountForm, tally_ledger_name: e.target.value })} /></div>
            <button className="btn-primary w-full">Save Bank Account</button>
          </form>

          <DataTable
            rows={accounts}
            columns={[
              { key: 'account_name', label: 'Account' },
              { key: 'bank_name', label: 'Bank' },
              { key: 'account_holder_name', label: 'Holder', render: (row) => row.account_holder_name || '-' },
              { key: 'account_number_last4', label: 'A/C Last 4', render: (row) => row.account_number_last4 || '-' },
              { key: 'current_balance', label: 'Current Balance', render: (row) => money(row.current_balance) },
              { key: 'zoho_account_name', label: 'Sales Book', render: (row) => row.zoho_account_name || '-' },
              { key: 'tally_ledger_name', label: 'Ledger', render: (row) => row.tally_ledger_name || '-' },
              {
                key: 'actions',
                label: 'Actions',
                render: (row) => <button className="btn-muted px-2 py-1 text-red-700" onClick={() => removeAccount(row)}>Remove</button>
              }
            ]}
          />
        </div>
      </>
    );
  }

  function renderEntries() {
    return (
      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <form onSubmit={submitTransaction} className="glass glass-card space-y-3 p-4">
          <h2 className="text-lg font-bold">Manual Bank Entry</h2>
          <div>
            <label>Bank Account</label>
            <SearchableSelect
              id="banking-transaction-account"
              value={transactionForm.bank_account_id}
              options={accounts}
              onChange={(bankAccountId) => setTransactionForm({ ...transactionForm, bank_account_id: bankAccountId })}
              placeholder="Type account name"
              required
              getOptionLabel={(account) => account.account_name}
              getSearchText={(account) => `${account.account_name} ${account.bank_name || ''}`}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label>Entry Date</label><input type="date" value={transactionForm.entry_date} onChange={(e) => setTransactionForm({ ...transactionForm, entry_date: e.target.value })} required /></div>
            <div><label>Value Date</label><input type="date" value={transactionForm.value_date} onChange={(e) => setTransactionForm({ ...transactionForm, value_date: e.target.value })} /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label>Direction</label>
              <select value={transactionForm.direction} onChange={(e) => setTransactionForm({ ...transactionForm, direction: e.target.value })}>
                <option value="credit">Credit</option>
                <option value="debit">Debit</option>
              </select>
            </div>
            <div><label>Amount</label><input type="number" step="0.01" value={transactionForm.amount} onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })} required /></div>
          </div>
          <div><label>Narration</label><input value={transactionForm.narration} onChange={(e) => setTransactionForm({ ...transactionForm, narration: e.target.value })} required /></div>
          <div><label>Reference No.</label><input value={transactionForm.reference_no} onChange={(e) => setTransactionForm({ ...transactionForm, reference_no: e.target.value })} /></div>
          <div><label>Balance After</label><input type="number" step="0.01" value={transactionForm.balance_after} onChange={(e) => setTransactionForm({ ...transactionForm, balance_after: e.target.value })} /></div>
          <button className="btn-primary w-full">Save Bank Entry</button>
        </form>

        <div className="space-y-3">
          {renderTransactionFilters()}
          {renderTransactionTable(filteredTransactions)}
        </div>
      </div>
    );
  }

  function renderTransactionFilters() {
    return (
      <section className="glass glass-card space-y-3 p-3 print-hide">
        <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr_1.4fr]">
          <SearchableSelect
            id="banking-filter-account"
            value={transactionFilters.accountId}
            options={accounts}
            onChange={(accountId) => setTransactionFilters((current) => ({ ...current, accountId }))}
            placeholder="Filter account"
            getOptionLabel={(account) => account.account_name}
            getSearchText={(account) => `${account.account_name} ${account.bank_name || ''}`}
          />
          <select value={transactionFilters.source} onChange={(event) => setTransactionFilters((current) => ({ ...current, source: event.target.value }))}>
            <option value="all">All sources</option>
            <option value="manual">Manual</option>
            <option value="statement">Statement</option>
            <option value="payment">Payment</option>
            <option value="loan">Loan</option>
          </select>
          <select value={transactionFilters.direction} onChange={(event) => setTransactionFilters((current) => ({ ...current, direction: event.target.value }))}>
            <option value="all">Credit and debit</option>
            <option value="credit">Credit only</option>
            <option value="debit">Debit only</option>
          </select>
          <input
            value={transactionFilters.search}
            onChange={(event) => setTransactionFilters((current) => ({ ...current, search: event.target.value }))}
            placeholder="Search narration, reference, bank"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-normal" style={{ color: 'var(--muted)' }}>
          <span>Showing {filteredTransactions.length} of {transactions.length} entries</span>
          <button
            className="btn-muted px-3 py-2"
            onClick={() => setTransactionFilters({ accountId: '', source: 'all', direction: 'all', search: '' })}
          >
            Clear Filters
          </button>
        </div>
      </section>
    );
  }

  function renderTransactionTable(rows) {
    return (
      <DataTable
        rows={rows}
        columns={[
          { key: 'entry_date', label: 'Date' },
          { key: 'account_name', label: 'Account' },
          { key: 'direction', label: 'Type' },
          { key: 'amount', label: 'Amount', render: (row) => money(row.amount) },
          { key: 'narration', label: 'Narration' },
          { key: 'reference_no', label: 'Reference', render: (row) => row.reference_no || '-' },
          { key: 'source_type', label: 'Source' },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
              row.source_type === 'payment'
                ? 'Use payment log'
                : <button className="btn-muted px-2 py-1 text-red-700" onClick={() => removeTransaction(row)}>Remove</button>
            )
          }
        ]}
      />
    );
  }

  function renderStatements() {
    return (
      <>
        {importSummary && (
          <div className="rounded border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
            <div>Checked {importSummary.totalRows} statement rows. Imported {importSummary.created}, skipped {importSummary.duplicates}, failed {importSummary.failed}.</div>
            {importSummary.errors?.length > 0 && (
              <div className="mt-2 space-y-1 text-red-700">
                {importSummary.errors.slice(0, 5).map((item) => (
                  <div key={`statement-error-${item.row}`}>Row {item.row}: {item.errors.join(', ')}</div>
                ))}
              </div>
            )}
          </div>
        )}

        <ImportReview title="Bank Statement Review" preview={preview} keyField="reference_no" onConfirm={confirmImport} busy={busy} />

        <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
          <section className="glass glass-card space-y-3 p-4">
            <h2 className="text-lg font-bold">Import Bank Statement</h2>
            <p className="text-sm text-slate-600">Upload CSV or Excel. Existing rows are detected and skipped, so you can safely import overlapping statements.</p>
            <div>
              <label>Bank Account</label>
              <SearchableSelect
                id="banking-statement-account"
                value={statementAccountId}
                options={accounts}
                onChange={(bankAccountId) => setStatementAccountId(bankAccountId)}
                placeholder="Type account name"
                getOptionLabel={(account) => account.account_name}
                getSearchText={(account) => `${account.account_name} ${account.bank_name || ''}`}
              />
            </div>
            <label className="block">
              Statement File
              <input className="mt-1" type="file" accept=".xlsx,.csv" onChange={reviewStatement} />
            </label>
          </section>

          <div className="space-y-3">
            {renderTransactionFilters()}
            {renderTransactionTable(filteredTransactions)}
          </div>
      </div>
      </>
    );
  }

  function renderLoans() {
    return (
      <>
        <form onSubmit={submitLoan} className="glass glass-card space-y-3 p-4">
          <h2 className="text-lg font-bold">Add Bank Loan</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label>Bank Account</label>
              <SearchableSelect
                id="banking-loan-account"
                value={loanForm.bank_account_id}
                options={accounts}
                onChange={(bankAccountId) => setLoanForm({ ...loanForm, bank_account_id: bankAccountId })}
                placeholder="Type repayment account"
                getOptionLabel={(account) => account.account_name}
                getSearchText={(account) => `${account.account_name} ${account.bank_name || ''}`}
              />
            </div>
            <div><label>Loan Name</label><input value={loanForm.loan_name} onChange={(e) => setLoanForm({ ...loanForm, loan_name: e.target.value })} required /></div>
            <div><label>Lender Name</label><input value={loanForm.lender_name} onChange={(e) => setLoanForm({ ...loanForm, lender_name: e.target.value })} required /></div>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <div><label>Principal</label><input type="number" step="0.01" value={loanForm.principal_amount} onChange={(e) => setLoanForm({ ...loanForm, principal_amount: e.target.value })} required /></div>
            <div><label>Outstanding</label><input type="number" step="0.01" value={loanForm.outstanding_amount} onChange={(e) => setLoanForm({ ...loanForm, outstanding_amount: e.target.value })} /></div>
            <div><label>EMI Amount</label><input type="number" step="0.01" value={loanForm.emi_amount} onChange={(e) => setLoanForm({ ...loanForm, emi_amount: e.target.value })} /></div>
            <div><label>Interest %</label><input type="number" step="0.001" value={loanForm.interest_rate} onChange={(e) => setLoanForm({ ...loanForm, interest_rate: e.target.value })} /></div>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <div><label>Sanction Date</label><input type="date" value={loanForm.sanction_date} onChange={(e) => setLoanForm({ ...loanForm, sanction_date: e.target.value })} /></div>
            <div><label>Disbursement Date</label><input type="date" value={loanForm.disbursement_date} onChange={(e) => setLoanForm({ ...loanForm, disbursement_date: e.target.value })} /></div>
            <div><label>Next Due Date</label><input type="date" value={loanForm.next_due_date} onChange={(e) => setLoanForm({ ...loanForm, next_due_date: e.target.value })} /></div>
            <div><label>End Date</label><input type="date" value={loanForm.end_date} onChange={(e) => setLoanForm({ ...loanForm, end_date: e.target.value })} /></div>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <div><label>Repayment Day</label><input type="number" min="1" max="31" value={loanForm.repayment_day} onChange={(e) => setLoanForm({ ...loanForm, repayment_day: e.target.value })} /></div>
            <div><label>Reminder Days</label><input type="number" min="0" value={loanForm.reminder_days} onChange={(e) => setLoanForm({ ...loanForm, reminder_days: e.target.value })} /></div>
            <div><label>Loan Book Name</label><input value={loanForm.zoho_loan_name} onChange={(e) => setLoanForm({ ...loanForm, zoho_loan_name: e.target.value })} /></div>
            <div><label>Ledger Name</label><input value={loanForm.tally_ledger_name} onChange={(e) => setLoanForm({ ...loanForm, tally_ledger_name: e.target.value })} /></div>
          </div>
          <div><label>Narration</label><input value={loanForm.narration} onChange={(e) => setLoanForm({ ...loanForm, narration: e.target.value })} /></div>
          <button className="btn-primary">Save Loan</button>
        </form>

        <section className="glass glass-card flex flex-wrap items-center justify-between gap-3 p-3 print-hide">
          <div className="flex flex-wrap gap-2">
            {[
              ['due', 'Due First'],
              ['overdue', 'Overdue'],
              ['active', 'Active'],
              ['all', 'All']
            ].map(([value, label]) => (
              <button
                key={value}
                className={loanFilter === value ? 'btn-primary px-3 py-2' : 'btn-muted px-3 py-2'}
                onClick={() => setLoanFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="text-xs font-semibold uppercase tracking-normal" style={{ color: 'var(--muted)' }}>
            Showing {filteredLoans.length} loans and {filteredInstallments.length} installments
          </div>
        </section>

        <DataTable
          rows={filteredLoans}
          columns={[
            { key: 'loan_name', label: 'Loan' },
            { key: 'lender_name', label: 'Lender' },
            { key: 'account_name', label: 'Bank Account', render: (row) => row.account_name || '-' },
            { key: 'principal_amount', label: 'Principal', render: (row) => money(row.principal_amount) },
            { key: 'outstanding_amount', label: 'Outstanding', render: (row) => money(row.outstanding_amount) },
            { key: 'emi_amount', label: 'EMI', render: (row) => row.emi_amount ? money(row.emi_amount) : '-' },
            { key: 'next_installment_due', label: 'Next Due', render: (row) => row.next_installment_due || row.next_due_date || '-' },
            {
              key: 'schedule_state',
              label: 'Schedule',
              render: (row) => (
                <span className={`rounded px-2 py-1 text-xs font-semibold ${loanStatusClass(row)}`}>
                  {Number(row.overdue_installments || 0) > 0 ? 'Overdue' : Number(row.due_installments || 0) > 0 ? 'Due' : 'Healthy'}
                </span>
              )
            },
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => <button className="btn-muted px-2 py-1 text-red-700" onClick={() => removeLoan(row)}>Remove</button>
            }
          ]}
        />

        <DataTable
          rows={filteredInstallments}
          columns={[
            { key: 'due_date', label: 'Due Date' },
            { key: 'loan_name', label: 'Loan' },
            { key: 'lender_name', label: 'Lender' },
            { key: 'account_name', label: 'Account', render: (row) => row.account_name || '-' },
            { key: 'amount', label: 'Amount', render: (row) => money(row.amount) },
            {
              key: 'status',
              label: 'Status',
              render: (row) => <span className={`rounded px-2 py-1 text-xs font-semibold ${installmentClass(row.status)}`}>{row.status}</span>
            },
            { key: 'paid_on', label: 'Paid On', render: (row) => row.paid_on || '-' },
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => row.status === 'paid' ? 'Done' : <button className="btn-muted px-2 py-1" onClick={() => markInstallmentPaid(row)}>Mark Paid</button>
            }
          ]}
        />
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="report-toolbar print-hide">
        <div>
          <h2 className="text-lg font-bold">{sectionMeta[section].title}</h2>
          <p className="text-sm text-slate-600">{sectionMeta[section].description}</p>
          {section !== 'bank-accounts' && (
            <div className="mt-2 text-xs font-semibold uppercase tracking-normal" style={{ color: 'var(--muted)' }}>
              {exportFilters.fromDate || exportFilters.toDate
                ? `Export Window: ${exportWindowLabel(exportFilters)}`
                : 'Export Window: All available records'}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-muted" onClick={exportCurrent}>
            {section === 'bank-accounts'
              ? sectionMeta[section].exportLabel
              : `${sectionMeta[section].exportLabel} for Selected Window`}
          </button>
        </div>
      </div>

      <SectionTabs items={bankingTabs} value={section} onChange={setPage} ariaLabel="Banking sections" />

      {section !== 'bank-accounts' && (
        <div className="glass glass-card space-y-3 p-4">
          <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-6">
            <div><label>From Date</label><input type="date" value={exportFilters.fromDate} onChange={(e) => setExportFilters({ ...exportFilters, fromDate: e.target.value })} /></div>
            <div><label>From Time</label><input type="time" value={exportFilters.fromTime} onChange={(e) => setExportFilters({ ...exportFilters, fromTime: e.target.value })} /></div>
            <div><label>To Date</label><input type="date" value={exportFilters.toDate} onChange={(e) => setExportFilters({ ...exportFilters, toDate: e.target.value })} /></div>
            <div><label>To Time</label><input type="time" value={exportFilters.toTime} onChange={(e) => setExportFilters({ ...exportFilters, toTime: e.target.value })} /></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-muted px-3 py-2" onClick={() => setExportFilters((current) => quickWindow('today', current))}>Today</button>
            <button className="btn-muted px-3 py-2" onClick={() => setExportFilters((current) => quickWindow('month', current))}>This Month</button>
            <button className="btn-muted px-3 py-2" onClick={() => setExportFilters((current) => quickWindow('clear', current))}>Clear Window</button>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Bank Accounts" value={summary.accounts} />
        <MetricCard label="Current Balance" value={money(summary.totalBalance)} tone="money" />
        <MetricCard label="Active Loans" value={summary.activeLoans} />
        <MetricCard label="Installments Due" value={summary.dueInstallments} tone="danger" />
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {section === 'bank-accounts' || section === 'banking'
        ? renderAccounts()
        : section === 'bank-entries'
          ? renderEntries()
          : section === 'bank-statements'
            ? renderStatements()
            : renderLoans()}
    </div>
  );
}
