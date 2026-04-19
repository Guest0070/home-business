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

export default function Layout({ page, setPage, user, onLogout, children }) {
  function logout() {
    setToken(null);
    onLogout();
  }

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white md:block">
        <div className="border-b border-slate-200 p-5">
          <div className="text-lg font-bold text-coal">Coal TMS</div>
          <div className="mt-1 text-sm text-slate-500">{user?.name} / {user?.role}</div>
        </div>
        <nav className="p-3">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => setPage(item.key)}
                className={`mb-1 flex w-full items-center gap-3 rounded px-3 py-2 text-left ${
                  page === item.key ? 'bg-teal-50 text-signal' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="md:pl-64">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div>
            <div className="text-xs uppercase tracking-normal text-slate-500">Coal Logistics</div>
            <h1 className="text-xl font-bold capitalize text-coal">{page}</h1>
          </div>
          <button className="btn-muted" onClick={logout}>Logout</button>
        </header>
        <div className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white p-2 md:hidden">
          {nav.map((item) => (
            <button key={item.key} onClick={() => setPage(item.key)} className={page === item.key ? 'btn-primary' : 'btn-muted'}>
              {item.label}
            </button>
          ))}
        </div>
        <section className="p-4 lg:p-6">{children}</section>
      </main>
    </div>
  );
}

