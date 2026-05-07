import { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  CreditCard,
  FileText,
  IdCard,
  Landmark,
  LocateFixed,
  Map,
  Printer,
  Route,
  ShieldCheck,
  Truck,
  UserCog,
  WalletCards
} from 'lucide-react';
import { setToken } from '../api/client.js';

export const navGroups = [
  {
    label: 'Overview',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: BarChart3 }
    ]
  },
  {
    label: 'Operations',
    items: [
      { key: 'delivery-orders', label: 'Delivery Orders', icon: FileText },
      { key: 'trips', label: 'Trips', icon: Route },
      { key: 'payments', label: 'Payments', icon: CreditCard }
    ]
  },
  {
    label: 'Masters',
    items: [
      { key: 'vehicles', label: 'Vehicles', icon: Truck },
      { key: 'drivers', label: 'Drivers', icon: IdCard },
      { key: 'routes', label: 'Routes', icon: Map }
    ]
  },
  {
    label: 'Finance',
    items: [
      { key: 'banking', label: 'Banking', icon: Landmark },
      { key: 'reports', label: 'Reports', icon: WalletCards }
    ]
  },
  {
    label: 'Compliance',
    items: [
      { key: 'compliance', label: 'Compliance', icon: ShieldCheck }
    ]
  },
  {
    label: 'Tools',
    items: [
      { key: 'gps', label: 'GPS', icon: LocateFixed }
    ]
  },
  {
    label: 'Admin',
    items: [
      { key: 'users', label: 'Users', icon: UserCog, roles: ['admin'] }
    ]
  }
];

const hiddenPageItems = [
  { key: 'do-tracker', label: 'D.O. Tracker', icon: FileText },
  { key: 'do-entry', label: 'Add D.O.', icon: FileText },
  { key: 'do-import', label: 'Import D.O.', icon: FileText },
  { key: 'bank-accounts', label: 'Bank Accounts', icon: Landmark },
  { key: 'bank-entries', label: 'Bank Entries', icon: CreditCard },
  { key: 'bank-statements', label: 'Statements', icon: WalletCards },
  { key: 'bank-loans', label: 'Loans', icon: Landmark },
  { key: 'compliance-overview', label: 'Compliance Overview', icon: ShieldCheck },
  { key: 'compliance-insurance', label: 'Insurance', icon: ShieldCheck },
  { key: 'compliance-road-tax', label: 'Road Tax', icon: ShieldCheck },
  { key: 'compliance-fitness', label: 'Fitness', icon: ShieldCheck },
  { key: 'compliance-permit', label: 'All India Permit', icon: ShieldCheck },
  { key: 'compliance-pollution', label: 'Pollution', icon: ShieldCheck },
  { key: 'compliance-mining', label: 'Mining', icon: ShieldCheck }
];

export const navItems = [...navGroups.flatMap((group) => group.items), ...hiddenPageItems];

function getParentPageKey(page) {
  if (String(page).startsWith('do-')) return 'delivery-orders';
  if (String(page).startsWith('bank-')) return 'banking';
  if (String(page).startsWith('compliance-')) return 'compliance';
  return page;
}

export default function Layout({ page, setPage, user, onLogout, children, theme, setTheme, themes }) {
  const [hideHeaderTools, setHideHeaderTools] = useState(false);
  const hideHeaderToolsRef = useRef(false);

  function logout() {
    setToken(null);
    onLogout();
  }

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    function handleScroll() {
      if (ticking) return;
      ticking = true;

      window.requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const delta = currentY - lastY;
        const shouldHide = currentY > 96 && delta > 14;
        const shouldShow = currentY < 32 || delta < -18;

        if ((shouldHide || shouldShow) && hideHeaderToolsRef.current !== shouldHide) {
          hideHeaderToolsRef.current = shouldHide;
          setHideHeaderTools(shouldHide);
        }

        if (Math.abs(delta) > 4) lastY = currentY;
        ticking = false;
      });
    }

    function resetHeaderOnResize() {
      if (window.scrollY < 96 && hideHeaderToolsRef.current) {
        hideHeaderToolsRef.current = false;
        setHideHeaderTools(false);
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', resetHeaderOnResize);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', resetHeaderOnResize);
    };
  }, []);

  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.roles || item.roles.includes(user?.role))
    }))
    .filter((group) => group.items.length > 0);

  const currentPage = navItems.find((item) => item.key === page) || navItems.find((item) => item.key === 'dashboard');
  const activePageKey = getParentPageKey(page);

  return (
    <div className="theme-shell">
      <aside className="app-sidebar fixed top-0 left-0 hidden h-screen w-72 flex-col overflow-y-auto p-4 md:flex">
        <div className="mb-6">
          <div className="text-lg font-bold">Coal TMS</div>
          <div className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            {user?.name} / {user?.role}
          </div>
        </div>

        <div className="space-y-5">
          {visibleGroups.map((group) => (
            <section key={group.label}>
              <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-normal" style={{ color: 'var(--muted)' }}>
                {group.label}
              </div>
              <nav className="flex flex-col gap-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activePageKey === item.key;
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
            </section>
          ))}
        </div>
      </aside>

      <main className="min-h-screen md:ml-72">
        <header className={`app-header sticky top-0 z-20 px-3 py-3 sm:px-4 ${hideHeaderTools ? 'app-header-collapsed' : ''}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs uppercase tracking-normal" style={{ color: 'var(--muted)' }}>
                Coal Logistics
              </div>
              <h1 className="text-lg font-bold sm:text-xl">{currentPage?.label || page}</h1>
            </div>

            <div className="app-header-tools flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <button className="btn-muted print-hide" onClick={() => window.print()} title="Print current page">
                <span className="inline-flex items-center gap-2"><Printer size={16} /> Print</span>
              </button>
              <select className="theme-select" value={theme} onChange={(e) => setTheme(e.target.value)} aria-label="Theme">
                {themes.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
              <button className="btn-muted" onClick={logout}>Logout</button>
            </div>
          </div>

          <div className="app-header-mobile-tools mt-3 space-y-3 md:hidden">
            <div className="flex items-center justify-between rounded border px-3 py-2" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--panel) 80%, transparent)' }}>
              <div className="text-xs uppercase tracking-normal" style={{ color: 'var(--muted)' }}>
                Signed in
              </div>
              <div className="truncate text-sm font-semibold">{user?.name} / {user?.role}</div>
            </div>

            <div>
              <label>Open Section</label>
              <select value={activePageKey} onChange={(e) => setPage(e.target.value)}>
                {visibleGroups.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.items.map((item) => (
                      <option key={item.key} value={item.key}>{item.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>
        </header>

        <section className="page-content p-3 pb-10 sm:p-4 md:pb-6 lg:p-6">
          {children}
        </section>
      </main>
    </div>
  );
}
