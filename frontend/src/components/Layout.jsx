import { BarChart3, CreditCard, IdCard, Map, Route, Truck, WalletCards } from 'lucide-react';
import { setToken } from '../api/client.js';

const nav = [
  { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { key: 'trips', label: 'Trips', icon: Route },
  { key: 'drivers', label: 'Drivers', icon: IdCard },
  { key: 'vehicles', label: 'Vehicles', icon: Truck },
  { key: 'routes', label: 'Routes', icon: Map },
  { key: 'payments', label: 'Payments', icon: CreditCard },
  { key: 'reports', label: 'Reports', icon: WalletCards }
];

export default function Layout({ page, setPage, user, onLogout, children, theme, setTheme, themes }) {
  function logout() {
    setToken(null);
    onLogout();
  }

  return (
    <div className="theme-shell">
      <aside className="app-sidebar fixed top-0 left-0 hidden h-screen w-64 flex-col p-4 md:flex">
        <div className="mb-6">
          <div className="text-lg font-bold">Coal TMS</div>
          <div className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            {user?.name} / {user?.role}
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = page === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setPage(item.key)}
                className={`flex items-center gap-3 rounded px-3 py-2 text-left ${active ? 'app-nav-active' : 'app-nav-idle'}`}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="min-h-screen md:ml-64">
        <header className="app-header sticky top-0 z-20 px-3 py-3 sm:px-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs uppercase tracking-normal" style={{ color: 'var(--muted)' }}>
                Coal Logistics
              </div>
              <h1 className="text-lg font-bold capitalize sm:text-xl">{page}</h1>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <select className="theme-select" value={theme} onChange={(e) => setTheme(e.target.value)} aria-label="Theme">
                {themes.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
              <button className="btn-muted" onClick={logout}>Logout</button>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between rounded border px-3 py-2 md:hidden" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--panel) 80%, transparent)' }}>
            <div className="text-xs uppercase tracking-normal" style={{ color: 'var(--muted)' }}>
              Signed in
            </div>
            <div className="truncate text-sm font-semibold">{user?.name} / {user?.role}</div>
          </div>
        </header>

        <section className="page-content p-3 pb-24 sm:p-4 md:pb-6 lg:p-6">
          {children}
        </section>

        <nav className="mobile-bottom-nav md:hidden">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = page === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setPage(item.key)}
                className={`mobile-nav-btn ${active ? 'app-nav-active' : 'app-nav-idle'}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </main>
    </div>
  );
}
