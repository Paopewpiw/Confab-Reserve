/* Paul - booking validation and reservation creation. */
(function (global) {
  function validate(state, input) {
    const room = state.rooms.find(r => Number(r.id) === Number(input.roomId));
    if (!state.user) return 'Please log in before reserving a room.';
    if (!room || !room.active) return 'This room is not available for booking.';
    if (!input.date || !input.times.length) return 'Select at least one time slot.';
    if (!Number.isInteger(input.attendees) || input.attendees < 1 || input.attendees > room.capacity) return `Attendees must be between 1 and ${room.capacity}.`;
    if (!input.purpose.trim()) return 'Please enter the purpose of your reservation.';
    if (input.times.some(t => global.ConfabRoomService.slotStatus(state, room.id, input.date, t) !== 'available')) return 'A selected slot is no longer available.';
    if (state.reservations.filter(r => r.studentId === state.user.studentId && r.status === 'Active').length >= state.rules.maxActive) return 'You have reached the active reservation limit.';
    const times = [...input.times].sort();
    for (let i = 1; i < times.length; i++) if (Number(times[i].slice(0,2)) - Number(times[i-1].slice(0,2)) !== 1) return 'Choose consecutive slots for one reservation.';
    return null;
  }
  function create(state, input) {
    const error = validate(state, input); if (error) return { error };
    const room = state.rooms.find(r => Number(r.id) === Number(input.roomId));
    const times = [...input.times].sort();
    const start = times[0], endHour = Number(times[times.length - 1].slice(0,2)) + 1;
    const reservation = { id: Date.now(), roomId: room.id, date: input.date, start, end: `${String(endHour).padStart(2,'0')}:00`, attendees: input.attendees, purpose: input.purpose.trim(), name: state.user.name, studentId: state.user.studentId, college: state.user.college, status: 'Active' };
    const conflict = state.reservations.some(r => Number(r.roomId) === room.id && r.date === reservation.date && r.status === 'Active' && global.ConfabRoomService.overlaps(reservation.start, reservation.end, r.start, r.end));
    if (conflict) return { error: 'That time has just been reserved by another user.' };
    state.reservations.unshift(reservation);
    state.notifications.unshift({ title: 'Reservation Confirmed', message: `${room.name} reservation confirmed`, time: 'Just now', unread: true });
    return { reservation };
  }
  function cancel(state, reservationId, status = 'Cancelled', message = 'Your reservation was cancelled') {
    const reservation = state.reservations.find(r => Number(r.id) === Number(reservationId));
    if (!reservation || reservation.status !== 'Active') return { error: 'Reservation not found or already cancelled.' };
    reservation.status = status;
    state.notifications.unshift({ title: 'Reservation Cancelled', message, time: 'Just now', unread: true });
    return { reservation };
  }
  global.ConfabBookingService = { validate, create, cancel };
})(window);
