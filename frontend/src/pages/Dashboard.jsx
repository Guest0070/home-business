import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CreditCard,
  FilePlus2,
  IdCard,
  Landmark,
  Route,
  ShieldCheck,
  Truck,
  Users
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { api } from '../api/client.js';
import MetricCard from '../components/MetricCard.jsx';

const money = (value) => `Rs ${Number(value || 0).toLocaleString('en-IN')}`;
const tons = (value) => `${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })} t`;

const chartStyle = {
  grid: 'var(--border)',
  text: 'var(--muted)',
  title: 'var(--text)',
  accent: 'var(--accent)',
  accentStrong: 'var(--accent-strong)',
  neutral: 'var(--chart-neutral)',
  warning: 'var(--chart-warning)'
};

const quickActions = [
  { key: 'trips', label: 'Enter Trip', caption: 'Fast dispatch entry', icon: Route },
  { key: 'do-entry', label: 'Add D.O.', caption: 'Create delivery order', icon: FilePlus2 },
  { key: 'payments', label: 'Receive Payment', caption: 'Post collection', icon: CreditCard },
  { key: 'drivers', label: 'Drivers', caption: 'Duty and vacation', icon: IdCard },
  { key: 'vehicles', label: 'Vehicles', caption: 'Fleet updates', icon: Truck },
  { key: 'reports', label: 'Reports', caption: 'Exports and print', icon: BarChart3 }
];

function ChartPanel({ title, children, empty }) {
  return (
    <section className="glass glass-card p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold" style={{ color: chartStyle.title }}>{title}</h2>
      </div>
      {empty ? (
        <div className="dashboard-chart-empty">
          Add trips and payments to see this section come alive.
        </div>
      ) : (
        <div className="h-64 sm:h-72">{children}</div>
      )}
    </section>
  );
}

function MoneyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass glass-card p-3 text-sm">
      <div className="mb-1 font-semibold" style={{ color: chartStyle.title }}>{label}</div>
      {payload.map((item) => (
        <div key={item.dataKey} style={{ color: item.color }}>
          {item.name}: {money(item.value)}
        </div>
      ))}
    </div>
  );
}

