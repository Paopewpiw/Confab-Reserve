/* Prince - administrative room, rule and blocked-time operations. */
(function (global) {
  function saveRoom(state, roomId, data) {
    if (!data.name || !Number.isInteger(data.capacity) || data.capacity < 1) return { error: 'Enter a room name and a valid capacity.' };
    if (roomId) { const room = state.rooms.find(r => Number(r.id) === Number(roomId)); if (!room) return { error: 'Room not found.' }; Object.assign(room, data); return { room }; }
    const room = { id: Math.max(0, ...state.rooms.map(r => Number(r.id))) + 1, ...data }; state.rooms.push(room); return { room };
  }
  function deleteRoom(state, roomId) {
    const hasActive = state.reservations.some(r => Number(r.roomId) === Number(roomId) && r.status === 'Active');
    if (hasActive) return { error: 'Room has active reservations and cannot be deleted.' };
    state.rooms = state.rooms.filter(r => Number(r.id) !== Number(roomId)); return { success: true };
  }
  function addBlock(state, block) {
    if (!block.date || !block.reason || block.from >= block.to) return { error: 'Enter a valid date, time range, and reason.' };
    const conflict = state.reservations.some(r => Number(r.roomId) === Number(block.roomId) && r.date === block.date && r.status === 'Active' && global.ConfabRoomService.overlaps(block.from, block.to, r.start, r.end));
    if (conflict) return { error: 'An active reservation overlaps this block. Cancel it first.' };
    state.blocks.push({ id: Date.now(), ...block }); return { success: true };
  }
  function removeBlock(state, blockId) { state.blocks = state.blocks.filter(b => Number(b.id) !== Number(blockId)); }
  global.ConfabAdminService = { saveRoom, deleteRoom, addBlock, removeBlock };
})(window);
