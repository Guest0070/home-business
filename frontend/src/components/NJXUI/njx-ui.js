export function switchTheme(pill) {
  var theme = pill.dataset.themeName;
  document.querySelectorAll('.theme-pill').forEach(function(p) {
    p.classList.toggle('is-active', p === pill);
  });
  if (document.startViewTransition) {
    document.startViewTransition(function() {
      document.documentElement.setAttribute('data-theme', theme);
    });
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
  try { localStorage.setItem('njx-theme', theme); } catch(e) {}
}

export function syncActivePill() {
  var current = document.documentElement.getAttribute('data-theme') || 'dark';
  document.querySelectorAll('.theme-pill').forEach(function(p) {
    p.classList.toggle('is-active', p.dataset.themeName === current);
  });
}
