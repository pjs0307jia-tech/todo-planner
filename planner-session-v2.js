window.plannerSession = (() => {
  const key = 'todoPlanner_private_session_v1';
  const logoutKey = 'todoPlanner_pending_logout_v1';
  let fallback = '';
  let useFallback = false;

  function read() {
    if (useFallback) return fallback;
    try { return localStorage.getItem(key) || ''; }
    catch { return fallback; }
  }

  function set(token) {
    fallback = token;
    try {
      // Keep an empty value after locking so another tab cannot restore an old session.
      localStorage.setItem(key, token);
      useFallback = false;
      try { sessionStorage.removeItem(key); } catch {}
    } catch {
      useFallback = true;
      try { sessionStorage.setItem(key, token); } catch {}
    }
  }

  let previous = '';
  try { previous = sessionStorage.getItem(key) || ''; } catch {}
  if (previous) {
    try {
      if (localStorage.getItem(key) === null) set(previous);
      else sessionStorage.removeItem(key);
    } catch {
      fallback = previous;
    }
  }

  function pendingLogouts() {
    try {
      const tokens = JSON.parse(localStorage.getItem(logoutKey) || '[]');
      return Array.isArray(tokens) ? tokens.filter(token => /^[0-9a-f]{64}$/.test(token)) : [];
    } catch { return []; }
  }

  function savePendingLogouts(tokens) {
    try {
      if (tokens.length) localStorage.setItem(logoutKey, JSON.stringify(tokens));
      else localStorage.removeItem(logoutKey);
    } catch {}
  }

  return {
    requiresPassword: code => code === '0307',
    read,
    set,
    headers() {
      const token = read();
      return token ? {'x-planner-session': token} : {};
    },
    onChange(callback) {
      window.addEventListener('storage', event => {
        if (event.storageArea === localStorage && (event.key === key || event.key === null)) callback(read());
      });
    },
    pendingLogouts,
    rememberLogout(token) {
      savePendingLogouts([...new Set([...pendingLogouts(), token])]);
    },
    forgetLogout(token) {
      savePendingLogouts(pendingLogouts().filter(pending => pending !== token));
    },
  };
})();
