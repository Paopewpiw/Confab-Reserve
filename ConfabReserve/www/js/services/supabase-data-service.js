/* Supabase-backed data operations for Confab Reserve. All writes are authenticated and RLS-protected. */
(function (global) {
  const client = () => global.ConfabAuthService.getClient();
  const message = (error) => error?.message || 'Supabase request failed.';
  const hhmm = (value) => String(value || '').slice(0, 5);

  function mapRoom(row) {
    return { id: Number(row.id), name: row.name, capacity: Number(row.capacity), description: row.description || '', active: !!row.active };
  }
  function mapReservation(row, profile = {}) {
    return {
      id: Number(row.id), roomId: Number(row.room_id), date: row.reservation_date,
      start: hhmm(row.start_time), end: hhmm(row.end_time), attendees: Number(row.attendees),
      purpose: row.purpose, status: row.status, cancelReason: row.cancel_reason || '',
      userId: row.user_id, name: profile.full_name || profile.name || 'Student',
      studentId: profile.student_id || '', college: profile.college || '', email: profile.email || ''
    };
  }
  function mapBlock(row) {
    return { id: Number(row.id), roomId: Number(row.room_id), date: row.blocked_date, from: hhmm(row.start_time), to: hhmm(row.end_time), reason: row.reason };
  }
  function mapRules(row) {
    return { open: hhmm(row.opening_time), close: hhmm(row.closing_time), slot: Number(row.slot_minutes), maxSlots: Number(row.max_slots_per_booking), maxActive: Number(row.max_active_per_student), days: Number(row.booking_days_ahead), reminder: Number(row.reminder_minutes), history: Number(row.history_days) };
  }
  function mapNotification(row) {
    return { id: Number(row.id), title: row.title, message: row.message, time: new Date(row.created_at).toLocaleString(), unread: !row.is_read };
  }

  async function loadPublic(state) {
    const sb = client();
    const [rooms, blocks, rules, busy] = await Promise.all([
      sb.from('rooms').select('id,name,capacity,description,active').order('id'),
      sb.from('blocked_slots').select('id,room_id,blocked_date,start_time,end_time,reason').order('blocked_date').order('start_time'),
      sb.from('booking_rules').select('id,opening_time,closing_time,slot_minutes,max_slots_per_booking,max_active_per_student,booking_days_ahead,reminder_minutes,history_days').eq('id', 1).single(),
      sb.from('confab_public_reservation_slots').select('room_id,reservation_date,start_time,end_time')
    ]);
    if (rooms.error) throw new Error('Could not load rooms: ' + message(rooms.error));
    if (blocks.error) throw new Error('Could not load blocked slots: ' + message(blocks.error));
    if (rules.error) throw new Error('Could not load booking rules: ' + message(rules.error));
    if (busy.error) throw new Error('Could not load room availability: ' + message(busy.error));
    state.rooms = (rooms.data || []).map(mapRoom);
    state.blocks = (blocks.data || []).map(mapBlock);
    state.publicReservations = (busy.data || []).map(r => ({ roomId: Number(r.room_id), date: r.reservation_date, start: hhmm(r.start_time), end: hhmm(r.end_time), status: 'Active' }));
    state.rules = mapRules(rules.data);
    if (!state.rooms.some(r => r.id === Number(state.selectedRoom))) state.selectedRoom = state.rooms[0]?.id || null;
    return true;
  }

  async function loadPrivate(state) {
    if (!state.user) { state.reservations = []; state.notifications = []; return true; }
    const sb = client();
    const [reservations, notifications] = await Promise.all([
      sb.from('reservations').select('id,user_id,room_id,reservation_date,start_time,end_time,attendees,purpose,status,cancel_reason,created_at').order('reservation_date', { ascending: false }).order('start_time'),
      sb.from('notifications').select('id,user_id,title,message,is_read,created_at').order('created_at', { ascending: false })
    ]);
    if (reservations.error) throw new Error('Could not load reservations: ' + message(reservations.error));
    if (notifications.error) throw new Error('Could not load notifications: ' + message(notifications.error));
    const rows = reservations.data || [];
    const ids = [...new Set(rows.map(r => r.user_id).filter(Boolean))];
    let profiles = [];
    if (ids.length) {
      const result = await sb.from('profiles').select('id,full_name,student_id,college,email').in('id', ids);
      if (result.error) throw new Error('Could not load reservation student details: ' + message(result.error));
      profiles = result.data || [];
    }
    const byId = Object.fromEntries(profiles.map(p => [p.id, p]));
    state.reservations = rows.map(r => mapReservation(r, byId[r.user_id] || (r.user_id === state.user.id ? state.user : {})));
    state.notifications = (notifications.data || []).map(mapNotification);
    return true;
  }

  async function refresh(state) { await loadPublic(state); await loadPrivate(state); return true; }

  async function createReservation(state, input) {
    const sb = client();
    if (!state.user?.id) return { error: 'Please log in before reserving a room.' };
    await loadPublic(state); await loadPrivate(state);
    const room = state.rooms.find(r => r.id === Number(input.roomId));
    if (!room || !room.active) return { error: 'This room is not available for booking.' };
    const times = [...input.times].sort();
    if (!input.date || !times.length) return { error: 'Select at least one time slot.' };
    if (!Number.isInteger(input.attendees) || input.attendees < 1 || input.attendees > room.capacity) return { error: `Attendees must be between 1 and ${room.capacity}.` };
    if (!String(input.purpose || '').trim()) return { error: 'Please enter the purpose of your reservation.' };
    if (times.length > state.rules.maxSlots) return { error: `Maximum ${state.rules.maxSlots} slot(s) per booking.` };
    const toMinutes = value => { const [h,m]=value.split(':').map(Number); return h*60+m; };
    for (let i = 1; i < times.length; i++) if (toMinutes(times[i]) - toMinutes(times[i-1]) !== state.rules.slot) return { error: 'Choose consecutive slots for one reservation.' };
    const maxDate = new Date(); maxDate.setHours(0,0,0,0); maxDate.setDate(maxDate.getDate() + state.rules.days);
    const requested = new Date(input.date + 'T00:00:00');
    if (requested < new Date(new Date().toDateString()) || requested > maxDate) return { error: `Reservations can only be made within the next ${state.rules.days} days.` };
    if (state.reservations.filter(r => r.userId === state.user.id && r.status === 'Active').length >= state.rules.maxActive) return { error: 'You have reached the active reservation limit.' };
    const start = times[0]; const endMinutes = toMinutes(times[times.length - 1]) + state.rules.slot; const end = `${String(Math.floor(endMinutes/60)).padStart(2,'0')}:${String(endMinutes%60).padStart(2,'0')}`;
    const open = state.rules.open, close = state.rules.close;
    if (start < open || end > close) return { error: `Bookings are available between ${open} and ${close}.` };
    if (state.blocks.some(b => b.roomId === room.id && b.date === input.date && start < b.to && b.from < end)) return { error: 'That time is blocked by library staff.' };
    if ([...(state.publicReservations || []), ...state.reservations].some(r => r.roomId === room.id && r.date === input.date && r.status === 'Active' && start < r.end && r.start < end)) return { error: 'That time has just been reserved by another user.' };
    const { data, error } = await sb.from('reservations').insert({
      user_id: state.user.id, room_id: room.id, reservation_date: input.date,
      start_time: start, end_time: end, attendees: input.attendees,
      purpose: String(input.purpose).trim(), status: 'Active'
    }).select('id,user_id,room_id,reservation_date,start_time,end_time,attendees,purpose,status,cancel_reason,created_at').single();
    if (error) return { error: message(error) };
    const reservation = mapReservation(data, state.user);
    state.reservations.unshift(reservation);
    return { reservation };
  }

  async function cancelReservation(state, reservationId, reason = null, staff = false) {
    const sb = client();
    let query = sb.from('reservations').update({ status: staff ? 'Cancelled by Staff' : 'Cancelled', cancel_reason: reason }).eq('id', reservationId).eq('status', 'Active');
    if (!staff) query = query.eq('user_id', state.user.id);
    const { data, error } = await query.select('id,user_id,room_id,reservation_date,start_time,end_time,attendees,purpose,status,cancel_reason').maybeSingle();
    if (error) return { error: message(error) };
    if (!data) return { error: 'Reservation not found, already changed, or you do not have permission.' };
    const old = state.reservations.find(r => r.id === Number(reservationId));
    const updated = mapReservation(data, old || state.user);
    if (old) Object.assign(old, updated);
    else state.reservations.unshift(updated);
    // A database trigger in SUPABASE_MILESTONE4_MIGRATION.sql creates the notification securely.
    return { reservation: updated };
  }

  async function saveRoom(data, roomId) {
    const sb = client();
    const payload = { name: data.name, capacity: data.capacity, description: data.description || null, active: !!data.active };
    const result = roomId
      ? await sb.from('rooms').update(payload).eq('id', roomId).select('id,name,capacity,description,active').single()
      : await sb.from('rooms').insert(payload).select('id,name,capacity,description,active').single();
    if (result.error) return { error: message(result.error) };
    return { room: mapRoom(result.data) };
  }
  async function deleteRoom(roomId) {
    const sb = client();
    const { data: active, error: checkError } = await sb.from('reservations').select('id').eq('room_id', roomId).eq('status', 'Active').limit(1);
    if (checkError) return { error: message(checkError) };
    if (active?.length) return { error: 'Room has active reservations and cannot be deleted.' };
    const { error } = await sb.from('rooms').delete().eq('id', roomId);
    return error ? { error: message(error) } : { success: true };
  }
  async function setRoomActive(roomId, active) {
    const { error } = await client().from('rooms').update({ active: !!active }).eq('id', roomId);
    return error ? { error: message(error) } : { success: true };
  }
  async function saveRules(rules) {
    const payload = { opening_time: rules.open, closing_time: rules.close, slot_minutes: rules.slot, max_slots_per_booking: rules.maxSlots, max_active_per_student: rules.maxActive, booking_days_ahead: rules.days, reminder_minutes: rules.reminder, history_days: rules.history };
    const { error } = await client().from('booking_rules').update(payload).eq('id', 1);
    return error ? { error: message(error) } : { success: true };
  }
  async function addBlock(block) {
    if (!block.date || !block.reason || block.from >= block.to) return { error: 'Enter a valid date, time range, and reason.' };
    const { data: overlaps, error: checkError } = await client().from('reservations').select('id').eq('room_id', block.roomId).eq('reservation_date', block.date).eq('status', 'Active').lt('start_time', block.to).gt('end_time', block.from).limit(1);
    if (checkError) return { error: message(checkError) };
    if (overlaps?.length) return { error: 'An active reservation overlaps this block. Cancel it first.' };
    const { data, error } = await client().from('blocked_slots').insert({ room_id: block.roomId, blocked_date: block.date, start_time: block.from, end_time: block.to, reason: block.reason }).select('id,room_id,blocked_date,start_time,end_time,reason').single();
    return error ? { error: message(error) } : { block: mapBlock(data) };
  }
  async function removeBlock(blockId) {
    const { error } = await client().from('blocked_slots').delete().eq('id', blockId);
    return error ? { error: message(error) } : { success: true };
  }
  async function markNotificationsRead(state) {
    const unread = state.notifications.filter(n => n.unread).map(n => n.id);
    if (!unread.length) return { success: true };
    const { error } = await client().from('notifications').update({ is_read: true }).in('id', unread).eq('user_id', state.user.id);
    if (error) return { error: message(error) };
    state.notifications.forEach(n => { n.unread = false; });
    return { success: true };
  }

  global.ConfabDataService = { loadPublic, loadPrivate, refresh, createReservation, cancelReservation, saveRoom, deleteRoom, setRoomActive, saveRules, addBlock, removeBlock, markNotificationsRead };
})(window);
