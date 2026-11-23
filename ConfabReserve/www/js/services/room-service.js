(function (global) {
  const minutes = value => { const [h,m]=String(value).slice(0,5).split(':').map(Number); return h*60+m; };
  function overlaps(startA, endA, startB, endB) { return startA < endB && startB < endA; }
  function isBlocked(blocks, roomId, date, time, slotMinutes=60) {
    const start=minutes(time), end=start+slotMinutes;
    return blocks.some(b => Number(b.roomId) === Number(roomId) && b.date === date && overlaps(start,end,minutes(b.from),minutes(b.to)));
  }
  function slotStatus(state, roomId, date, time) {
    const duration=Number(state.rules?.slot)||60, start=minutes(time), end=start+duration;
    if (isBlocked(state.blocks, roomId, date, time, duration)) return 'blocked';
    const busy=[...(state.publicReservations||[]),...(state.reservations||[])].some(r => Number(r.roomId) === Number(roomId) && r.date === date && r.status === 'Active' && overlaps(start,end,minutes(r.start),minutes(r.end)));
    return busy ? 'taken' : 'available';
  }
  function getAvailableSlots(state, roomId, date, slots) { return slots.filter(time => slotStatus(state, roomId, date, time) === 'available'); }
  global.ConfabRoomService = { overlaps, isBlocked, slotStatus, getAvailableSlots };
})(window);
