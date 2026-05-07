import { useEffect, useMemo, useState } from 'react';
import { api, apiForm, downloadApiFile } from '../api/client.js';
import ImportReview from '../components/ImportReview.jsx';
import DataTable from '../components/DataTable.jsx';
import MetricCard from '../components/MetricCard.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import SectionTabs from '../components/SectionTabs.jsx';

const today = new Date().toISOString().slice(0, 10);
const money = (value) => `Rs ${Number(value || 0).toLocaleString('en-IN')}`;

const driverTabs = [
  { id: 'roster', label: 'Roster', hint: 'Master list' },
  { id: 'assignments', label: 'Duty / Vacation', hint: 'Daily control' },
  { id: 'add', label: 'Add Driver', hint: 'Single entry' },
  { id: 'salary', label: 'Salary Ledger', hint: 'Transfers' },
  { id: 'bulk', label: 'Import / Export', hint: 'Excel' },
  { id: 'history', label: 'Activity History', hint: 'Timeline' }
];

const tabMeta = {
  roster: {
    title: 'Driver Roster',
    description: 'Keep the full driver list separate from daily status actions so the page stays readable.'
  },
  assignments: {
    title: 'Duty and Vacation',
    description: 'Assign trucks, send drivers on leave, and bring them back without mixing it into the master data.'
  },
  add: {
    title: 'Add Driver',
    description: 'Use this when a new driver joins or you want to capture core details cleanly.'
  },
  salary: {
    title: 'Driver Salary Ledger',
    description: 'Track salary transfers with amount, date, and narration so payroll stays visible without mixing it into trip allowances.'
  },
  bulk: {
    title: 'Driver Import and Export',
    description: 'Bulk add or update drivers through Excel, with review before anything gets committed.'
  },
  history: {
    title: 'Driver Activity History',
    description: 'See when each driver was active, on duty, or on vacation without crowding the live roster.'
  }
};

function statusClass(status) {
  if (status === 'available') return 'bg-emerald-50 text-emerald-700';
  if (status === 'on_duty') return 'bg-sky-50 text-sky-700';
  if (status === 'vacation') return 'bg-amber-50 text-amber-700';
  return 'bg-slate-100 text-slate-600';
}

