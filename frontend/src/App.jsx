import { Suspense, lazy, useEffect, useState } from 'react';
import { api, getToken } from './api/client.js';
import Layout from './components/Layout.jsx';
import { defaultTheme, themes } from './theme.js';
import { navItems } from './components/Layout.jsx';
import Login from './pages/Login.jsx';

const pages = {
  dashboard: lazy(() => import('./pages/Dashboard.jsx')),
  'delivery-orders': lazy(() => import('./pages/DeliveryOrders.jsx')),
  'do-tracker': lazy(() => import('./pages/DeliveryOrders.jsx')),
  'do-entry': lazy(() => import('./pages/DeliveryOrders.jsx')),
  'do-import': lazy(() => import('./pages/DeliveryOrders.jsx')),
  banking: lazy(() => import('./pages/Banking.jsx')),
  'bank-accounts': lazy(() => import('./pages/Banking.jsx')),
  'bank-entries': lazy(() => import('./pages/Banking.jsx')),
  'bank-statements': lazy(() => import('./pages/Banking.jsx')),
  'bank-loans': lazy(() => import('./pages/Banking.jsx')),
  compliance: lazy(() => import('./pages/Compliance.jsx')),
  'compliance-overview': lazy(() => import('./pages/Compliance.jsx')),
  'compliance-insurance': lazy(() => import('./pages/Compliance.jsx')),
  'compliance-road-tax': lazy(() => import('./pages/Compliance.jsx')),
  'compliance-fitness': lazy(() => import('./pages/Compliance.jsx')),
  'compliance-permit': lazy(() => import('./pages/Compliance.jsx')),
  'compliance-pollution': lazy(() => import('./pages/Compliance.jsx')),
  'compliance-mining': lazy(() => import('./pages/Compliance.jsx')),
  gps: lazy(() => import('./pages/GpsTracking.jsx')),
  trips: lazy(() => import('./pages/Trips.jsx')),
  drivers: lazy(() => import('./pages/Drivers.jsx')),
  vehicles: lazy(() => import('./pages/Vehicles.jsx')),
  routes: lazy(() => import('./pages/Routes.jsx')),
  payments: lazy(() => import('./pages/Payments.jsx')),
  reports: lazy(() => import('./pages/Reports.jsx')),
  users: lazy(() => import('./pages/Users.jsx'))
};

function PageFallback({ label }) {
  return (
    <div className="glass glass-card p-6">
      <div className="text-sm font-semibold text-slate-600">Loading {label}...</div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [loading, setLoading] = useState(Boolean(getToken()));
  const [theme, setTheme] = useState(localStorage.getItem('tms_theme') || defaultTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('tms_theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!getToken()) return;
    api('/auth/me')
      .then((result) => setUser(result.user))
      .catch(() => localStorage.removeItem('tms_token'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-slate-600">Loading...</div>;
  if (!user) return <Login onLogin={setUser} />;

  const Page = pages[page] || pages.dashboard;
  const currentNav = navItems.find((item) => item.key === page);
  const pageLabel = currentNav?.label || 'Dashboard';

  return (
    <Layout
      page={page}
      setPage={setPage}
      user={user}
      onLogout={() => setUser(null)}
      theme={theme}
      setTheme={setTheme}
      themes={themes}
    >
      <Suspense fallback={<PageFallback label={pageLabel} />}>
        <Page user={user} page={page} setPage={setPage} />
      </Suspense>
    </Layout>
  );
}
