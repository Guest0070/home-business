import React, { useEffect } from 'react';
import '../../styles/njx-ui.css';
import { switchTheme, syncActivePill } from './njx-ui.js';

export default function NJXUI() {
  useEffect(() => {
    // Ensure the njx-ui library CSS is loaded (it defines the theme variables)
    const href = 'https://cdn.jsdelivr.net/npm/njx-ui/css/style.min.css';
    if (!document.querySelector(`link[href="${href}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    }

    // Restore theme from localStorage (best-effort)
    try {
      const t = localStorage.getItem('njx-theme');
      if (t) document.documentElement.setAttribute('data-theme', t);
    } catch (e) {}

    // Sync pills to current theme
    syncActivePill();
  }, []);

  return (
    <div className="demo-wrap">
      <div className="demo-header">
        <img src="https://njxui.dev/img/logo-xl.png" alt="njX UI Logo" width={100} height={140}
          className="mx-auto flex items-center justify-center hero-logo animate-float" />
        <h1 className="text-gradient-primary" style={{ fontSize: '2.2rem', fontWeight: 900, margin: 0, lineHeight: 1.1 }}>njX UI</h1>
        <p className="text-muted text-sm mt-2">9 themes — one attribute &nbsp;·&nbsp; zero dependencies</p>
      </div>

      <div className="theme-switcher">
        <span className="theme-switcher-label">Choose theme</span>
        <div className="theme-pills">
          <div className="theme-pill is-active" style={{ '--pill-color': '#4a4a56' }} data-theme-name="dark" title="Dark" onClick={(e) => switchTheme(e.currentTarget)} />
          <div className="theme-pill" style={{ '--pill-color': '#f43f5e' }} data-theme-name="red" title="Red" onClick={(e) => switchTheme(e.currentTarget)} />
          <div className="theme-pill" style={{ '--pill-color': '#3b82f6' }} data-theme-name="blue" title="Blue" onClick={(e) => switchTheme(e.currentTarget)} />
          <div className="theme-pill" style={{ '--pill-color': '#22c55e' }} data-theme-name="green" title="Green" onClick={(e) => switchTheme(e.currentTarget)} />
          <div className="theme-pill" style={{ '--pill-color': '#00e5ff' }} data-theme-name="cyan" title="Cyan" onClick={(e) => switchTheme(e.currentTarget)} />
          <div className="theme-pill" style={{ '--pill-color': '#facc15' }} data-theme-name="yellow" title="Yellow" onClick={(e) => switchTheme(e.currentTarget)} />
          <div className="theme-pill" style={{ '--pill-color': '#ec4899' }} data-theme-name="pink" title="Pink" onClick={(e) => switchTheme(e.currentTarget)} />
          <div className="theme-pill" style={{ '--pill-color': '#a855f7' }} data-theme-name="purple" title="Purple" onClick={(e) => switchTheme(e.currentTarget)} />
          <div className="theme-pill" style={{ '--pill-color': '#e2e8f0' }} data-theme-name="light" title="Light" onClick={(e) => switchTheme(e.currentTarget)} />
        </div>
      </div>

      <div className="demo-grid">
        <div className="demo-block">
          <div className="demo-block-label">Buttons</div>
          <div className="flex gap-2 flex-wrap">
            <button className="btn btn-primary btn-sm">Primary</button>
            <button className="btn btn-outline btn-sm">Outline</button>
            <button className="btn btn-ghost btn-sm">Ghost</button>
          </div>
        </div>

        <div className="demo-block">
          <div className="demo-block-label">Tags</div>
          <div className="flex gap-2 flex-wrap">
            <span className="tag tag-primary">Active</span>
            <span className="tag tag-success">Done</span>
            <span className="tag tag-warning">Pending</span>
            <span className="tag tag-error">Error</span>
          </div>
        </div>

        <div className="demo-block" style={{ gridColumn: '1 / -1' }}>
          <div className="demo-block-label">Card</div>
          <div className="card" style={{ padding: 16 }}>
            <div className="flex items-center gap-3">
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'color-mix(in srgb,var(--color-primary) 15%,transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', fontWeight: 900, fontSize: '1.1rem', flexShrink: 0 }}>N</div>
              <div>
                <div className="text-sm font-semibold text-main">njX UI Component</div>
                <div className="text-xs text-muted mt-1">Zero dependencies · Pure CSS · 9 themes</div>
              </div>
              <a className="btn btn-primary btn-xs" href="https://njxui.dev" target="_blank" rel="noopener" style={{ marginLeft: 'auto', textDecoration: 'none' }}>Get Started</a>
            </div>
          </div>
        </div>

        <div className="demo-block" style={{ gridColumn: '1 / -1' }}>
          <div className="demo-block-label">Text Gradients</div>
          <div className="flex gap-4 flex-wrap items-center">
            <span className="text-gradient-primary text-xl font-bold">Primary</span>
            <span className="text-gradient-accent text-xl font-bold">Accent</span>
            <span className="text-gradient-gold text-xl font-bold">Gold</span>
            <span className="text-gradient-aurora text-xl font-bold">Aurora</span>
            <span className="text-gradient-candy text-xl font-bold">Candy</span>
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid color-mix(in srgb,var(--color-neutral-600) 18%,transparent)', paddingTop: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div className="flex gap-3 flex-wrap" style={{ justifyContent: 'center' }}>
          <a className="btn btn-primary btn-sm" href="https://njxui.dev" target="_blank" rel="noopener" style={{ textDecoration: 'none' }}>🚀 Live Demo — 25+ components</a>
          <a className="btn btn-outline btn-sm" href="https://github.com/njbSaab/njx-css-ui" target="_blank" rel="noopener" style={{ textDecoration: 'none' }}>★ GitHub</a>
          <a className="btn btn-ghost btn-sm" href="https://www.npmjs.com/package/njx-ui" target="_blank" rel="noopener" style={{ textDecoration: 'none' }}>npm install njx-ui</a>
        </div>

        <div className="flex gap-2 flex-wrap" style={{ justifyContent: 'center' }}>
          <span className="tag" style={{ fontSize: 11 }}>9 themes</span>
          <span className="tag" style={{ fontSize: 11 }}>25+ components</span>
          <span className="tag" style={{ fontSize: 11 }}>~40KB</span>
          <span className="tag" style={{ fontSize: 11 }}>0 dependencies</span>
          <span className="tag" style={{ fontSize: 11 }}>MIT license</span>
        </div>
      </div>
    </div>
  );
}