function DashboardPanel({ title, subtitle, actionLabel, onAction, children }) {
  return (
    <section className="glass glass-card p-4">
      <div className="dashboard-panel-head">
        <div>
          <h2 className="text-base font-bold">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
        </div>
        {actionLabel && (
          <button className="btn-muted dashboard-inline-action" onClick={onAction}>
            {actionLabel}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function QueueCard({ icon: Icon, title, subtitle, stats, actionLabel, onAction }) {
  return (
    <DashboardPanel title={title} subtitle={subtitle} actionLabel={actionLabel} onAction={onAction}>
      <div className="dashboard-queue-card">
        <div className="dashboard-queue-icon">
          <Icon size={18} />
        </div>
        <div className="dashboard-queue-stats">
          {stats.map((item) => (
            <div key={item.label} className="dashboard-queue-stat">
              <span>{item.label}</span>
              <strong className={item.tone === 'danger' ? 'text-red-700' : item.tone === 'money' ? 'text-signal' : 'text-coal'}>
                {item.value}
              </strong>
            </div>
          ))}
        </div>
      </div>
    </DashboardPanel>
  );
}

function SpotlightList({ rows, empty, renderTitle, renderMeta, renderValue }) {
  if (!rows.length) {
    return <div className="dashboard-empty-note">{empty}</div>;
  }

  return (
    <div className="dashboard-list">
      {rows.map((row, index) => (
        <article key={row.id || row.do_number || row.factory_name || row.vehicle_no || row.driver_name || index} className="dashboard-list-item">
          <div>
            <div className="dashboard-list-title">{renderTitle(row)}</div>
            <div className="dashboard-list-meta">{renderMeta(row)}</div>
          </div>
          <div className="dashboard-list-value">{renderValue(row)}</div>
        </article>
      ))}
    </div>
  );
}

export default function Dashboard({ user, setPage }) {
  const [data, setData] = useState(null);
  const [charts, setCharts] = useState({
    dailyTrend: [],
    truckProfit: [],
    driverRanking: [],
    partyLedger: []
  });
  const [operations, setOperations] = useState({
    deliveryOrders: [],
    vehicles: [],
    drivers: [],
    complianceSummary: { overdue: 0, due_soon: 0, active: 0, total: 0 }
  });
  const [error, setError] = useState('');
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
    companyName: ''
  });
  const [userMessage, setUserMessage] = useState('');

  useEffect(() => {
    let live = true;

    async function load() {
      const results = await Promise.allSettled([
        api('/dashboard'),
        api('/dashboard/charts'),
        api('/delivery-orders'),
        api('/vehicles'),
        api('/drivers'),
        api('/compliance/summary')
      ]);

      if (!live) return;

      const messages = results
        .filter((item) => item.status === 'rejected')
        .map((item) => item.reason?.message)
        .filter(Boolean);

      if (messages.length) {
        setError(messages.join(' | '));
      } else {
        setError('');
      }

      if (results[0].status === 'fulfilled') setData(results[0].value);
      if (results[1].status === 'fulfilled') setCharts(results[1].value);
      setOperations({
        deliveryOrders: results[2].status === 'fulfilled' ? results[2].value : [],
        vehicles: results[3].status === 'fulfilled' ? results[3].value : [],
        drivers: results[4].status === 'fulfilled' ? results[4].value : [],
        complianceSummary: results[5].status === 'fulfilled'
          ? results[5].value
          : { overdue: 0, due_soon: 0, active: 0, total: 0 }
      });
    }

    load().catch((loadError) => setError(loadError.message));
    return () => {
      live = false;
    };
  }, []);

  const deliveryPressure = useMemo(() => {
    const rows = operations.deliveryOrders || [];
    const urgentOpen = rows.filter((row) => ['high', 'urgent'].includes(row.priority) && row.status === 'open').length;
    const behind = rows.filter((row) => row.tracking_status === 'behind').length;
    const expired = rows.filter((row) => row.tracking_status === 'expired').length;
    const pendingTons = rows.reduce((sum, row) => sum + Number(row.pending_tons || 0), 0);
    const focusRow = [...rows]
      .filter((row) => row.status === 'open')
      .sort((left, right) => {
        const leftWeight = left.tracking_status === 'expired' ? 0 : left.tracking_status === 'behind' ? 1 : 2;
        const rightWeight = right.tracking_status === 'expired' ? 0 : right.tracking_status === 'behind' ? 1 : 2;
        if (leftWeight !== rightWeight) return leftWeight - rightWeight;
        return Number(left.days_left ?? 9999) - Number(right.days_left ?? 9999);
      })[0];

    return { urgentOpen, behind, expired, pendingTons, focusRow };
  }, [operations.deliveryOrders]);

  const fleetStatus = useMemo(() => ({
    available: operations.vehicles.filter((row) => row.status === 'available').length,
    standby: operations.vehicles.filter((row) => row.status === 'standby').length,
    onTrip: operations.vehicles.filter((row) => row.status === 'on_trip').length,
    repair: operations.vehicles.filter((row) => row.status === 'repair').length
  }), [operations.vehicles]);

  const driverStatus = useMemo(() => ({
    available: operations.drivers.filter((row) => row.status === 'available').length,
    onDuty: operations.drivers.filter((row) => row.status === 'on_duty').length,
    vacation: operations.drivers.filter((row) => row.status === 'vacation').length,
    inactive: operations.drivers.filter((row) => row.status === 'inactive' || !row.is_active).length
  }), [operations.drivers]);

  const topParties = charts.partyLedger.slice(0, 4);
  const topDrivers = charts.driverRanking.slice(0, 4);
  const topTrucks = charts.truckProfit.slice(0, 4);

  async function createUser(event) {
    event.preventDefault();
    setUserMessage('');
    try {
      await api('/users', { method: 'POST', body: userForm });
      setUserForm({ name: '', email: '', password: '', role: 'user', companyName: '' });
      setUserMessage('User created successfully.');
    } catch (createError) {
      setUserMessage(createError.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 2xl:grid-cols-[1.5fr_1fr]">
        <DashboardPanel
          title={`Good to see you, ${user?.name || 'team'}`}
          subtitle="Today’s control board keeps dispatch pressure, fleet readiness, and money movement in one place."
        >
          <div className="dashboard-hero">
            <div className="dashboard-hero-copy">
              <div className="dashboard-kicker">Current Focus</div>
              {deliveryPressure.focusRow ? (
                <>
                  <div className="dashboard-hero-title">
                    {deliveryPressure.focusRow.do_number} / {deliveryPressure.focusRow.mine_name || '-'} to {deliveryPressure.focusRow.factory_name || '-'}
                  </div>
                  <div className="dashboard-hero-meta">
                    Pending {tons(deliveryPressure.focusRow.pending_tons)} / Days left {deliveryPressure.focusRow.days_left ?? '-'} / Tracker {String(deliveryPressure.focusRow.tracking_status || '-').replace('_', ' ')}
                  </div>
                </>
              ) : (
                <>
                  <div className="dashboard-hero-title">No urgent delivery pressure right now</div>
                  <div className="dashboard-hero-meta">As new delivery orders and trips come in, the most urgent route will surface here.</div>
                </>
              )}
            </div>

            <div className="dashboard-chip-row">
              <div className="dashboard-chip">
                <span>Pending Receivables</span>
                <strong>{money(data?.pending_payments)}</strong>
              </div>
              <div className="dashboard-chip">
                <span>Monthly Profit</span>
                <strong>{money(data?.monthly_profit)}</strong>
              </div>
              <div className="dashboard-chip">
                <span>Active Vehicles</span>
                <strong>{data?.active_vehicles || 0}</strong>
              </div>
            </div>
          </div>
        </DashboardPanel>

        <DashboardPanel title="Quick Actions" subtitle="The fastest paths for the work that happens all day.">
          <div className="dashboard-action-grid">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button key={action.key} className="dashboard-action-card" onClick={() => setPage(action.key)}>
                  <div className="dashboard-action-icon">
                    <Icon size={18} />
                  </div>
                  <div>
                    <div className="dashboard-action-label">{action.label}</div>
                    <div className="dashboard-action-caption">{action.caption}</div>
                  </div>
                  <ArrowRight size={16} />
                </button>
              );
            })}
          </div>
        </DashboardPanel>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Today's Trips" value={data?.todays_trips || 0} />
        <MetricCard label="Daily Profit" value={money(data?.daily_profit)} tone="money" />
        <MetricCard label="Monthly Profit" value={money(data?.monthly_profit)} tone="money" />
        <MetricCard label="Pending Payments" value={money(data?.pending_payments)} tone="danger" />
        <MetricCard label="Active Vehicles" value={data?.active_vehicles || 0} />
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
        <QueueCard
          icon={AlertTriangle}
          title="Delivery Pressure"
          subtitle="The D.O. queue that needs attention first."
          stats={[
            { label: 'Urgent Open', value: deliveryPressure.urgentOpen },
            { label: 'Behind', value: deliveryPressure.behind },
            { label: 'Expired', value: deliveryPressure.expired, tone: 'danger' },
            { label: 'Pending Tons', value: tons(deliveryPressure.pendingTons), tone: 'money' }
          ]}
          actionLabel="Open D.O."
          onAction={() => setPage('delivery-orders')}
        />

        <QueueCard
          icon={Truck}
          title="Fleet Readiness"
          subtitle="Availability split before the next dispatch starts."
          stats={[
            { label: 'Available', value: fleetStatus.available, tone: 'money' },
            { label: 'Standby', value: fleetStatus.standby },
            { label: 'On Trip', value: fleetStatus.onTrip },
            { label: 'Repair', value: fleetStatus.repair, tone: 'danger' }
          ]}
          actionLabel="Open Vehicles"
          onAction={() => setPage('vehicles')}
        />

        <QueueCard
          icon={Users}
          title="Driver Status"
          subtitle="Who can move now, who is already out, and who is away."
          stats={[
            { label: 'Available', value: driverStatus.available, tone: 'money' },
            { label: 'On Duty', value: driverStatus.onDuty },
            { label: 'Vacation', value: driverStatus.vacation },
            { label: 'Inactive', value: driverStatus.inactive, tone: 'danger' }
          ]}
          actionLabel="Open Drivers"
          onAction={() => setPage('drivers')}
        />

        <QueueCard
          icon={ShieldCheck}
          title="Compliance Watch"
          subtitle="Renewal work that could block movement if it slips."
          stats={[
            { label: 'Overdue', value: operations.complianceSummary.overdue, tone: 'danger' },
            { label: 'Due Soon', value: operations.complianceSummary.due_soon },
            { label: 'Active', value: operations.complianceSummary.active, tone: 'money' },
            { label: 'Total', value: operations.complianceSummary.total }
          ]}
          actionLabel="Open Compliance"
          onAction={() => setPage('compliance')}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartPanel title="30 Day Profit Trend">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={charts.dailyTrend} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid stroke={chartStyle.grid} strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: chartStyle.text }} interval="preserveStartEnd" axisLine={{ stroke: chartStyle.grid }} tickLine={{ stroke: chartStyle.grid }} />
              <YAxis tick={{ fontSize: 12, fill: chartStyle.text }} tickFormatter={(value) => `${Math.round(value / 1000)}k`} axisLine={{ stroke: chartStyle.grid }} tickLine={{ stroke: chartStyle.grid }} />
              <Tooltip content={<MoneyTooltip />} />
              <Line type="monotone" dataKey="profit" name="Profit" stroke={chartStyle.accentStrong} strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="expenses" name="Expenses" stroke={chartStyle.warning} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Truck Profit" empty={charts.truckProfit.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.truckProfit} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid stroke={chartStyle.grid} strokeDasharray="3 3" />
              <XAxis dataKey="vehicle_no" tick={{ fontSize: 12, fill: chartStyle.text }} axisLine={{ stroke: chartStyle.grid }} tickLine={{ stroke: chartStyle.grid }} />
              <YAxis tick={{ fontSize: 12, fill: chartStyle.text }} tickFormatter={(value) => `${Math.round(value / 1000)}k`} axisLine={{ stroke: chartStyle.grid }} tickLine={{ stroke: chartStyle.grid }} />
              <Tooltip content={<MoneyTooltip />} />
              <Bar dataKey="profit" name="Profit" fill={chartStyle.accentStrong} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Driver Ranking" empty={charts.driverRanking.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.driverRanking} layout="vertical" margin={{ left: 12, right: 18, top: 8, bottom: 0 }}>
              <CartesianGrid stroke={chartStyle.grid} strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 12, fill: chartStyle.text }} tickFormatter={(value) => `${Math.round(value / 1000)}k`} axisLine={{ stroke: chartStyle.grid }} tickLine={{ stroke: chartStyle.grid }} />
              <YAxis type="category" dataKey="driver_name" width={96} tick={{ fontSize: 12, fill: chartStyle.text }} axisLine={{ stroke: chartStyle.grid }} tickLine={{ stroke: chartStyle.grid }} />
              <Tooltip content={<MoneyTooltip />} />
              <Bar dataKey="total_profit" name="Total Profit" fill={chartStyle.neutral} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Party Billing vs Pending" empty={charts.partyLedger.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.partyLedger} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid stroke={chartStyle.grid} strokeDasharray="3 3" />
              <XAxis dataKey="factory_name" tick={{ fontSize: 12, fill: chartStyle.text }} axisLine={{ stroke: chartStyle.grid }} tickLine={{ stroke: chartStyle.grid }} />
              <YAxis tick={{ fontSize: 12, fill: chartStyle.text }} tickFormatter={(value) => `${Math.round(value / 1000)}k`} axisLine={{ stroke: chartStyle.grid }} tickLine={{ stroke: chartStyle.grid }} />
              <Tooltip content={<MoneyTooltip />} />
              <Bar dataKey="total_billing" name="Billing" fill={chartStyle.neutral} radius={[4, 4, 0, 0]} />
              <Bar dataKey="pending_balance" name="Pending" fill={chartStyle.warning} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <DashboardPanel
          title="Collections Pressure"
          subtitle="Who is carrying the biggest outstanding amount right now."
          actionLabel="Open Payments"
          onAction={() => setPage('payments')}
        >
          <SpotlightList
            rows={topParties}
            empty="No party balances yet."
            renderTitle={(row) => row.factory_name}
            renderMeta={(row) => `Billing ${money(row.total_billing)} / Received ${money(row.payments_received)}`}
            renderValue={(row) => money(row.pending_balance)}
          />
        </DashboardPanel>

        <DashboardPanel
          title="Top Drivers"
          subtitle="Profit leaders from the recorded trips."
          actionLabel="Open Drivers"
          onAction={() => setPage('drivers')}
        >
          <SpotlightList
            rows={topDrivers}
            empty="Add trips to rank drivers."
            renderTitle={(row) => row.driver_name}
            renderMeta={(row) => `${row.total_trips || 0} trips / Mileage ${row.mileage || '-'} / Diesel flags ${row.abnormal_diesel_trips || 0}`}
            renderValue={(row) => money(row.total_profit)}
          />
        </DashboardPanel>

        <DashboardPanel
          title="Top Trucks"
          subtitle="Best profit contribution by vehicle."
          actionLabel="Open Reports"
          onAction={() => setPage('reports')}
        >
          <SpotlightList
            rows={topTrucks}
            empty="Truck profit will show once trips start landing."
            renderTitle={(row) => row.vehicle_no}
            renderMeta={(row) => `${row.ownership} / ${row.trips || 0} trips / ${Number(row.distance_km || 0).toLocaleString('en-IN')} km`}
            renderValue={(row) => money(row.profit)}
          />
        </DashboardPanel>
      </div>

      {user?.role === 'admin' && (
        <section className="glass glass-card p-4">
          <div className="dashboard-panel-head">
            <div>
              <h2 className="text-base font-bold">Admin Quick User Creation</h2>
              <p className="mt-1 text-sm text-slate-600">Keep this available on the dashboard, but out of the way of daily transport work.</p>
            </div>
          </div>

          {userMessage && <div className="mb-3 rounded border border-slate-200 px-3 py-2 text-sm">{userMessage}</div>}

          <form onSubmit={createUser} className="grid gap-3 md:grid-cols-5">
            <input placeholder="Name" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} required />
            <input placeholder="Email" type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} required />
            <input placeholder="Password" type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} required />
            <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
              <option value="user">User</option>
              <option value="company">Company</option>
              <option value="admin">Admin</option>
            </select>
            <input placeholder="Company Name" value={userForm.companyName} onChange={(e) => setUserForm({ ...userForm, companyName: e.target.value })} />
            <div className="md:col-span-5">
              <button className="btn-primary">Create User</button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
