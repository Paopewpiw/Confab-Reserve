/* Prince - student reservation lists and notification handling. */
(function (global) {
  function getReservations(state, studentId, tab = 'upcoming') {
    return state.reservations.filter(r => r.studentId === studentId)
      .filter(r => tab === 'upcoming' ? r.status === 'Active' : r.status !== 'Active');
  }
  function markAllRead(state) { state.notifications.forEach(n => { n.unread = false; }); }
  global.ConfabStudentService = { getReservations, markAllRead };
})(window);
