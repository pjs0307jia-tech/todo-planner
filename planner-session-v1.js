window.plannerSession = (() => {
  const key = 'todoPlanner_private_session_v1';
  let token = '';
  try { token = sessionStorage.getItem(key) || ''; } catch {}

  return {
    requiresPassword: code => code === '0307',
    read: () => token,
    set(value) {
      token = value;
      try {
        if (value) sessionStorage.setItem(key, value);
        else sessionStorage.removeItem(key);
      } catch {}
    },
    headers: () => token ? {'x-planner-session': token} : {},
  };
})();
