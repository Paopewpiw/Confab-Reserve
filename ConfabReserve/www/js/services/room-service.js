/* Paul - room availability, time slots and conflict checks. */
(function (global) {
  function overlaps(startA, endA, startB, endB) { return startA < endB && startB < endA; }
  function isBlocked(blocks, roomId, date, time) {
    return blocks.some(b => Number(b.roomId) === Number(roomId) && b.date === date && time >= b.from && time < b.to);
  }
  function slotStatus(state, roomId, date, time) {
    if (isBlocked(state.blocks, roomId, date, time)) return 'blocked';
    const taken = state.reservations.some(r => Number(r.roomId) === Number(roomId) && r.date === date && r.status === 'Active' && time >= r.start && time < r.end);
    return taken ? 'taken' : 'available';
  }
  function getAvailableSlots(state, roomId, date, slots) {
    return slots.filter(time => slotStatus(state, roomId, date, time) === 'available');
  }
  global.ConfabRoomService = { overlaps, isBlocked, slotStatus, getAvailableSlots };
})(window);
