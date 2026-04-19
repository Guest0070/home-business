import { useEffect, useState } from 'react';
import { api, getToken } from './api/client.js';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Drivers from './pages/Drivers.jsx';
import Login from './pages/Login.jsx';
import Payments from './pages/Payments.jsx';
import Reports from './pages/Reports.jsx';
import Routes from './pages/Routes.jsx';
import Trips from './pages/Trips.jsx';
import Vehicles from './pages/Vehicles.jsx';

const pages = {
  dashboard: Dashboard,
  trips: Trips,
  drivers: Drivers,
  vehicles: Vehicles,
  routes: Routes,
  payments: Payments,
  reports: Reports
};

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [loading, setLoading] = useState(Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) return;
    api('/auth/me')
      .then((result) => setUser(result.user))
      .catch(() => localStorage.removeItem('tms_token'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-slate-600">Loading...</div>;
  if (!user) return <Login onLogin={setUser} />;

  const Page = pages[page] || Dashboard;

  return (
    <Layout page={page} setPage={setPage} user={user} onLogout={() => setUser(null)}>
      <Page />
    </Layout>
  );
}
