/* Quiet updates: refresh the menu after a new worker takes control, while
 * preserving a live run (including Pause and upgrade choices). */
'use strict';
const AppUpdates = (() => {
  function start({ canReload, beforeReload = () => {}, host = globalThis }) {
    const sw = host.navigator?.serviceWorker;
    if (!sw || !host.location.protocol.startsWith('http')) return () => {};
    let controlled = !!sw.controller, pending = false, reloading = false, registration, timer;
    function apply() {
      if (pending && !reloading && !host.document.hidden && canReload()) {
        reloading = true; beforeReload(); host.location.reload();
      }
    }
    function changed() {
      if (controlled) pending = true;
      controlled = true; apply();
    }
    async function register() {
      try {
        registration = await sw.register('sw.js', { updateViaCache: 'none' });
        await registration.update();
      } catch (_) { /* Offline play keeps the installed build. */ }
    }
    function visible() {
      if (host.document.hidden) return;
      apply();
      if (registration && !pending) registration.update().catch(() => {});
    }
    sw.addEventListener('controllerchange', changed);
    host.document.addEventListener('visibilitychange', visible);
    if (host.document.readyState === 'complete') register();
    else host.addEventListener('load', register, { once: true });
    timer = host.setInterval(apply, 1000);
    return () => {
      host.clearInterval(timer); sw.removeEventListener('controllerchange', changed);
      host.document.removeEventListener('visibilitychange', visible); host.removeEventListener('load', register);
    };
  }
  return { start };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = AppUpdates;
