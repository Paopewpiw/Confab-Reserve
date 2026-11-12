/* Confab Reserve - local persistence service (prototype only). */
(function (global) {
  const KEY = 'confab-reserve-v1';
  function restore(state) {
    try {
      const saved = JSON.parse(global.localStorage.getItem(KEY) || 'null');
      if (!saved) return false;
      ['rooms','reservations','blocks','notifications','rules'].forEach(k => {
        if (saved[k] !== undefined) state[k] = saved[k];
      });
      return true;
    } catch (error) { console.warn('Could not restore Confab Reserve data:', error); return false; }
  }
  function save(state) {
    try { global.localStorage.setItem(KEY, JSON.stringify({
      rooms: state.rooms, reservations: state.reservations, blocks: state.blocks,
      notifications: state.notifications, rules: state.rules
    })); return true; }
    catch (error) { console.error('Could not save Confab Reserve data:', error); return false; }
  }
  function clear() { global.localStorage.removeItem(KEY); }
  global.ConfabStorage = { restore, save, clear };
})(window);
