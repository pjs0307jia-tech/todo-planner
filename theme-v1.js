/* Theme preference is device-local and separate from planner data. */
(function () {
  const key = 'todoPlanner_theme';
  const root = document.documentElement;
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = null;

  function validTheme(value) {
    return value === 'dark' || value === 'light' ? value : null;
  }

  try { preference = validTheme(localStorage.getItem(key)); } catch {}

  function refreshControls() {
    const dark = root.dataset.theme === 'dark';
    const button = document.getElementById('themeToggle');
    if (button) {
      const label = dark ? '라이트 모드로 전환' : '다크 모드로 전환';
      button.setAttribute('aria-label', label);
      button.setAttribute('aria-pressed', String(dark));
      button.title = label;
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    const work = document.body?.dataset.mode === 'work';
    if (meta) meta.content = dark ? (work ? '#171b23' : '#19171c') : (work ? '#f8fbff' : '#fffafd');
  }

  function applyTheme() {
    root.dataset.theme = preference || (system.matches ? 'dark' : 'light');
    refreshControls();
  }

  // Run in the head, before styles paint, to avoid a bright flash on reload.
  applyTheme();

  function bindControls() {
    document.getElementById('themeToggle')?.addEventListener('click', function () {
      preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(key, preference); } catch {}
      applyTheme();
    });
    refreshControls();
    if (document.body) {
      new MutationObserver(refreshControls).observe(document.body, {
        attributes: true, attributeFilter: ['data-mode']
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindControls, { once: true });
  } else {
    bindControls();
  }
  system.addEventListener('change', function () {
    if (!preference) applyTheme();
  });
  window.addEventListener('storage', function (event) {
    if (event.key !== key && event.key !== null) return;
    try { preference = validTheme(localStorage.getItem(key)); } catch {}
    applyTheme();
  });
})();
