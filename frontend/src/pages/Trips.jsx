import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import DataTable from '../components/DataTable.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';

const today = new Date().toISOString().slice(0, 10);
const money = (value) => `Rs ${Number(value || 0).toLocaleString('en-IN')}`;

export default function Trips() {
  const [masters, setMasters] = useState({ vehicles: [], mines: [], factories: [], drivers: [] });
  const [trips, setTrips] = useState([]);
  const [distance, setDistance] = useState('');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState({ driver: '', from: '', to: '' });
  const [form, setForm] = useState({
    trip_date: today,
    lr_number: '',
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
    const [vehicles, mines, factories, drivers] = await Promise.all([
      api('/vehicles'),
      api('/mines'),
      api('/factories'),
      api('/drivers?activeOnly=true')
    ]);
    setMasters({ vehicles, mines, factories, drivers });
  }

  useEffect(() => {
    loadMasters().catch(console.error);
    loadTrips().catch(console.error);
  }, []);

  useEffect(() => {
    if (!form.mine_id || !form.factory_id) {
      setDistance('');
      return;
    }
    api(`/routes/distance?mineId=${form.mine_id}&factoryId=${form.factory_id}`)
      .then((row) => setDistance(row.distance_km))
      .catch(() => setDistance('No route'));
  }, [form.mine_id, form.factory_id]);

  function updateExpense(key, value) {
    setForm({ ...form, expense: { ...form.expense, [key]: value } });
  }

  const selectableVehicles = masters.vehicles.filter((vehicle) => vehicle.is_active && vehicle.status !== 'repair');
  const selectableDrivers = masters.drivers.filter((driver) => driver.status === 'available' || driver.status === 'on_duty');

  function chooseDriver(driverId) {
    const driver = masters.drivers.find((row) => row.id === driverId);
    setForm({
      ...form,
      driver_id: driverId,
      driver_name: driver?.name || '',
      vehicle_id: driver?.current_vehicle_id || form.vehicle_id
    });
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!form.vehicle_id) {
      setError('Select a valid vehicle number from the search list');
      return;
    }
    if (!form.driver_id) {
      setError('Select a valid driver from the search list');
      return;
    }
    if (!form.mine_id || !form.factory_id) {
      setError('Select valid mine and factory names from the search lists');
      return;
    }
    try {
      await api('/trips', { method: 'POST', body: form });
      setForm({
        ...form,
        lr_number: '',
        driver_id: '',
        driver_name: '',
        vehicle_id: '',
        weight_tons: '',
        rate_per_ton: '',
        expense: { diesel_litres: '', diesel_cost: '', driver_allowance: '', toll: '', other_expenses: '' }
      });
      await Promise.all([loadTrips(), loadMasters()]);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <form onSubmit={submit} className="glass glass-card p-4">
        <h2 className="mb-4 text-lg font-bold">New Trip</h2>
        {error && <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label>Date</label><input type="date" value={form.trip_date} onChange={(e) => setForm({ ...form, trip_date: e.target.value })} required /></div>
          <div><label>LR Number</label><input value={form.lr_number} onChange={(e) => setForm({ ...form, lr_number: e.target.value })} required /></div>
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
              id="trip-driver-options"
              value={form.driver_id}
              options={selectableDrivers}
              onChange={chooseDriver}
              placeholder="Type driver name"
              required
              getOptionLabel={(driver) => driver.name}
              getSearchText={(driver) => `${driver.name} ${driver.status.replace('_', ' ')} ${driver.phone || ''}`}
            />
          </div>
          <div>
            <label>Mine</label>
            <SearchableSelect
              id="trip-mine-options"
              value={form.mine_id}
              options={masters.mines}
              onChange={(mineId) => setForm({ ...form, mine_id: mineId })}
              placeholder="Type mine name"
              required
              getOptionLabel={(mine) => mine.name}
            />
          </div>
          <div>
            <label>Factory</label>
            <SearchableSelect
              id="trip-factory-options"
              value={form.factory_id}
              options={masters.factories}
              onChange={(factoryId) => setForm({ ...form, factory_id: factoryId })}
              placeholder="Type factory name"
              required
              getOptionLabel={(factory) => factory.name}
            />
          </div>
          <div><label>Distance</label><input value={distance} readOnly /></div>
          <div><label>Weight Tons</label><input type="number" step="0.001" value={form.weight_tons} onChange={(e) => setForm({ ...form, weight_tons: e.target.value })} required /></div>
          <div><label>Rate Per Ton</label><input type="number" step="0.01" value={form.rate_per_ton} onChange={(e) => setForm({ ...form, rate_per_ton: e.target.value })} required /></div>
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
            { key: 'lr_number', label: 'LR' },
            { key: 'vehicle_no', label: 'Truck' },
            { key: 'driver_name', label: 'Driver' },
            { key: 'factory_name', label: 'Party' },
            { key: 'freight', label: 'Freight', render: (r) => money(r.freight) },
            { key: 'total_expense', label: 'Expense', render: (r) => money(r.total_expense) },
            { key: 'profit', label: 'Profit', render: (r) => money(r.profit) },
            { key: 'mileage', label: 'Mileage' },
            { key: 'abnormal_diesel', label: 'Diesel', render: (r) => r.abnormal_diesel ? 'Abnormal' : 'OK' }
          ]}
        />
      </div>
    </div>
  );
}
