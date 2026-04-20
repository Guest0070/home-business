import { useEffect, useMemo, useState } from 'react';
import { api, getApiBaseUrl, getToken } from '../api/client.js';
import DataTable from '../components/DataTable.jsx';
import ImportReview from '../components/ImportReview.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';

const today = new Date().toISOString().slice(0, 10);
const money = (value) => `Rs ${Number(value || 0).toLocaleString('en-IN')}`;
const tons = (value) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 });

export default function Trips() {
  const [masters, setMasters] = useState({ vehicles: [], mines: [], factories: [], drivers: [], deliveryOrders: [] });
  const [trips, setTrips] = useState([]);
  const [distance, setDistance] = useState('');
  const [error, setError] = useState('');
  const [importSummary, setImportSummary] = useState(null);
  const [preview, setPreview] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [filter, setFilter] = useState({ driver: '', from: '', to: '' });
  const [driverName, setDriverName] = useState('');
  const [form, setForm] = useState({
    trip_date: today,
    lr_number: '',
    delivery_order_id: '',
    vehicle_id: '',
    driver_id: '',
    driver_name: '',
    mine_id: '',
    factory_id: '',
    weight_tons: '',
    rate_per_ton: '',
    expense: { diesel_litres: '', diesel_cost: '', driver_allowance: '', toll: '', other_expenses: '' }
  });

  const freight = useMemo(() => Number(form.weight_tons || 0) * Number(form.rate_per_ton || 0), [form.weight_tons, form.rate_per_ton]);
  const expenseTotal = useMemo(() => (
    Number(form.expense.diesel_cost || 0) +
    Number(form.expense.driver_allowance || 0) +
    Number(form.expense.toll || 0) +
    Number(form.expense.other_expenses || 0)
  ), [form.expense]);

  async function loadTrips() {
    const params = new URLSearchParams(Object.entries(filter).filter(([, value]) => value));
    setTrips(await api(`/trips?${params}`));
  }

  async function loadMasters() {
    const [vehicles, mines, factories, drivers, deliveryOrders] = await Promise.all([
      api('/vehicles'),
      api('/mines'),
      api('/factories'),
      api('/drivers?activeOnly=true'),
      api('/delivery-orders')
    ]);
    setMasters({ vehicles, mines, factories, drivers, deliveryOrders });
  }

  useEffect(() => {
    loadMasters().catch(console.error);
    loadTrips().catch(console.error);
  }, []);

  const selectableVehicles = masters.vehicles.filter((vehicle) => vehicle.is_active && vehicle.status !== 'repair');
  const selectableDrivers = masters.drivers.filter((driver) => driver.status !== 'inactive');
  const openDeliveryOrders = masters.deliveryOrders.filter((order) => order.status !== 'cancelled');
  const selectedDeliveryOrder = useMemo(
    () => openDeliveryOrders.find((order) => order.id === form.delivery_order_id) || null,
    [form.delivery_order_id, openDeliveryOrders]
  );

  useEffect(() => {
    if (!form.mine_id || !form.factory_id) {
      setDistance('');
      return;
    }
    api(`/routes/distance?mineId=${form.mine_id}&factoryId=${form.factory_id}`)
      .then((row) => setDistance(row.distance_km))
      .catch(() => setDistance('No route'));
  }, [form.mine_id, form.factory_id]);

  useEffect(() => {
    if (!selectedDeliveryOrder) return;
    setForm((current) => ({
      ...current,
      mine_id: selectedDeliveryOrder.mine_id || '',
      factory_id: selectedDeliveryOrder.factory_id || '',
      rate_per_ton: current.rate_per_ton || selectedDeliveryOrder.rate_per_ton || '',
      weight_tons: current.weight_tons || selectedDeliveryOrder.pending_tons || ''
    }));
  }, [selectedDeliveryOrder]);

  function updateExpense(key, value) {
    setForm((current) => ({ ...current, expense: { ...current.expense, [key]: value } }));
  }

  function chooseDriverByName(name) {
    const normalized = name.trim().toLowerCase();
    const driver = selectableDrivers.find((row) => row.name.trim().toLowerCase() === normalized);
    setDriverName(name);
    setForm((current) => ({
      ...current,
      driver_id: driver?.id || '',
      driver_name: name,
      vehicle_id: driver?.current_vehicle_id || current.vehicle_id
    }));
  }

  async function downloadFile(path, filename) {
    setError('');
    try {
      const response = await fetch(`${getApiBaseUrl()}${path}`, {
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
      const response = await fetch(`${getApiBaseUrl()}/trips/import/preview`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || 'Preview failed');
      setPreview(data);
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
      const response = await fetch(`${getApiBaseUrl()}/trips/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || 'Import failed');
      setImportSummary(data);
      setPreview(null);
      setPendingFile(null);
      await Promise.all([loadTrips(), loadMasters()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!form.vehicle_id) {
      setError('Select a valid vehicle number from the search list');
      return;
    }
    if (!form.driver_name.trim()) {
      setError('Enter a driver name');
      return;
    }
    try {
      await api('/trips', {
        method: 'POST',
        body: {
          ...form,
          driver_name: form.driver_name.trim(),
          lr_number: form.lr_number || undefined,
          mine_id: form.mine_id || undefined,
          factory_id: form.factory_id || undefined,
          weight_tons: form.weight_tons || undefined,
          rate_per_ton: form.rate_per_ton || undefined,
          delivery_order_id: form.delivery_order_id || undefined
        }
      });
      setForm({
        trip_date: today,
        lr_number: '',
        delivery_order_id: '',
        vehicle_id: '',
        driver_id: '',
        driver_name: '',
        mine_id: '',
        factory_id: '',
        weight_tons: '',
        rate_per_ton: '',
        expense: { diesel_litres: '', diesel_cost: '', driver_allowance: '', toll: '', other_expenses: '' }
      });
      setDriverName('');
      await Promise.all([loadTrips(), loadMasters()]);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[430px_1fr]">
      <div className="space-y-4">
        <form onSubmit={submit} className="glass glass-card p-4">
          <h2 className="mb-2 text-lg font-bold">New Trip</h2>
          <p className="mb-4 text-sm text-slate-600">Only date, truck, and driver are mandatory. Everything else can be added when the paperwork catches up.</p>
          {error && <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label>Date</label><input type="date" value={form.trip_date} onChange={(e) => setForm({ ...form, trip_date: e.target.value })} required /></div>
            <div>
              <label>LR Number</label>
              <input value={form.lr_number} onChange={(e) => setForm({ ...form, lr_number: e.target.value })} placeholder="Leave blank to auto assign" />
            </div>
            <div className="sm:col-span-2">
              <label>Delivery Order</label>
              <SearchableSelect
                id="trip-delivery-order-options"
                value={form.delivery_order_id}
                options={openDeliveryOrders}
                onChange={(deliveryOrderId) => setForm({ ...form, delivery_order_id: deliveryOrderId })}
                placeholder="Type D.O. number"
                getOptionLabel={(order) => order.do_number}
                getSearchText={(order) => `${order.do_number} ${order.factory_name || ''} ${order.mine_name || ''}`}
              />
            </div>
            {selectedDeliveryOrder && (
              <div className="trip-do-summary sm:col-span-2">
                <div className="trip-do-summary-row">
                  <span>D.O.</span>
                  <strong>{selectedDeliveryOrder.do_number}</strong>
                </div>
                <div className="trip-do-summary-row">
                  <span>Route</span>
                  <strong>{selectedDeliveryOrder.mine_name || 'No mine'} to {selectedDeliveryOrder.factory_name || 'No factory'}</strong>
                </div>
                <div className="trip-do-summary-row">
                  <span>Progress</span>
                  <strong>{tons(selectedDeliveryOrder.delivered_tons)} delivered / {tons(selectedDeliveryOrder.pending_tons)} pending</strong>
                </div>
              </div>
            )}
            <div>
              <label>Vehicle</label>
              <SearchableSelect
                id="trip-vehicle-options"
                value={form.vehicle_id}
                options={selectableVehicles}
                onChange={(vehicleId) => setForm({ ...form, vehicle_id: vehicleId })}
                placeholder="Type vehicle number"
                required
                getOptionLabel={(vehicle) => vehicle.vehicle_no}
                getSearchText={(vehicle) => `${vehicle.vehicle_no} ${vehicle.ownership} ${vehicle.status.replace('_', ' ')}`}
              />
            </div>
            <div>
              <label>Driver</label>
              <SearchableSelect
                value={form.driver_id}
                options={selectableDrivers}
                onChange={(driverId, driver) => {
                  setForm((current) => ({
                    ...current,
                    driver_id: driverId || '',
                    driver_name: driver?.name || driverName,
                    vehicle_id: driver?.current_vehicle_id || current.vehicle_id
                  }));
                }}
                inputValue={driverName}
                onInputValueChange={chooseDriverByName}
                allowCustom
                placeholder="Type driver name"
                required
                getOptionLabel={(driver) => driver.name}
                getSearchText={(driver) => `${driver.name} ${driver.phone || ''} ${driver.status.replace('_', ' ')}`}
              />
              <div className="mt-1 text-xs text-slate-600">If the name is new, the trip will create that driver automatically.</div>
            </div>
            <div>
              <label>Mine</label>
              <SearchableSelect
                id="trip-mine-options"
                value={form.mine_id}
                options={masters.mines}
                onChange={(mineId) => setForm({ ...form, mine_id: mineId })}
                placeholder={selectedDeliveryOrder ? 'Linked from delivery order' : 'Type mine name'}
                getOptionLabel={(mine) => mine.name}
                getSearchText={(mine) => mine.name}
                disabled={Boolean(selectedDeliveryOrder)}
              />
            </div>
            <div>
              <label>Factory</label>
              <SearchableSelect
                id="trip-factory-options"
                value={form.factory_id}
                options={masters.factories}
                onChange={(factoryId) => setForm({ ...form, factory_id: factoryId })}
                placeholder={selectedDeliveryOrder ? 'Linked from delivery order' : 'Type factory name'}
                getOptionLabel={(factory) => factory.name}
                getSearchText={(factory) => factory.name}
                disabled={Boolean(selectedDeliveryOrder)}
              />
            </div>
            <div><label>Distance</label><input value={distance} readOnly placeholder="Auto from route when available" /></div>
            <div><label>Weight Tons</label><input type="number" step="0.001" value={form.weight_tons} onChange={(e) => setForm({ ...form, weight_tons: e.target.value })} placeholder="Optional" /></div>
            <div><label>Rate Per Ton</label><input type="number" step="0.01" value={form.rate_per_ton} onChange={(e) => setForm({ ...form, rate_per_ton: e.target.value })} placeholder="Optional" /></div>
            <div><label>Freight</label><input value={money(freight)} readOnly /></div>
            <div><label>Diesel Litres</label><input type="number" step="0.01" value={form.expense.diesel_litres} onChange={(e) => updateExpense('diesel_litres', e.target.value)} /></div>
            <div><label>Diesel Cost</label><input type="number" step="0.01" value={form.expense.diesel_cost} onChange={(e) => updateExpense('diesel_cost', e.target.value)} /></div>
            <div><label>Driver Allowance</label><input type="number" step="0.01" value={form.expense.driver_allowance} onChange={(e) => updateExpense('driver_allowance', e.target.value)} /></div>
            <div><label>Toll</label><input type="number" step="0.01" value={form.expense.toll} onChange={(e) => updateExpense('toll', e.target.value)} /></div>
            <div><label>Other Expenses</label><input type="number" step="0.01" value={form.expense.other_expenses} onChange={(e) => updateExpense('other_expenses', e.target.value)} /></div>
            <div><label>Estimated Profit</label><input value={money(freight - expenseTotal)} readOnly /></div>
          </div>
          <button className="btn-primary mt-4 w-full">Save Trip</button>
        </form>

        <section className="glass glass-card space-y-3 p-4">
          <h2 className="text-lg font-bold">Excel Import</h2>
          <p className="text-sm text-slate-600">Bulk add trips or export existing ones, fill missing details later, and re-import with the LR number to update the same trip.</p>
          {importSummary && (
            <div className="rounded border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
              <div>Imported {importSummary.totalRows} rows. Created {importSummary.created}, updated {importSummary.updated}, failed {importSummary.failed}.</div>
              {importSummary.errors?.length > 0 && (
                <div className="mt-2 space-y-1 text-red-700">
                  {importSummary.errors.slice(0, 5).map((item) => (
                    <div key={`${item.row}-${item.lr_number || item.vehicle_no || 'trip'}`}>Row {item.row}: {item.errors.join(', ')}</div>
                  ))}
                </div>
              )}
            </div>
          )}
          <button className="btn-muted w-full" onClick={() => downloadFile('/trips/template', 'trip-import-template.xlsx')}>Download Template</button>
          <button className="btn-muted w-full" onClick={() => downloadFile('/trips/export', 'trips-export.xlsx')}>Export Trips</button>
          <label className="block">
            Review Trip Excel
            <input className="mt-1" type="file" accept=".xlsx" onChange={reviewExcel} />
          </label>
        </section>

        <ImportReview
          title="Trip Import Review"
          preview={preview}
          keyField="lr_number"
          onConfirm={confirmImport}
          busy={importing}
        />
      </div>

      <div className="space-y-3">
        <div className="glass glass-card grid gap-3 p-3 sm:grid-cols-4">
          <input placeholder="Driver filter" value={filter.driver} onChange={(e) => setFilter({ ...filter, driver: e.target.value })} />
          <input type="date" value={filter.from} onChange={(e) => setFilter({ ...filter, from: e.target.value })} />
          <input type="date" value={filter.to} onChange={(e) => setFilter({ ...filter, to: e.target.value })} />
          <button className="btn-muted" onClick={loadTrips}>Apply Filters</button>
        </div>
        <DataTable
          rows={trips}
          columns={[
            { key: 'trip_date', label: 'Date' },
            { key: 'do_number', label: 'D.O.' },
            { key: 'lr_number', label: 'LR' },
            { key: 'vehicle_no', label: 'Truck' },
            { key: 'driver_name', label: 'Driver' },
            { key: 'factory_name', label: 'Party' },
            { key: 'weight_tons', label: 'Weight', render: (row) => row.weight_tons ? tons(row.weight_tons) : '-' },
            { key: 'freight', label: 'Freight', render: (row) => money(row.freight) },
            { key: 'total_expense', label: 'Expense', render: (row) => money(row.total_expense) },
            { key: 'profit', label: 'Profit', render: (row) => money(row.profit) },
            { key: 'mileage', label: 'Mileage' },
            { key: 'abnormal_diesel', label: 'Diesel', render: (row) => row.abnormal_diesel ? 'Abnormal' : 'OK' }
          ]}
        />
      </div>
    </div>
  );
}
