import { useEffect, useState } from 'react';
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

function ChartPanel({ title, children, empty }) {
  return (
    <section className="panel p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-coal">{title}</h2>
      </div>
      {empty ? (
        <div className="flex h-72 items-center justify-center rounded border border-dashed border-slate-300 text-sm text-slate-500">
          Add trips and payments to see this chart.
        </div>
      ) : (
        <div className="h-72">{children}</div>
      )}
    </section>
  );
}

function MoneyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded border border-slate-200 bg-white p-3 text-sm shadow-sm">
      <div className="mb-1 font-semibold text-coal">{label}</div>
      {payload.map((item) => (
        <div key={item.dataKey} style={{ color: item.color }}>
          {item.name}: {money(item.value)}
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [charts, setCharts] = useState({
    dailyTrend: [],
    truckProfit: [],
    driverRanking: [],
    partyLedger: []
  });

  useEffect(() => {
    api('/dashboard').then(setData).catch(console.error);
    api('/dashboard/charts').then(setCharts).catch(console.error);
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Today's Trips" value={data?.todays_trips || 0} />
        <MetricCard label="Daily Profit" value={money(data?.daily_profit)} tone="money" />
        <MetricCard label="Monthly Profit" value={money(data?.monthly_profit)} tone="money" />
        <MetricCard label="Pending Payments" value={money(data?.pending_payments)} tone="danger" />
        <MetricCard label="Active Vehicles" value={data?.active_vehicles || 0} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartPanel title="30 Day Profit Trend">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={charts.dailyTrend} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
              <Tooltip content={<MoneyTooltip />} />
              <Line type="monotone" dataKey="profit" name="Profit" stroke="#0f766e" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#b45309" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Truck Profit" empty={charts.truckProfit.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.truckProfit} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis dataKey="vehicle_no" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
              <Tooltip content={<MoneyTooltip />} />
              <Bar dataKey="profit" name="Profit" fill="#0f766e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Driver Ranking" empty={charts.driverRanking.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.driverRanking} layout="vertical" margin={{ left: 12, right: 18, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
              <YAxis type="category" dataKey="driver_name" width={96} tick={{ fontSize: 12 }} />
              <Tooltip content={<MoneyTooltip />} />
              <Bar dataKey="total_profit" name="Total Profit" fill="#475569" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Party Billing vs Pending" empty={charts.partyLedger.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.partyLedger} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis dataKey="factory_name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
              <Tooltip content={<MoneyTooltip />} />
              <Bar dataKey="total_billing" name="Billing" fill="#475569" radius={[4, 4, 0, 0]} />
              <Bar dataKey="pending_balance" name="Pending" fill="#b45309" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>
    </div>
  );
}

