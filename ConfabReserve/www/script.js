const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const today = new Date(); today.setHours(0,0,0,0);
const state = {
  screen: 1, user: null, guest: true, selectedRoom: null, selectedDate: today,
  selectedSlots: [], selectedReservation: null, editingRoom: null, activeResTab: 'upcoming',
  adminFilter: 'All', adminDate: new Date(), roomDateOffset: 0,
  rooms: [], reservations: [], publicReservations: [], blocks: [], notifications: [],
  rules:{open:'05:00',close:'20:00',slot:60,maxSlots:2,maxActive:2,days:7,reminder:30,history:30}
};
function persistState(){ /* Supabase is the source of truth; do not persist shared records locally. */ }
let toastTimer;
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2600)}
function dateISO(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function prettyDate(iso){return new Date(iso+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'})}
function roomById(id){return state.rooms.find(r=>r.id===Number(id))}

async function go(n){
  const adminScreens=[11,12,13,14,15,16];
  if(adminScreens.includes(n)&&state.user?.role!=='admin'){toast('This section is for library staff only.');return;}
  if([7,8,9].includes(n)&&!state.user){toast('Please log in to access this feature.');go(1);return;}
  if([7,8,9].includes(n)&&state.user?.role==='admin'){toast('That page is part of the student area.');go(11);return;}
  state.screen=n;
  $$('.screen').forEach(s=>s.classList.toggle('active',Number(s.dataset.screen)===n));
  try {
    if([3,4,5,6].includes(n)) await window.ConfabDataService.loadPublic(state);
    if([7,8,9,10].includes(n)) { await window.ConfabDataService.loadPublic(state); await window.ConfabDataService.loadPrivate(state); }
    if(adminScreens.includes(n)) await window.ConfabDataService.refresh(state);
  } catch(err) { console.error(err); toast(err.message || 'Could not load data from Supabase.'); }
  if(n===3)renderRooms(); if(n===4)renderAvailability(); if(n===5)renderBookingForm(); if(n===6)renderConfirmation();
  if(n===7)renderMyReservations(); if(n===8)renderReservationDetail(); if(n===9)renderNotifications(); if(n===10)renderProfile();
  if(n===11)renderAdminReservations(); if(n===12)renderAdminDetail(); if(n===13)renderManageRooms(); if(n===14)renderRoomEditor(); if(n===15)renderRules(); if(n===16)renderBlocks();
  $('.screen.active').scrollTop=0;
}

function roomReservations(roomId,date){return state.reservations.filter(r=>r.roomId===roomId&&r.date===date&&r.status==='Active')}
function isBlocked(roomId,date,time){return window.ConfabRoomService.isBlocked(state.blocks,roomId,date,time)}
function slotStatus(roomId,date,time){return window.ConfabRoomService.slotStatus(state,roomId,date,time)}

function slotsForDay(){const out=[];const [oh,om]=state.rules.open.split(':').map(Number);const [ch,cm]=state.rules.close.split(':').map(Number);let t=oh*60+om;const end=ch*60+cm;while(t+state.rules.slot<=end){out.push(`${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`);t+=state.rules.slot;}return out;}
function timeLabel(t){let [h,m]=t.split(':').map(Number);return `${h%12||12}${m?':'+String(m).padStart(2,'0'):''} ${h<12?'AM':'PM'}`}
function renderRooms(){
  const date=new Date();date.setHours(0,0,0,0);date.setDate(date.getDate()+state.roomDateOffset);state.selectedDate=date;$('#rooms-date-label').textContent=state.roomDateOffset===0?'Today, '+date.toLocaleDateString('en-US',{weekday:'short',day:'numeric',month:'short'}):date.toLocaleDateString('en-US',{weekday:'short',day:'numeric',month:'short'});
  $('#room-list').innerHTML=state.rooms.filter(r=>r.active).map(r=>{const free=slotsForDay().filter(t=>slotStatus(r.id,dateISO(date),t)==='available').length;return `<article class="room-card" data-room="${r.id}"><div><strong>${r.name}</strong><small>Capacity: ${r.capacity}</small></div><span class="count-pill ${free===0?'full':''}">${free===0?'Full':free+' Slots'}</span></article>`}).join('');
}
function renderAvailability(){
  const room=roomById(state.selectedRoom);if(!room)return;$('#availability-title').textContent=room.name;$('#availability-capacity').textContent=`Capacity up to ${room.capacity} · Annex Library`;
  const d=state.selectedDate;$('#weekday-strip').innerHTML=Array.from({length:5},(_,i)=>{const day=new Date(d);day.setDate(d.getDate()+i);return `<button class="day-chip ${i===0?'active':''}" data-day="${dateISO(day)}">${day.toLocaleDateString('en-US',{weekday:'short'})}<strong>${day.getDate()}</strong></button>`}).join('');
  state.selectedSlots=[];renderSlots(dateISO(d));
}
function renderSlots(date){
  $('#slot-grid').innerHTML=slotsForDay().map(t=>{const status=slotStatus(state.selectedRoom,date,t);return `<button class="slot ${status}" data-time="${t}" ${status!=='available'?'disabled':''}>${timeLabel(t)}<small>${status[0].toUpperCase()+status.slice(1)}</small></button>`}).join('');
  $('#selection-summary').textContent='Selected: none';state.selectedSlots=[];
}
function renderBookingForm(){const room=roomById(state.selectedRoom);const times=state.selectedSlots.slice().sort();const start=times[0];$('#booking-summary').innerHTML=`<strong>${room.name}</strong><br>${prettyDate(dateISO(state.selectedDate))}<br>${times.map(timeLabel).join(', ')} (${times.length} slot${times.length>1?'s':''})`;$('#booking-name').value=state.user?.name||'';$('#attendee-max').textContent=room.capacity;$('#attendees').max=room.capacity;$('#attendees').value=Math.min(5,room.capacity);$('#purpose').value='';}
function renderConfirmation(){const r=state.reservations.find(x=>x.id===state.selectedReservation);if(!r)return;$('#confirmation-details').innerHTML=detailRows(r)}
function detailRows(r){const room=roomById(r.roomId);return `<div class="detail-row"><span>Room:</span><strong>${room?.name||'Room'}</strong></div><div class="detail-row"><span>Date:</span><strong>${prettyDate(r.date)}</strong></div><div class="detail-row"><span>Time:</span><strong>${timeLabel(r.start)}–${timeLabel(r.end)}</strong></div><div class="detail-row"><span>Attendees:</span><strong>${r.attendees}</strong></div><div class="detail-row"><span>Status:</span><strong>${r.status}</strong></div>`}
function renderMyReservations(){
  const list=state.reservations.filter(r=>r.userId===state.user?.id).filter(r=>state.activeResTab==='upcoming'?r.status==='Active':r.status!=='Active');
  $('#my-reservations').innerHTML=list.length?list.map(r=>`<article class="res-card"><div class="res-card-head"><strong>${roomById(r.roomId)?.name||'Room'}</strong><span class="status ${r.status.toLowerCase()}">${r.status}</span></div><p>${prettyDate(r.date)} · ${timeLabel(r.start)} – ${timeLabel(r.end)}</p><p>${r.attendees} Attendees</p><button data-reservation="${r.id}">Details ›</button><div style="clear:both"></div></article>`).join(''):'<p class="hint">No reservations to show.</p>';
}
function renderReservationDetail(){const r=state.reservations.find(x=>x.id===state.selectedReservation);if(!r)return;$('#reservation-detail-card').innerHTML=detailRows(r)+`<div class="detail-row"><span>Purpose:</span><strong>${r.purpose}</strong></div>`;$('#cancel-area').style.display=r.status==='Active'?'flex':'none'}
function renderNotifications(){$('#notification-list').innerHTML=state.notifications.map(n=>`<article class="notification-card ${n.unread?'unread':''}"><strong>${n.title}</strong>${n.message}<small>${n.time}</small></article>`).join('')||'<p class="hint">No notifications yet.</p>';window.ConfabDataService.markNotificationsRead(state).catch(err=>console.warn('Mark notifications read:',err.message));}
function renderProfile() {
  const u = state.user;
  const isAdmin = u?.role === 'admin';

  $('#student-profile-nav').style.display = isAdmin ? 'none' : 'flex';
  $('#admin-profile-nav').style.display = isAdmin ? 'flex' : 'none';

  $('#profile-name').textContent = u?.name || (isAdmin ? 'Administrator' : 'Guest Student');

  $('#profile-avatar').textContent = (u?.name || 'GS')
    .split(' ')
    .map(x => x[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const roleLabel = $('#profile-role');
  if (roleLabel) {
    roleLabel.textContent = isAdmin
      ? 'Library Staff / Administrator'
      : 'Student';
  }

  if (isAdmin) {
    $('#profile-info').innerHTML = `
      <div>Staff ID: <strong>Administrator</strong></div>
      <div>Department: <strong>Library Administration</strong></div>
      <div>Email: <strong>${u?.email || '—'}</strong></div>
      <div>Access: <strong>Admin Management</strong></div>
    `;
  } else {
    const activeReservations = state.reservations.filter(
      r => r.userId === u?.id && r.status === 'Active'
    ).length;

    $('#profile-info').innerHTML = `
      <div>Student ID: <strong>${u?.studentId || '—'}</strong></div>
      <div>College: <strong>${u?.college || '—'}</strong></div>
      <div>Email: <strong>${u?.email || '—'}</strong></div>
      <div>Active Reservation: <strong>${activeReservations}</strong></div>
    `;
  }
}
function renderAdminReservations(){const date=dateISO(state.adminDate);$('#admin-date-label').textContent=state.adminDate.toLocaleDateString('en-US',{weekday:'short',day:'numeric',month:'short',year:'numeric'});const rows=state.reservations.filter(r=>r.date===date&&r.status==='Active'&&(state.adminFilter==='All'||roomById(r.roomId)?.name===state.adminFilter));$('#admin-reservations').innerHTML=rows.length?rows.map(r=>`<div class="admin-row"><div><strong>${timeLabel(r.start)} · ${roomById(r.roomId)?.name}</strong><br>${r.name} · ${r.studentId}<br>Attendees: ${r.attendees}</div><button data-admin-res="${r.id}">Details</button></div>`).join(''):'<p class="hint">No reservations for this date and filter.</p>'}
function renderAdminDetail(){const r=state.reservations.find(x=>x.id===state.selectedReservation);if(!r)return;$('#admin-detail-card').innerHTML=detailRows(r)+`<div class="detail-row"><span>Reserved by:</span><strong>${r.name}</strong></div><div class="detail-row"><span>Student ID:</span><strong>${r.studentId}</strong></div><div class="detail-row"><span>College:</span><strong>${r.college||'College Name'}</strong></div><div class="detail-row"><span>Purpose:</span><strong>${r.purpose}</strong></div>`}
function renderManageRooms(){$('#manage-room-list').innerHTML=state.rooms.map(r=>`<div class="manage-card"><strong>${r.name}</strong><small>Capacity ${r.capacity}</small><div class="manage-actions"><button class="edit-link" data-edit-room="${r.id}">Edit</button><label class="switch"><input type="checkbox" data-toggle-room="${r.id}" ${r.active?'checked':''}><span></span></label></div></div>`).join('')}
function renderRoomEditor(){const r=state.rooms.find(x=>x.id===state.editingRoom);$('#room-editor-title').textContent=r?'Edit Rooms':'Add Room';$('#edit-room-name').value=r?.name||'';$('#edit-room-capacity').value=r?.capacity||'';$('#edit-room-description').value=r?.description||'';$('#edit-room-active').checked=r?.active??true;$('#room-active-label').textContent=($('#edit-room-active').checked?'Room is Active':'Room Inactive');$('#delete-room').style.display=r?'block':'none'}
function renderRules(){const r=state.rules;$('#rule-open').value=r.open;$('#rule-close').value=r.close;$('#rule-slot').value=r.slot;$('#rule-max-slots').value=r.maxSlots;$('#rule-active').value=r.maxActive;$('#rule-days').value=r.days;$('#rule-reminder').value=r.reminder;$('#rule-history').value=r.history}
function renderBlocks(){$('#block-room').innerHTML=state.rooms.map(r=>`<option value="${r.id}">${r.name}</option>`).join('');if(!$('#block-date').value)$('#block-date').value=dateISO(new Date());$('#current-blocks').innerHTML=state.blocks.map(b=>`<div class="current-block"><span>${roomById(b.roomId)?.name} · ${prettyDate(b.date)}<br>${b.from==='00:00'&&b.to==='23:59'?'All day':timeLabel(b.from)+'–'+timeLabel(b.to)} · ${b.reason}</span><button data-remove-block="${b.id}">Remove</button></div>`).join('')||'<p class="hint">No current blocks.</p>'}
function openModal(title,message,yes){$('#modal-title').textContent=title;$('#modal-message').textContent=message;$('#modal').classList.remove('hidden');$('#modal-yes').onclick=()=>{$('#modal').classList.add('hidden');yes()};$('#modal-no').onclick=()=>$('#modal').classList.add('hidden')}
function isOverlap(a,b,c,d){return a<d&&c<b}

// Delegated navigation and screen controls
document.addEventListener('click',e=>{
 const goBtn=e.target.closest('[data-go]');if(goBtn){go(Number(goBtn.dataset.go));return}
 if(e.target.closest('[data-back]')){go(state.screen===2?1:3);return}
 const room=e.target.closest('[data-room]');if(room){state.selectedRoom=Number(room.dataset.room);go(4);return}
 const day=e.target.closest('[data-day]');if(day){state.selectedDate=new Date(day.dataset.day+'T12:00:00');$$('.day-chip').forEach(x=>x.classList.toggle('active',x===day));renderSlots(day.dataset.day);return}
 const slot=e.target.closest('.slot.available');if(slot){const t=slot.dataset.time;const i=state.selectedSlots.indexOf(t);if(i>=0)state.selectedSlots.splice(i,1);else if(state.selectedSlots.length<state.rules.maxSlots)state.selectedSlots.push(t);else toast(`Maximum ${state.rules.maxSlots} slot(s) per booking.`);slot.classList.toggle('selected',state.selectedSlots.includes(t));slot.querySelector('small').textContent=state.selectedSlots.includes(t)?'Selected':'Available';$('#selection-summary').textContent=state.selectedSlots.length?'Selected: '+state.selectedSlots.sort().map(timeLabel).join(', '):'Selected: none';return}
 const res=e.target.closest('[data-reservation]');if(res){state.selectedReservation=Number(res.dataset.reservation);go(8);return}
 const admin=e.target.closest('[data-admin-res]');if(admin){state.selectedReservation=Number(admin.dataset.adminRes);go(12);return}
 const tab=e.target.closest('[data-res-tab]');if(tab){state.activeResTab=tab.dataset.resTab;$$('[data-res-tab]').forEach(x=>x.classList.toggle('active',x===tab));renderMyReservations();return}
 const filter=e.target.closest('[data-filter]');if(filter){state.adminFilter=filter.dataset.filter;$$('[data-filter]').forEach(x=>x.classList.toggle('active',x===filter));renderAdminReservations();return}
 const edit=e.target.closest('[data-edit-room]');if(edit){state.editingRoom=Number(edit.dataset.editRoom);go(14);return}
 const remove=e.target.closest('[data-remove-block]');if(remove){window.ConfabDataService.removeBlock(Number(remove.dataset.removeBlock)).then(async result=>{if(result.error){toast(result.error);return;}await window.ConfabDataService.loadPublic(state);renderBlocks();toast('Block removed.');});return}
});
$('#rooms-prev').onclick=()=>{state.roomDateOffset=Math.max(0,state.roomDateOffset-1);renderRooms()};
$('#rooms-next').onclick=()=>{state.roomDateOffset=Math.min(7,state.roomDateOffset+1);renderRooms()};
$('#admin-prev').onclick=()=>{state.adminDate.setDate(state.adminDate.getDate()-1);renderAdminReservations()};
$('#admin-next').onclick=()=>{state.adminDate.setDate(state.adminDate.getDate()+1);renderAdminReservations()};
$('#reserve-selected').onclick=()=>{if(!state.selectedSlots.length){toast('Select at least one available time slot.');return}if(!state.user){toast('Please log in to reserve a room.');go(1);return}go(5)};
$('#login-form').onsubmit=async e=>{
 e.preventDefault();
 const button=$('#login-form button[type=submit]');button.disabled=true;
 try {
   const result=await window.ConfabAuthService.signIn($('#login-email').value,$('#login-password').value);
   if(result.error){toast(result.error);return;}
   state.user=result.user;state.guest=false;persistState();
   if(state.user.role==='admin'){state.adminDate=new Date();state.adminFilter='All';toast('Welcome, administrator!');go(11);}
   else {toast('Welcome back!');go(3);}
 } catch(err){toast(err.message||'Unable to sign in.');}
 finally {button.disabled=false;}
};
$('#register-form').onsubmit=async e=>{
 e.preventDefault();
 const email=$('#reg-email').value.trim();
 const studentId=$('#reg-id').value.trim();
 if(!window.ConfabAuthService.isValidStudentId(studentId)){toast('Student ID must be exactly 8 digits and start with 2026 (example: 20261234).');$('#reg-id').focus();return;}
 if(!window.ConfabAuthService.isXuStudentEmail(email)){toast('Use firstnamelastname@my.xu.edu.ph. Enter letters only before @my.xu.edu.ph.');$('#reg-email').focus();return;}
 const button=$('#register-form button[type=submit]');button.disabled=true;
 try {
   const result=await window.ConfabAuthService.signUp({
     name:$('#reg-name').value,studentId:studentId,college:$('#reg-college').value,
     email:$('#reg-email').value,password:$('#reg-password').value
   });
   if(result.error){toast(result.error);return;}
   if(result.needsEmailConfirmation){$('#register-form').reset();toast('Account created in Supabase. Verify '+result.email+' using the link sent to your inbox, then log in.');go(1);return;}
   state.user=result.user;state.guest=false;persistState();$('#register-form').reset();toast('Student account created successfully.');go(3);
 } catch(err){toast(err.message||'Unable to register.');}
 finally {button.disabled=false;}
};
$('#reservation-form').onsubmit=async e=>{
 e.preventDefault(); const button=$('#reservation-form button[type=submit]'); button.disabled=true;
 try {
  const result=await window.ConfabDataService.createReservation(state,{roomId:state.selectedRoom,date:dateISO(state.selectedDate),times:state.selectedSlots,attendees:Number($('#attendees').value),purpose:$('#purpose').value});
  if(result.error){toast(result.error);if(/available|reserved|blocked|slot/i.test(result.error))go(4);return;}
  state.selectedReservation=result.reservation.id; await window.ConfabDataService.loadPrivate(state); toast('Reservation saved successfully.'); go(6);
 } catch(err){toast(err.message||'Could not save reservation.');} finally{button.disabled=false;}
};

$('#remove-reservation').onclick = () => {
  if (!state.user) { toast('Please log in to cancel a reservation.'); go(1); return; }
  if (state.user.role === 'admin') { toast('Administrators cannot cancel student reservations here.'); return; }
  const r=state.reservations.find(x=>x.id===Number(state.selectedReservation));
  if(!r||r.userId!==state.user.id){toast('You are not authorized to cancel this reservation.');return;}
  if(r.status!=='Active'){toast('This reservation is no longer active.');return;}
  openModal('Cancel this Reservation?','This slot will be released so other students can book it.',async()=>{
    const result=await window.ConfabDataService.cancelReservation(state,r.id,'Cancelled by student');
    if(result.error){toast(result.error);return;} await window.ConfabDataService.loadPrivate(state); go(7); toast('Reservation cancelled.');
  });
};
$('#logout-btn').onclick=async()=>{try{await window.ConfabAuthService.signOut();}catch(err){toast(err.message||'Sign out failed.');return;}state.user=null;state.guest=true;persistState();toast('You have logged out.');go(1)};
$('#staff-cancel').onclick=()=>{const r=state.reservations.find(x=>x.id===Number(state.selectedReservation));if(!r)return;if(!$('#staff-cancel-reason').value.trim()){toast('Enter a reason for cancelling.');return}openModal('Cancel reservation?','The student will be notified of this cancellation.',async()=>{const result=await window.ConfabDataService.cancelReservation(state,r.id,$('#staff-cancel-reason').value.trim(),true);if(result.error){toast(result.error);return;}await window.ConfabDataService.refresh(state);go(11);toast('Reservation cancelled and notification sent.')})};
$('#add-room').onclick=()=>{state.editingRoom=null;go(14)};
document.addEventListener('change',async e=>{const editorSwitch=e.target.closest('#edit-room-active');if(editorSwitch){$('#room-active-label').textContent=editorSwitch.checked?'Room is Active':'Room Inactive';return;}const t=e.target.closest('[data-toggle-room]');if(t){const result=await window.ConfabDataService.setRoomActive(Number(t.dataset.toggleRoom),t.checked);if(result.error){toast(result.error);await go(13);return;}await window.ConfabDataService.loadPublic(state);renderManageRooms();toast(`Room ${t.checked?'activated':'deactivated'}.`);}});
$('#room-form').onsubmit=async e=>{e.preventDefault();const data={name:$('#edit-room-name').value.trim(),capacity:Number($('#edit-room-capacity').value),description:$('#edit-room-description').value.trim(),active:$('#edit-room-active').checked};if(!data.name||!Number.isInteger(data.capacity)||data.capacity<1){toast('Enter a room name and valid capacity.');return;}const result=await window.ConfabDataService.saveRoom(data,state.editingRoom);if(result.error){toast(result.error);return;}await window.ConfabDataService.loadPublic(state);toast('Room saved to Supabase.');go(13)};
$('#delete-room').onclick=()=>{const r=roomById(state.editingRoom);if(!r)return;openModal('Delete room?',`Delete ${r.name}? This cannot be undone.`,async()=>{const result=await window.ConfabDataService.deleteRoom(r.id);if(result.error){toast(result.error);return;}await window.ConfabDataService.loadPublic(state);go(13);toast('Room deleted.')})};
$('#rules-form').onsubmit=async e=>{e.preventDefault();const rules={open:$('#rule-open').value,close:$('#rule-close').value,slot:Number($('#rule-slot').value),maxSlots:Number($('#rule-max-slots').value),maxActive:Number($('#rule-active').value),days:Number($('#rule-days').value),reminder:Number($('#rule-reminder').value),history:Number($('#rule-history').value)};if(rules.open>=rules.close||Object.values(rules).some(v=>typeof v==='number'&&(!Number.isFinite(v)||v<1))){toast('Check the booking rule values.');return;}const result=await window.ConfabDataService.saveRules(rules);if(result.error){toast(result.error);return;}await window.ConfabDataService.loadPublic(state);renderRules();toast('Booking rules saved to Supabase.')};
$('#block-form').onsubmit=async e=>{e.preventDefault();const block={roomId:Number($('#block-room').value),date:$('#block-date').value,from:$('#block-from').value,to:$('#block-to').value,reason:$('#block-reason').value.trim()};const result=await window.ConfabDataService.addBlock(block);if(result.error){toast(result.error);return;}await window.ConfabDataService.loadPublic(state);$('#block-reason').value='';renderBlocks();toast('Time slot blocked in Supabase.')};
go(1);
(async()=>{try{await window.ConfabDataService.loadPublic(state);}catch(err){console.warn('Initial Supabase load:',err.message);toast('Connect to the internet to load live rooms.');}try{const restored=await window.ConfabAuthService.restoreSession();if(restored){state.user=restored;state.guest=false;await window.ConfabDataService.refresh(state);if(restored.role==='admin'){state.adminDate=new Date();go(11);}else go(3);}}catch(err){console.warn('Session restore:',err.message);}})();
