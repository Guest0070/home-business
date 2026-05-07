import { useEffect, useMemo, useState } from 'react';
import { api, apiForm, downloadApiFile } from '../api/client.js';
import DataTable from '../components/DataTable.jsx';
import ImportReview from '../components/ImportReview.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';

const today = new Date().toISOString().slice(0, 10);
const tripDraftKey = 'coal-tms-trip-draft';
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
  const [showReturnLoad, setShowReturnLoad] = useState(false);
  const [draftNotice, setDraftNotice] = useState('');
  const [draftReady, setDraftReady] = useState(false);
  const [haltTripId, setHaltTripId] = useState('');
  const [haltForm, setHaltForm] = useState({
    halt_type: 'breakdown',
    location: '',
    notes: ''
  });
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
    return_party_name: '',
    return_from_name: '',
    return_to_name: '',
    return_weight_tons: '',
    return_rate_per_ton: '',
    return_notes: '',
    expense: { diesel_litres: '', diesel_cost: '', driver_allowance: '', toll: '', other_expenses: '' }
  });

  const freight = useMemo(() => Number(form.weight_tons || 0) * Number(form.rate_per_ton || 0), [form.weight_tons, form.rate_per_ton]);
  const returnFreight = useMemo(
    () => Number(form.return_weight_tons || 0) * Number(form.return_rate_per_ton || 0),
    [form.return_weight_tons, form.return_rate_per_ton]
  );
  const expenseTotal = useMemo(() => (
    Number(form.expense.diesel_cost || 0) +
    Number(form.expense.driver_allowance || 0) +
    Number(form.expense.toll || 0) +
    Number(form.expense.other_expenses || 0)
  ), [form.expense]);

  async function loadTrips(nextFilter = filter) {
    const params = new URLSearchParams(Object.entries(nextFilter).filter(([, value]) => value));
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

  useEffect(() => {
    try {
      const rawDraft = localStorage.getItem(tripDraftKey);
      if (!rawDraft) {
        setDraftReady(true);
        return;
      }
      const draft = JSON.parse(rawDraft);
      if (draft?.form) {
        setForm((current) => ({ ...current, ...draft.form, trip_date: draft.form.trip_date || current.trip_date }));
        setDriverName(draft.driverName || draft.form.driver_name || '');
        setShowReturnLoad(Boolean(draft.showReturnLoad));
        setDraftNotice('Restored an unsaved trip draft from this browser.');
      }
    } catch {
      localStorage.removeItem(tripDraftKey);
    } finally {
      setDraftReady(true);
    }
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    const hasDraftData = [
      form.lr_number,
      form.delivery_order_id,
      form.vehicle_id,
      form.driver_name,
      form.mine_id,
      form.factory_id,
      form.weight_tons,
      form.rate_per_ton,
      form.return_party_name,
      form.return_to_name,
      form.expense.diesel_litres,
      form.expense.diesel_cost,
      form.expense.driver_allowance,
      form.expense.toll,
      form.expense.other_expenses
    ].some((value) => String(value || '').trim() !== '');
    if (!hasDraftData) {
      localStorage.removeItem(tripDraftKey);
      return;
    }
    localStorage.setItem(tripDraftKey, JSON.stringify({
      form,
      driverName,
      showReturnLoad,
      savedAt: new Date().toISOString()
    }));
  }, [draftReady, driverName, form, showReturnLoad]);

  const selectableVehicles = masters.vehicles.filter((vehicle) => vehicle.is_active && vehicle.status !== 'repair');
  const selectableDrivers = masters.drivers.filter((driver) => driver.status !== 'inactive');
  const openDeliveryOrders = masters.deliveryOrders.filter((order) => order.status !== 'cancelled');
  const selectedDeliveryOrder = useMemo(
    () => openDeliveryOrders.find((order) => order.id === form.delivery_order_id) || null,
    [form.delivery_order_id, openDeliveryOrders]
  );
  const selectedVehicle = useMemo(
    () => selectableVehicles.find((vehicle) => vehicle.id === form.vehicle_id) || null,
    [form.vehicle_id, selectableVehicles]
  );
  const latestTripDefaults = useMemo(() => {
    if (!trips.length) return null;
    if (form.vehicle_id) {
      return trips.find((trip) => trip.vehicle_id === form.vehicle_id) || trips[0];
    }
    return trips[0];
  }, [form.vehicle_id, trips]);
  const doWeightExceeded = selectedDeliveryOrder
    && Number(form.weight_tons || 0) > Number(selectedDeliveryOrder.pending_tons || 0);

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
      weight_tons: current.weight_tons || selectedDeliveryOrder.pending_tons || '',
      return_from_name: current.return_from_name || selectedDeliveryOrder.factory_name || ''
    }));
  }, [selectedDeliveryOrder]);

  function updateExpense(key, value) {
    setForm((current) => ({ ...current, expense: { ...current.expense, [key]: value } }));
  }

  function updateReturnLoad(key, value) {
    setShowReturnLoad(true);
    setForm((current) => ({ ...current, [key]: value }));
  }

  function applyLatestTripDefaults() {
    if (!latestTripDefaults) return;
    setShowReturnLoad(Boolean(
      latestTripDefaults.return_party_name
      || latestTripDefaults.return_from_name
      || latestTripDefaults.return_to_name
      || latestTripDefaults.return_weight_tons
      || latestTripDefaults.return_rate_per_ton
      || latestTripDefaults.return_notes
    ));
    setForm((current) => ({
      ...current,
      vehicle_id: current.vehicle_id || latestTripDefaults.vehicle_id || '',
      driver_id: current.driver_id || latestTripDefaults.driver_id || '',
      driver_name: current.driver_name || latestTripDefaults.driver_name || '',
      mine_id: current.delivery_order_id ? current.mine_id : (current.mine_id || latestTripDefaults.mine_id || ''),
      factory_id: current.delivery_order_id ? current.factory_id : (current.factory_id || latestTripDefaults.factory_id || ''),
      weight_tons: current.weight_tons || latestTripDefaults.weight_tons || '',
      rate_per_ton: current.rate_per_ton || latestTripDefaults.rate_per_ton || '',
      return_party_name: current.return_party_name || latestTripDefaults.return_party_name || '',
      return_from_name: current.return_from_name || latestTripDefaults.return_from_name || latestTripDefaults.factory_name || '',
      return_to_name: current.return_to_name || latestTripDefaults.return_to_name || '',
      return_weight_tons: current.return_weight_tons || latestTripDefaults.return_weight_tons || '',
      return_rate_per_ton: current.return_rate_per_ton || latestTripDefaults.return_rate_per_ton || '',
      return_notes: current.return_notes || latestTripDefaults.return_notes || '',
      expense: {
        diesel_litres: current.expense.diesel_litres || latestTripDefaults.diesel_litres || '',
        diesel_cost: current.expense.diesel_cost || latestTripDefaults.diesel_cost || '',
        driver_allowance: current.expense.driver_allowance || latestTripDefaults.driver_allowance || '',
        toll: current.expense.toll || latestTripDefaults.toll || '',
        other_expenses: current.expense.other_expenses || latestTripDefaults.other_expenses || ''
      }
    }));
    if (!driverName && latestTripDefaults.driver_name) {
      setDriverName(latestTripDefaults.driver_name);
    }
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
      setPreview(await apiForm('/trips/import/preview', formData));
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
      setImportSummary(await apiForm('/trips/import', formData));
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
    if (selectedVehicle?.dispatch_compliance_status === 'blocked') {
      setError(`${selectedVehicle.vehicle_no} is blocked for dispatch: ${selectedVehicle.dispatch_compliance_reason}`);
      return;
    }
    const hasReturnLoad = showReturnLoad && [
      form.return_party_name,
      form.return_from_name,
      form.return_to_name,
      form.return_weight_tons,
      form.return_rate_per_ton,
      form.return_notes
    ].some((value) => String(value || '').trim() !== '');
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
          return_party_name: hasReturnLoad ? (form.return_party_name || undefined) : undefined,
          return_from_name: hasReturnLoad ? (form.return_from_name || undefined) : undefined,
          return_to_name: hasReturnLoad ? (form.return_to_name || undefined) : undefined,
          return_weight_tons: hasReturnLoad ? (form.return_weight_tons || undefined) : undefined,
          return_rate_per_ton: hasReturnLoad ? (form.return_rate_per_ton || undefined) : undefined,
          return_notes: hasReturnLoad ? (form.return_notes || undefined) : undefined,
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
        return_party_name: '',
        return_from_name: '',
        return_to_name: '',
        return_weight_tons: '',
        return_rate_per_ton: '',
        return_notes: '',
        expense: { diesel_litres: '', diesel_cost: '', driver_allowance: '', toll: '', other_expenses: '' }
      });
      setShowReturnLoad(false);
      setDriverName('');
      localStorage.removeItem(tripDraftKey);
      setDraftNotice('');
      await Promise.all([loadTrips(), loadMasters()]);
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitHalt(event) {
    event.preventDefault();
    if (!haltTripId) {
      setError('Select a trip before reporting a halt');
      return;
    }
    setError('');
    try {
      await api(`/trips/${haltTripId}/halts`, { method: 'POST', body: haltForm });
      setHaltForm({ halt_type: 'breakdown', location: '', notes: '' });
      setHaltTripId('');
      await loadTrips();
    } catch (err) {
      setError(err.message);
    }
  }

  function vehicleTrafficLabel(vehicle) {
    const status = vehicle.dispatch_compliance_status || 'clear';
    if (status === 'blocked') return `RED ${vehicle.vehicle_no}`;
    if (status === 'warning') return `AMBER ${vehicle.vehicle_no}`;
    return `GREEN ${vehicle.vehicle_no}`;
  }

  async function applyQuickDateFilter(mode) {
    const now = new Date();
    if (mode === 'today') {
      const value = now.toISOString().slice(0, 10);
      const nextFilter = { ...filter, from: value, to: value };
      setFilter(nextFilter);
      await loadTrips(nextFilter);
      return;
    }
    if (mode === 'last7') {
      const from = new Date(now.getTime());
      from.setDate(now.getDate() - 6);
      const nextFilter = {
        ...filter,
        from: from.toISOString().slice(0, 10),
        to: now.toISOString().slice(0, 10)
      };
      setFilter(nextFilter);
      await loadTrips(nextFilter);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[430px_1fr]">
      <div className="space-y-4">
        <form onSubmit={submit} className="glass glass-card p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">New Trip</h2>
            <button
              type="button"
              className="btn-muted px-3 py-2"
              onClick={applyLatestTripDefaults}
              disabled={!latestTripDefaults}
              title={latestTripDefaults ? 'Pull route, return load, and expense defaults from the latest matching trip' : 'No recent trip available yet'}
            >
              Use Last Trip Defaults
            </button>
          </div>
          <p className="mb-4 text-sm text-slate-600">Only date, truck, and driver are mandatory. Everything else can be added when the paperwork catches up.</p>
          {draftNotice && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              <span>{draftNotice}</span>
              <button
                type="button"
                className="btn-muted px-2 py-1"
                onClick={() => {
                  localStorage.removeItem(tripDraftKey);
                  setDraftNotice('');
                }}
              >
                Clear Draft
              </button>
            </div>
          )}
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
                {doWeightExceeded && (
                  <div className="trip-do-summary-row text-red-700">
                    <span>Warning</span>
                    <strong>This trip weight is above the pending D.O. tons.</strong>
                  </div>
                )}
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
                getOptionLabel={vehicleTrafficLabel}
                getSearchText={(vehicle) => `${vehicleTrafficLabel(vehicle)} ${vehicle.ownership} ${vehicle.status.replace('_', ' ')} ${vehicle.dispatch_compliance_reason || ''}`}
              />
              {selectedVehicle && (
                <div className={`mt-1 text-xs font-semibold ${selectedVehicle.dispatch_compliance_status === 'blocked' ? 'text-red-700' : selectedVehicle.dispatch_compliance_status === 'warning' ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {selectedVehicle.dispatch_compliance_status === 'blocked'
                    ? selectedVehicle.dispatch_compliance_reason
                    : selectedVehicle.dispatch_compliance_status === 'warning'
                      ? selectedVehicle.dispatch_compliance_reason
                      : 'Compliance clear for dispatch'}
                </div>
              )}
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
            <div><label>Outward Freight</label><input value={money(freight)} readOnly /></div>
            <div className="sm:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="mb-0">Return Load</label>
                <button type="button" className="btn-muted px-3 py-2" onClick={() => setShowReturnLoad((current) => !current)}>
                  {showReturnLoad ? 'Hide Return Load' : 'Add Return Load'}
                </button>
              </div>
            </div>
            {showReturnLoad && (
              <>
                <div><label>Return Party</label><input value={form.return_party_name} onChange={(e) => updateReturnLoad('return_party_name', e.target.value)} placeholder="Optional" /></div>
                <div><label>Return From</label><input value={form.return_from_name} onChange={(e) => updateReturnLoad('return_from_name', e.target.value)} placeholder="Defaults from factory" /></div>
                <div><label>Return To</label><input value={form.return_to_name} onChange={(e) => updateReturnLoad('return_to_name', e.target.value)} placeholder="Where the truck goes next" /></div>
                <div><label>Return Weight Tons</label><input type="number" step="0.001" value={form.return_weight_tons} onChange={(e) => updateReturnLoad('return_weight_tons', e.target.value)} placeholder="Optional" /></div>
                <div><label>Return Rate Per Ton</label><input type="number" step="0.01" value={form.return_rate_per_ton} onChange={(e) => updateReturnLoad('return_rate_per_ton', e.target.value)} placeholder="Optional" /></div>
                <div><label>Return Freight</label><input value={money(returnFreight)} readOnly /></div>
                <div className="sm:col-span-2"><label>Return Notes</label><input value={form.return_notes} onChange={(e) => updateReturnLoad('return_notes', e.target.value)} placeholder="Optional" /></div>
              </>
            )}
            <div><label>Diesel Litres</label><input type="number" step="0.01" value={form.expense.diesel_litres} onChange={(e) => updateExpense('diesel_litres', e.target.value)} /></div>
            <div><label>Diesel Cost</label><input type="number" step="0.01" value={form.expense.diesel_cost} onChange={(e) => updateExpense('diesel_cost', e.target.value)} /></div>
            <div><label>Driver Allowance</label><input type="number" step="0.01" value={form.expense.driver_allowance} onChange={(e) => updateExpense('driver_allowance', e.target.value)} /></div>
            <div><label>Toll</label><input type="number" step="0.01" value={form.expense.toll} onChange={(e) => updateExpense('toll', e.target.value)} /></div>
            <div><label>Other Expenses</label><input type="number" step="0.01" value={form.expense.other_expenses} onChange={(e) => updateExpense('other_expenses', e.target.value)} /></div>
            <div><label>Total Revenue</label><input value={money(freight + returnFreight)} readOnly /></div>
            <div><label>Estimated Profit</label><input value={money((freight + returnFreight) - expenseTotal)} readOnly /></div>
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
          <button className="btn-muted w-full" onClick={() => downloadApiFile('/trips/template', 'trip-import-template.xlsx').catch((err) => setError(err.message))}>Download Template</button>
          <button className="btn-muted w-full" onClick={() => downloadApiFile('/trips/export', 'trips-export.xlsx').catch((err) => setError(err.message))}>Export Trips</button>
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

        <form onSubmit={submitHalt} className="glass glass-card space-y-3 p-4 md:hidden">
          <h2 className="text-lg font-bold">Report Halt</h2>
          <p className="text-sm text-slate-600">Use this on mobile when a truck is stopped by breakdown, RTO, loading, or unloading delay.</p>
          <SearchableSelect
            id="halt-trip-options"
            value={haltTripId}
            options={trips}
            onChange={(tripId) => setHaltTripId(tripId)}
            placeholder="Type LR, truck, or driver"
            required
            getOptionLabel={(trip) => `${trip.lr_number || '-'} / ${trip.vehicle_no}`}
            getSearchText={(trip) => `${trip.lr_number || ''} ${trip.vehicle_no || ''} ${trip.driver_name || ''} ${trip.factory_name || ''}`}
          />
          <select value={haltForm.halt_type} onChange={(event) => setHaltForm({ ...haltForm, halt_type: event.target.value })}>
            <option value="breakdown">Breakdown</option>
            <option value="rto_stop">RTO Stop</option>
            <option value="loading_delay">Loading Delay</option>
            <option value="unloading_delay">Unloading Delay</option>
            <option value="other">Other</option>
          </select>
          <input value={haltForm.location} onChange={(event) => setHaltForm({ ...haltForm, location: event.target.value })} placeholder="Location" />
          <textarea rows="3" value={haltForm.notes} onChange={(event) => setHaltForm({ ...haltForm, notes: event.target.value })} placeholder="What happened?" />
          <button className="btn-primary w-full">Save Halt Log</button>
        </form>
      </div>

      <div className="space-y-3">
        <div className="glass glass-card grid gap-3 p-3 sm:grid-cols-4">
          <input placeholder="Driver filter" value={filter.driver} onChange={(e) => setFilter({ ...filter, driver: e.target.value })} />
          <input type="date" value={filter.from} onChange={(e) => setFilter({ ...filter, from: e.target.value })} />
          <input type="date" value={filter.to} onChange={(e) => setFilter({ ...filter, to: e.target.value })} />
          <button className="btn-muted" onClick={loadTrips}>Apply Filters</button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-muted px-3 py-2" onClick={() => applyQuickDateFilter('today')}>Today</button>
          <button className="btn-muted px-3 py-2" onClick={() => applyQuickDateFilter('last7')}>Last 7 Days</button>
          <button
            className="btn-muted px-3 py-2"
            onClick={() => {
              const nextFilter = { driver: '', from: '', to: '' };
              setFilter(nextFilter);
              loadTrips(nextFilter).catch(console.error);
            }}
          >
            Clear Filters
          </button>
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
            {
              key: 'return_load',
              label: 'Return Load',
              render: (row) => row.return_party_name || row.return_to_name || row.return_weight_tons
                ? `${row.return_party_name || 'Return'} / ${row.return_to_name || row.return_from_name || '-'} / ${row.return_weight_tons ? tons(row.return_weight_tons) : '-'}`
                : '-'
            },
            { key: 'return_freight', label: 'Return Freight', render: (row) => money(row.return_freight) },
            { key: 'freight', label: 'Revenue', render: (row) => money(row.freight) },
            { key: 'total_expense', label: 'Expense', render: (row) => money(row.total_expense) },
            { key: 'profit', label: 'Profit', render: (row) => money(row.profit) },
            { key: 'mileage', label: 'Mileage' },
            { key: 'abnormal_diesel', label: 'Diesel', render: (row) => row.abnormal_diesel ? 'Abnormal' : 'OK' }
            ,
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => (
                <button
                  className="btn-muted px-2 py-1"
                  onClick={() => {
                    setHaltTripId(row.id);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  Report Halt
                </button>
              )
            }
          ]}
        />
      </div>
    </div>
  );
}