export default function Drivers() {
  const [tab, setTab] = useState('roster');
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [history, setHistory] = useState([]);
  const [salaryPayments, setSalaryPayments] = useState([]);
  const [dutyVehicleSelections, setDutyVehicleSelections] = useState({});
  const [salaryFilter, setSalaryFilter] = useState('pending');
  const [driverSearch, setDriverSearch] = useState('');
  const [error, setError] = useState('');
  const [importSummary, setImportSummary] = useState(null);
  const [preview, setPreview] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    license_no: '',
    salary: '',
    current_vehicle_id: ''
  });
  const [salaryForm, setSalaryForm] = useState({
    driver_id: '',
    payment_date: today,
    amount: '',
    reference_no: '',
    narration: '',
    notes: ''
  });

  const counts = useMemo(() => ({
    total: drivers.length,
    available: drivers.filter((driver) => driver.status === 'available').length,
    onDuty: drivers.filter((driver) => driver.status === 'on_duty').length,
    vacation: drivers.filter((driver) => driver.status === 'vacation').length,
    inactive: drivers.filter((driver) => driver.status === 'inactive' || !driver.is_active).length
  }), [drivers]);

  const salarySummary = useMemo(() => ({
    monthlyBudget: drivers.reduce((sum, driver) => sum + Number(driver.salary || 0), 0),
    paidThisMonth: drivers.reduce((sum, driver) => sum + Number(driver.current_month_salary_paid || 0), 0),
    pendingThisMonth: drivers.reduce((sum, driver) => sum + Number(driver.current_month_salary_pending || 0), 0),
    transfersThisMonth: salaryPayments.filter((payment) => payment.payment_date?.slice(0, 7) === today.slice(0, 7)).length
  }), [drivers, salaryPayments]);

  const filteredSalaryDrivers = useMemo(() => {
    const search = driverSearch.trim().toLowerCase();
    return drivers.filter((driver) => {
      const pending = Number(driver.current_month_salary_pending || 0);
      const paid = Number(driver.current_month_salary_paid || 0);
      const matchesFilter = salaryFilter === 'all'
        || (salaryFilter === 'pending' && pending > 0)
        || (salaryFilter === 'paid' && paid > 0)
        || (salaryFilter === 'unpaid' && paid === 0 && Number(driver.salary || 0) > 0);
      const matchesSearch = !search
        || [driver.name, driver.phone, driver.license_no, driver.current_vehicle_no]
          .some((value) => String(value || '').toLowerCase().includes(search));
      return matchesFilter && matchesSearch;
    });
  }, [driverSearch, drivers, salaryFilter]);

  async function load() {
    const [driverRows, vehicleRows, historyRows, salaryPaymentRows] = await Promise.all([
      api('/drivers'),
      api('/vehicles'),
      api('/drivers/history'),
      api('/drivers/salary-payments')
    ]);
    setDrivers(driverRows);
    setVehicles(vehicleRows);
    setHistory(historyRows);
    setSalaryPayments(salaryPaymentRows);
    setDutyVehicleSelections(
      Object.fromEntries(driverRows.map((driver) => [driver.id, driver.current_vehicle_id || '']))
    );
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      await api('/drivers', { method: 'POST', body: form });
      setForm({ name: '', phone: '', license_no: '', salary: '', current_vehicle_id: '' });
      await load();
      setTab('roster');
    } catch (err) {
      setError(err.message);
    }
  }

  async function setStatus(driver, status) {
    setError('');
    const body = { status };
    if (status === 'on_duty') body.current_vehicle_id = dutyVehicleSelections[driver.id] || driver.current_vehicle_id || '';
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
    const vehicleId = dutyVehicleSelections[driver.id] || '';
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

  async function reviewExcel(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setImportSummary(null);
    setPreview(null);
    setPendingFile(file);
    const formData = new FormData();
    formData.append('file', file);
    try {
      setPreview(await apiForm('/drivers/import/preview', formData));
    } catch (err) {
      setError(err.message);
      setPendingFile(null);
    } finally {
      event.target.value = '';
    }
  }

  async function confirmImport() {
    if (!pendingFile) return;
    setImporting(true);
    setError('');
    const formData = new FormData();
    formData.append('file', pendingFile);
    try {
      setImportSummary(await apiForm('/drivers/import', formData));
      setPreview(null);
      setPendingFile(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  async function submitSalaryPayment(event) {
    event.preventDefault();
    setError('');
    try {
      await api('/drivers/salary-payments', { method: 'POST', body: salaryForm });
      setSalaryForm({
        driver_id: salaryForm.driver_id,
        payment_date: today,
        amount: '',
        reference_no: '',
        narration: '',
        notes: ''
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeSalaryPayment(payment) {
    if (!window.confirm(`Remove salary entry for ${payment.driver_name} on ${payment.payment_date}?`)) return;
    setError('');
    try {
      const result = await api(`/drivers/salary-payments/${payment.id}`, { method: 'DELETE' });
      await load();
      if (result?.message) window.alert(result.message);
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeDriver(driver) {
    if (!window.confirm(`Remove driver ${driver.name}?`)) return;
    setError('');
    try {
      const result = await api(`/drivers/${driver.id}`, { method: 'DELETE' });
      await load();
      if (result?.message) window.alert(result.message);
    } catch (err) {
      setError(err.message);
    }
  }

  function openSalaryTab(driver) {
    setSalaryForm((current) => ({
      ...current,
      driver_id: driver.id,
      amount: Number(driver.current_month_salary_pending || 0) > 0 ? driver.current_month_salary_pending : current.amount,
      narration: `Salary transfer for ${driver.name}`
    }));
    setTab('salary');
  }

  function renderRoster() {
    return (
      <DataTable
        rows={drivers}
        columns={[
          { key: 'name', label: 'Driver' },
          { key: 'phone', label: 'Phone', render: (row) => row.phone || '-' },
          { key: 'license_no', label: 'License', render: (row) => row.license_no || '-' },
          { key: 'status', label: 'Status', render: (row) => <span className={`rounded px-2 py-1 text-xs font-semibold ${statusClass(row.status)}`}>{row.status.replace('_', ' ')}</span> },
          { key: 'current_vehicle_no', label: 'Vehicle', render: (row) => row.current_vehicle_no || '-' },
          { key: 'salary', label: 'Salary', render: (row) => money(row.salary) },
          { key: 'total_trips', label: 'Trips' },
          { key: 'active_days', label: 'Active Days' },
          { key: 'vacation_days', label: 'Vacation Days' },
          { key: 'total_profit', label: 'Profit', render: (row) => money(row.total_profit) },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
              <div className="flex flex-wrap gap-2">
                <button className="btn-muted px-2 py-1" onClick={() => openSalaryTab(row)}>Pay Salary</button>
                <button className="btn-muted px-2 py-1 text-red-700" onClick={() => removeDriver(row)}>Remove</button>
              </div>
            )
          }
        ]}
      />
    );
  }

  function renderAssignments() {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {drivers.map((driver) => (
          <section key={driver.id} className="glass glass-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-coal">{driver.name}</h3>
                <p className="text-sm text-white/70">{driver.phone || 'No phone'} / {driver.current_vehicle_no || 'No vehicle assigned'}</p>
                <p className="mt-1 text-xs text-slate-600">Active {driver.active_days || 0} days / Vacation {driver.vacation_days || 0} days</p>
              </div>
              <span className={`rounded px-2 py-1 text-xs font-semibold ${statusClass(driver.status)}`}>{driver.status.replace('_', ' ')}</span>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              <form onSubmit={(event) => assignDuty(event, driver)} className="space-y-2">
                <label>Assign Duty</label>
                <SearchableSelect
                  id={`driver-duty-vehicle-options-${driver.id}`}
                  value={dutyVehicleSelections[driver.id] || ''}
                  options={vehicles}
                  onChange={(vehicleId) => setDutyVehicleSelections((current) => ({ ...current, [driver.id]: vehicleId }))}
                  placeholder="Type vehicle number"
                  getOptionLabel={(vehicle) => vehicle.vehicle_no}
                  getSearchText={(vehicle) => `${vehicle.vehicle_no} ${vehicle.owner_name || ''}`}
                />
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
    );
  }

  function renderAddDriver() {
    return (
      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <form onSubmit={submit} className="glass glass-card space-y-3 p-4">
          <h2 className="text-lg font-bold">Add Driver</h2>
          <div><label>Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div><label>Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><label>License Number</label><input value={form.license_no} onChange={(e) => setForm({ ...form, license_no: e.target.value })} /></div>
          <div><label>Salary</label><input type="number" step="0.01" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} /></div>
          <div>
            <label>Default Vehicle</label>
            <SearchableSelect
              id="driver-default-vehicle-options"
              value={form.current_vehicle_id}
              options={vehicles}
              onChange={(vehicleId) => setForm({ ...form, current_vehicle_id: vehicleId })}
              placeholder="Type vehicle number"
              getOptionLabel={(vehicle) => vehicle.vehicle_no}
              getSearchText={(vehicle) => `${vehicle.vehicle_no} ${vehicle.owner_name || ''}`}
            />
          </div>
          <button className="btn-primary w-full">Save Driver</button>
        </form>

        <DataTable
          rows={drivers.slice(0, 12)}
          columns={[
            { key: 'name', label: 'Recent Drivers' },
            { key: 'status', label: 'Status', render: (row) => <span className={`rounded px-2 py-1 text-xs font-semibold ${statusClass(row.status)}`}>{row.status.replace('_', ' ')}</span> },
            { key: 'current_vehicle_no', label: 'Vehicle', render: (row) => row.current_vehicle_no || '-' },
            { key: 'phone', label: 'Phone', render: (row) => row.phone || '-' }
          ]}
        />
      </div>
    );
  }

  function renderBulk() {
    return (
      <div className="space-y-4">
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

        <ImportReview title="Driver Import Review" preview={preview} keyField="name" onConfirm={confirmImport} busy={importing} />

        <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
          <section className="glass glass-card space-y-3 p-4">
            <h2 className="text-lg font-bold">Excel Import</h2>
            <p className="text-sm text-slate-600">Add or update drivers in bulk. Matching prefers license number, then name plus phone, then an exact unique name. Blank optional cells keep current values on update.</p>
            <button className="btn-muted w-full" onClick={() => downloadApiFile('/drivers/template', 'driver-import-template.xlsx').catch((err) => setError(err.message))}>Download Template</button>
            <button className="btn-muted w-full" onClick={() => downloadApiFile('/drivers/export', 'drivers-export.xlsx').catch((err) => setError(err.message))}>Export Drivers</button>
            <label className="block">
              Review Driver Excel
              <input className="mt-1" type="file" accept=".xlsx" onChange={reviewExcel} />
            </label>
          </section>

          <DataTable
            rows={drivers}
            columns={[
              { key: 'name', label: 'Driver' },
              { key: 'phone', label: 'Phone', render: (row) => row.phone || '-' },
              { key: 'license_no', label: 'License', render: (row) => row.license_no || '-' },
              { key: 'status', label: 'Status', render: (row) => <span className={`rounded px-2 py-1 text-xs font-semibold ${statusClass(row.status)}`}>{row.status.replace('_', ' ')}</span> },
              { key: 'current_vehicle_no', label: 'Vehicle', render: (row) => row.current_vehicle_no || '-' }
            ]}
          />
        </div>
      </div>
    );
  }

  function renderSalary() {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Monthly Salary Budget" value={money(salarySummary.monthlyBudget)} />
          <MetricCard label="Paid This Month" value={money(salarySummary.paidThisMonth)} tone="money" />
          <MetricCard label="Pending This Month" value={money(salarySummary.pendingThisMonth)} tone="danger" />
          <MetricCard label="Transfers This Month" value={salarySummary.transfersThisMonth} />
        </div>

        <section className="glass glass-card space-y-3 p-3 print-hide">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              value={driverSearch}
              onChange={(event) => setDriverSearch(event.target.value)}
              placeholder="Search driver, phone, license, vehicle"
            />
            <div className="flex flex-wrap gap-2">
              {[
                ['pending', 'Pending Salary'],
                ['unpaid', 'Unpaid'],
                ['paid', 'Paid This Month'],
                ['all', 'All Drivers']
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={salaryFilter === value ? 'btn-primary px-3 py-2' : 'btn-muted px-3 py-2'}
                  onClick={() => setSalaryFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="text-xs font-semibold uppercase tracking-normal" style={{ color: 'var(--muted)' }}>
            Showing {filteredSalaryDrivers.length} of {drivers.length} drivers in salary workbench
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
          <form onSubmit={submitSalaryPayment} className="glass glass-card space-y-3 p-4">
            <h2 className="text-lg font-bold">Record Salary Transfer</h2>
            <div>
              <label>Driver</label>
              <SearchableSelect
                id="driver-salary-driver-options"
                value={salaryForm.driver_id}
                options={drivers}
                onChange={(driverId, driver) => setSalaryForm((current) => ({
                  ...current,
                  driver_id: driverId,
                  narration: current.narration || (driver ? `Salary transfer for ${driver.name}` : '')
                }))}
                placeholder="Type driver name"
                required
                getOptionLabel={(driver) => driver.name}
                getSearchText={(driver) => `${driver.name} ${driver.phone || ''} ${driver.license_no || ''}`}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label>Transfer Date</label><input type="date" value={salaryForm.payment_date} onChange={(e) => setSalaryForm({ ...salaryForm, payment_date: e.target.value })} required /></div>
              <div><label>Amount</label><input type="number" step="0.01" value={salaryForm.amount} onChange={(e) => setSalaryForm({ ...salaryForm, amount: e.target.value })} required /></div>
            </div>
            <div><label>Reference No.</label><input value={salaryForm.reference_no} onChange={(e) => setSalaryForm({ ...salaryForm, reference_no: e.target.value })} /></div>
            <div><label>Narration</label><input value={salaryForm.narration} onChange={(e) => setSalaryForm({ ...salaryForm, narration: e.target.value })} required /></div>
            <div><label>Notes</label><input value={salaryForm.notes} onChange={(e) => setSalaryForm({ ...salaryForm, notes: e.target.value })} /></div>
            <button className="btn-primary w-full">Save Salary Entry</button>
          </form>

          <DataTable
            rows={filteredSalaryDrivers}
            columns={[
              { key: 'name', label: 'Driver' },
              { key: 'salary', label: 'Monthly Salary', render: (row) => money(row.salary) },
              { key: 'current_month_salary_paid', label: 'Paid This Month', render: (row) => money(row.current_month_salary_paid) },
              { key: 'current_month_salary_pending', label: 'Pending', render: (row) => money(row.current_month_salary_pending) },
              { key: 'last_salary_payment_date', label: 'Last Transfer', render: (row) => row.last_salary_payment_date || '-' },
              {
                key: 'actions',
                label: 'Actions',
                render: (row) => <button className="btn-muted px-2 py-1" onClick={() => openSalaryTab(row)}>Pay Pending</button>
              }
            ]}
          />
        </div>

        <DataTable
          rows={salaryPayments}
          columns={[
            { key: 'payment_date', label: 'Date' },
            { key: 'driver_name', label: 'Driver' },
            { key: 'amount', label: 'Amount', render: (row) => money(row.amount) },
            { key: 'reference_no', label: 'Reference', render: (row) => row.reference_no || '-' },
            { key: 'narration', label: 'Narration' },
            { key: 'notes', label: 'Notes', render: (row) => row.notes || '-' },
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => <button className="btn-muted px-2 py-1 text-red-700" onClick={() => removeSalaryPayment(row)}>Remove</button>
            }
          ]}
        />
      </div>
    );
  }

  function renderHistory() {
    return (
      <section className="glass glass-card p-4">
        <DataTable
          rows={history}
          columns={[
            { key: 'driver_name', label: 'Driver' },
            { key: 'status', label: 'Status', render: (row) => <span className={`rounded px-2 py-1 text-xs font-semibold ${statusClass(row.status)}`}>{row.status.replace('_', ' ')}</span> },
            { key: 'start_date', label: 'From' },
            { key: 'end_date', label: 'To', render: (row) => row.end_date || 'Current' },
            { key: 'notes', label: 'Notes', render: (row) => row.notes || '-' }
          ]}
        />
      </section>
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

      <SectionTabs items={driverTabs} value={tab} onChange={setTab} ariaLabel="Driver sections" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Total Drivers" value={counts.total} />
        <MetricCard label="Available" value={counts.available} tone="money" />
        <MetricCard label="On Duty" value={counts.onDuty} />
        <MetricCard label="On Vacation" value={counts.vacation} tone="danger" />
        <MetricCard label="Inactive" value={counts.inactive} />
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {tab === 'roster'
        ? renderRoster()
        : tab === 'assignments'
          ? renderAssignments()
          : tab === 'add'
            ? renderAddDriver()
            : tab === 'salary'
              ? renderSalary()
            : tab === 'bulk'
              ? renderBulk()
              : renderHistory()}
    </div>
  );
}
