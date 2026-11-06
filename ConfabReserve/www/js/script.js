const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const state = {
  screen: 1, user: null, guest: true, selectedRoom: 1, selectedDate: new Date(2026,10,3),
  selectedSlots: [], selectedReservation: null, editingRoom: null, activeResTab: 'upcoming',
  adminFilter: 'All', adminDate: new Date(2026,10,3), roomDateOffset: 0,
  rooms: [
    {id:1,name:'Confab Room A',capacity:8,description:'Annex Library confab room',active:true},
    {id:2,name:'Confab Room B',capacity:6,description:'Annex Library confab room',active:true},
    {id:3,name:'Confab Room C',capacity:10,description:'Annex Library confab room',active:true}
  ],
  reservations: [
    {id:101,roomId:1,date:'2026-11-03',start:'09:00',end:'11:00',attendees:5,purpose:'Group Discussion',name:'Larrazabal',studentId:'20002',status:'Active'},
    {id:102,roomId:2,date:'2026-11-03',start:'10:00',end:'11:00',attendees:3,purpose:'Project Meeting',name:'Juan Dela Cruz',studentId:'20001',status:'Active'},
    {id:103,roomId:1,date:'2026-11-03',start:'13:00',end:'14:00',attendees:4,purpose:'Thesis discussion',name:'Sample Student',studentId:'20003',status:'Active'},
    {id:104,roomId:3,date:'2026-11-02',start:'13:00',end:'15:00',attendees:5,purpose:'Study group',name:'Sample Student',studentId:'20003',status:'Completed'}
  ],
  blocks: [
    {id:1,roomId:2,date:'2026-11-05',from:'00:00',to:'23:59',reason:'Maintenance'},
    {id:2,roomId:3,date:'2026-11-06',from:'08:00',to:'10:00',reason:'Library event'}
  ],
  notifications: [
    {title:'Reminder',message:'Confab Room starts in 30 minutes',time:'10:30 AM',unread:true},
    {title:'Cancelled By The Library',message:'Your reservation has been cancelled',time:'Yesterday',unread:false},
    {title:'Reservation Confirmed',message:'You Confirmed Room B',time:'31st October',unread:false},
    {title:'Reservation Cancelled',message:'You Cancelled Room C',time:'31st October',unread:false}
  ],
  rules:{open:'05:00',close:'20:00',slot:60,maxSlots:2,maxActive:2,days:7,reminder:30,history:30}
};
let toastTimer;
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2600)}
function dateISO(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function prettyDate(iso){return new Date(iso+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'})}
function roomById(id){return state.rooms.find(r=>r.id===Number(id))}
function go(n){
  const adminScreens=[11,12,13,14,15,16];
  if(adminScreens.includes(n)&&state.user?.role!=='admin'){toast('This section is for library staff only.');return}
  if([7,8,9,10].includes(n)&&state.user?.role==='admin'){toast('That page is part of the student area.');go(11);return}
  state.screen=n;$$('.screen').forEach(s=>s.classList.toggle('active',Number(s.dataset.screen)===n));if(n===3)renderRooms();if(n===4)renderAvailability();if(n===5)renderBookingForm();if(n===6)renderConfirmation();if(n===7)renderMyReservations();if(n===8)renderReservationDetail();if(n===9)renderNotifications();if(n===10)renderProfile();if(n===11)renderAdminReservations();if(n===12)renderAdminDetail();if(n===13)renderManageRooms();if(n===14)renderRoomEditor();if(n===15)renderRules();if(n===16)renderBlocks();$('.screen.active').scrollTop=0}
function roomReservations(roomId,date){return state.reservations.filter(r=>r.roomId===roomId&&r.date===date&&r.status==='Active')}
function isBlocked(roomId,date,time){return state.blocks.some(b=>b.roomId===roomId&&b.date===date&&time>=b.from&&time<b.to)}
function slotStatus(roomId,date,time){
  if(isBlocked(roomId,date,time))return 'blocked';
  if(roomReservations(roomId,date).some(r=>time>=r.start&&time<r.end))return 'taken';
  return 'available';
}
function slotsForDay(){return ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00']}
function timeLabel(t){let [h,m]=t.split(':').map(Number);return `${h%12||12}${m?':'+String(m).padStart(2,'0'):''} ${h<12?'AM':'PM'}`}
function renderRooms(){
  const date=new Date(2026,10,3+state.roomDateOffset);state.selectedDate=date;$('#rooms-date-label').textContent=state.roomDateOffset===0?'Today, '+date.toLocaleDateString('en-US',{weekday:'short',day:'numeric',month:'short'}):date.toLocaleDateString('en-US',{weekday:'short',day:'numeric',month:'short'});
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
function renderBookingForm(){const room=roomById(state.selectedRoom);const times=state.selectedSlots.slice().sort();const start=times[0],end=`${String(Number(start.slice(0,2))+times.length).padStart(2,'0')}:00`;$('#booking-summary').innerHTML=`<strong>${room.name}</strong><br>${prettyDate(dateISO(state.selectedDate))}<br>${times.map(timeLabel).join(', ')} (${times.length} slot${times.length>1?'s':''})`;$('#booking-name').value=state.user?.name||'';$('#attendee-max').textContent=room.capacity;$('#attendees').max=room.capacity;$('#attendees').value=Math.min(5,room.capacity);$('#purpose').value='';}
function renderConfirmation(){const r=state.reservations.find(x=>x.id===state.selectedReservation);if(!r)return;$('#confirmation-details').innerHTML=detailRows(r)}
function detailRows(r){const room=roomById(r.roomId);return `<div class="detail-row"><span>Room:</span><strong>${room?.name||'Room'}</strong></div><div class="detail-row"><span>Date:</span><strong>${prettyDate(r.date)}</strong></div><div class="detail-row"><span>Time:</span><strong>${timeLabel(r.start)}–${timeLabel(r.end)}</strong></div><div class="detail-row"><span>Attendees:</span><strong>${r.attendees}</strong></div><div class="detail-row"><span>Status:</span><strong>${r.status}</strong></div>`}
function renderMyReservations(){
  const mine=state.reservations.filter(r=>state.user? r.studentId===state.user.studentId : r.studentId==='20001');
  const list=mine.filter(r=>state.activeResTab==='upcoming'?r.status==='Active':r.status!=='Active');
  $('#my-reservations').innerHTML=list.length?list.map(r=>`<article class="res-card"><div class="res-card-head"><strong>${roomById(r.roomId)?.name||'Room'}</strong><span class="status ${r.status.toLowerCase()}">${r.status}</span></div><p>${prettyDate(r.date)} · ${timeLabel(r.start)} – ${timeLabel(r.end)}</p><p>${r.attendees} Attendees</p><button data-reservation="${r.id}">Details ›</button><div style="clear:both"></div></article>`).join(''):'<p class="hint">No reservations to show.</p>';
}
function renderReservationDetail(){const r=state.reservations.find(x=>x.id===state.selectedReservation);if(!r)return;$('#reservation-detail-card').innerHTML=detailRows(r)+`<div class="detail-row"><span>Purpose:</span><strong>${r.purpose}</strong></div>`;$('#cancel-area').style.display=r.status==='Active'?'flex':'none'}
function renderNotifications(){$('#notification-list').innerHTML=state.notifications.map(n=>`<article class="notification-card ${n.unread?'unread':''}"><strong>${n.title}</strong>${n.message}<small>${n.time}</small></article>`).join('')}
function renderProfile(){const u=state.user;$('#profile-name').textContent=u?.name||'Guest Student';$('#profile-avatar').textContent=(u?.name||'GS').split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();const roleLabel=$('#profile-role');if(roleLabel)roleLabel.textContent=u?.role==='admin'?'Library Staff / Administrator':'Student';$('#profile-info').innerHTML=`<div>${u?.role==='admin'?'Staff ID':'Student ID'}: <strong>${u?.studentId||'Guest'}</strong></div><div>${u?.role==='admin'?'Department':'College'}: <strong>${u?.college||'Not signed in'}</strong></div><div>Email: <strong>${u?.email||'—'}</strong></div>${u?.role==='admin'?'<div>Access: <strong>Admin Management</strong></div>':`<div>Active Reservation: <strong>${state.reservations.filter(r=>r.studentId===(u?.studentId||'20001')&&r.status==='Active').length}</strong></div>`}`}
function renderAdminReservations(){const date=dateISO(state.adminDate);$('#admin-date-label').textContent=state.adminDate.toLocaleDateString('en-US',{weekday:'short',day:'numeric',month:'short',year:'numeric'});const rows=state.reservations.filter(r=>r.date===date&&r.status==='Active'&&(state.adminFilter==='All'||roomById(r.roomId)?.name===state.adminFilter));$('#admin-reservations').innerHTML=rows.length?rows.map(r=>`<div class="admin-row"><div><strong>${timeLabel(r.start)} · ${roomById(r.roomId)?.name}</strong><br>${r.name} · ${r.studentId}<br>Attendees: ${r.attendees}</div><button data-admin-res="${r.id}">Details</button></div>`).join(''):'<p class="hint">No reservations for this date and filter.</p>'}
function renderAdminDetail(){const r=state.reservations.find(x=>x.id===state.selectedReservation);if(!r)return;$('#admin-detail-card').innerHTML=detailRows(r)+`<div class="detail-row"><span>Reserved by:</span><strong>${r.name}</strong></div><div class="detail-row"><span>Student ID:</span><strong>${r.studentId}</strong></div><div class="detail-row"><span>College:</span><strong>${r.college||'College Name'}</strong></div><div class="detail-row"><span>Purpose:</span><strong>${r.purpose}</strong></div>`}
function renderManageRooms(){$('#manage-room-list').innerHTML=state.rooms.map(r=>`<div class="manage-card"><strong>${r.name}</strong><small>Capacity ${r.capacity}</small><div class="manage-actions"><button class="edit-link" data-edit-room="${r.id}">Edit</button><label class="switch"><input type="checkbox" data-toggle-room="${r.id}" ${r.active?'checked':''}><span></span></label></div></div>`).join('')}
function renderRoomEditor(){const r=state.rooms.find(x=>x.id===state.editingRoom);$('#room-editor-title').textContent=r?'Edit Rooms':'Add Room';$('#edit-room-name').value=r?.name||'';$('#edit-room-capacity').value=r?.capacity||'';$('#edit-room-description').value=r?.description||'';$('#edit-room-active').checked=r?.active??true;$('#delete-room').style.display=r?'block':'none'}
function renderRules(){const r=state.rules;$('#rule-open').value=r.open;$('#rule-close').value=r.close;$('#rule-slot').value=r.slot;$('#rule-max-slots').value=r.maxSlots;$('#rule-active').value=r.maxActive;$('#rule-days').value=r.days;$('#rule-reminder').value=r.reminder;$('#rule-history').value=r.history}
function renderBlocks(){$('#block-room').innerHTML=state.rooms.map(r=>`<option value="${r.id}">${r.name}</option>`).join('');if(!$('#block-date').value)$('#block-date').value='2026-11-05';$('#current-blocks').innerHTML=state.blocks.map(b=>`<div class="current-block"><span>${roomById(b.roomId)?.name} · ${prettyDate(b.date)}<br>${b.from==='00:00'&&b.to==='23:59'?'All day':timeLabel(b.from)+'–'+timeLabel(b.to)} · ${b.reason}</span><button data-remove-block="${b.id}">Remove</button></div>`).join('')||'<p class="hint">No current blocks.</p>'}
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
 const remove=e.target.closest('[data-remove-block]');if(remove){state.blocks=state.blocks.filter(b=>b.id!==Number(remove.dataset.removeBlock));renderBlocks();toast('Block removed.');return}
});
$('#rooms-prev').onclick=()=>{state.roomDateOffset=Math.max(0,state.roomDateOffset-1);renderRooms()};
$('#rooms-next').onclick=()=>{state.roomDateOffset=Math.min(7,state.roomDateOffset+1);renderRooms()};
$('#admin-prev').onclick=()=>{state.adminDate.setDate(state.adminDate.getDate()-1);renderAdminReservations()};
$('#admin-next').onclick=()=>{state.adminDate.setDate(state.adminDate.getDate()+1);renderAdminReservations()};
$('#reserve-selected').onclick=()=>{if(!state.selectedSlots.length){toast('Select at least one available time slot.');return}if(!state.user){toast('Please log in to reserve a room.');go(1);return}go(5)};
$('#login-form').onsubmit=e=>{
 e.preventDefault();
 const email=$('#login-email').value.trim().toLowerCase();
 const password=$('#login-password').value;
 if(email==='admin@confab.test'&&password==='admin123'){
  state.user={name:'Library Administrator',studentId:'ADMIN-001',college:'Annex Library',email,role:'admin'};
  state.guest=false;state.adminDate=new Date(2026,10,3);state.adminFilter='All';
  toast('Welcome, Library Administrator!');go(11);return;
 }
 if(email==='student@confab.test'&&password==='student123'){
  state.user={name:'Juan Dela Cruz',studentId:'20001',college:'College of Computer Studies',email,role:'student'};
  state.guest=false;toast('Welcome back!');go(3);return;
 }
 toast('Invalid email or password. Please use a valid demo account.');
};
$('#register-form').onsubmit=e=>{e.preventDefault();state.user={name:$('#reg-name').value.trim(),studentId:$('#reg-id').value.trim(),college:$('#reg-college').value,email:$('#reg-email').value.trim(),role:'student'};state.guest=false;toast('Account created. You can now reserve a room.');go(3)};
$('#reservation-form').onsubmit=e=>{
 e.preventDefault();const room=roomById(state.selectedRoom),attendees=Number($('#attendees').value),times=state.selectedSlots.slice().sort();
 if(!state.user){toast('Log in before reserving.');go(1);return}
 if(attendees<1||attendees>room.capacity){toast(`Attendees must be between 1 and ${room.capacity}.`);return}
 if(!$('#purpose').value.trim()){toast('Please enter the purpose of your reservation.');return}
 if(times.some(t=>slotStatus(room.id,dateISO(state.selectedDate),t)!=='available')){toast('A selected slot is no longer available. Please choose again.');go(4);return}
 if(state.reservations.filter(r=>r.studentId===state.user.studentId&&r.status==='Active').length>=state.rules.maxActive){toast('You have reached the active reservation limit.');return}
 for(let i=1;i<times.length;i++){if(Number(times[i].slice(0,2))-Number(times[i-1].slice(0,2))!==1){toast('Choose consecutive slots for one reservation.');return}}
 const start=times[0],endHour=Number(times[times.length-1].slice(0,2))+1;
 const reservation={id:Date.now(),roomId:room.id,date:dateISO(state.selectedDate),start,end:`${String(endHour).padStart(2,'0')}:00`,attendees,purpose:$('#purpose').value.trim(),name:state.user.name,studentId:state.user.studentId,college:state.user.college,status:'Active'};
 if(state.reservations.some(r=>r.roomId===room.id&&r.date===reservation.date&&r.status==='Active'&&isOverlap(reservation.start,reservation.end,r.start,r.end))){toast('That time has just been reserved by another user.');go(4);return}
 state.reservations.unshift(reservation);state.selectedReservation=reservation.id;state.notifications.unshift({title:'Reservation Confirmed',message:`${room.name} reservation confirmed`,time:'Just now',unread:true});go(6)
};
$('#remove-reservation').onclick=()=>openModal('Cancel this Reservation?','This slot will be released so other students can book it.',()=>{const r=state.reservations.find(x=>x.id===state.selectedReservation);if(r){r.status='Cancelled';state.notifications.unshift({title:'Reservation Cancelled',message:`Your ${roomById(r.roomId)?.name} reservation was cancelled`,time:'Just now',unread:true})}go(7);toast('Reservation cancelled.')});
$('#logout-btn').onclick=()=>{state.user=null;state.guest=true;toast('You have logged out.');go(1)};
$('#staff-cancel').onclick=()=>{const r=state.reservations.find(x=>x.id===state.selectedReservation);if(!r)return;if(!$('#staff-cancel-reason').value.trim()){toast('Enter a reason for cancelling.');return}openModal('Cancel reservation?','The student will be notified of this cancellation.',()=>{r.status='Cancelled by Staff';r.cancelReason=$('#staff-cancel-reason').value;state.notifications.unshift({title:'Cancelled By The Library',message:r.cancelReason,time:'Just now',unread:true});go(11);toast('Reservation cancelled and notification added.')})};
$('#add-room').onclick=()=>{state.editingRoom=null;go(14)};
$$('[data-toggle-room]').forEach(()=>{});document.addEventListener('change',e=>{const t=e.target.closest('[data-toggle-room]');if(t){const r=roomById(t.dataset.toggleRoom);r.active=t.checked;toast(`${r.name} ${r.active?'activated':'deactivated'}.`);}});
$('#room-form').onsubmit=e=>{e.preventDefault();const data={name:$('#edit-room-name').value.trim(),capacity:Number($('#edit-room-capacity').value),description:$('#edit-room-description').value.trim(),active:$('#edit-room-active').checked};if(state.editingRoom){Object.assign(roomById(state.editingRoom),data)}else{state.rooms.push({id:Math.max(0,...state.rooms.map(r=>r.id))+1,...data})}toast('Room saved.');go(13)};
$('#delete-room').onclick=()=>{const r=roomById(state.editingRoom);if(!r)return;if(state.reservations.some(x=>x.roomId===r.id&&x.status==='Active')){toast('Room has active reservations and cannot be deleted.');return}openModal('Delete room?',`Delete ${r.name}? This cannot be undone.`,()=>{state.rooms=state.rooms.filter(x=>x.id!==r.id);go(13);toast('Room deleted.')})};
$('#rules-form').onsubmit=e=>{e.preventDefault();state.rules={open:$('#rule-open').value,close:$('#rule-close').value,slot:Number($('#rule-slot').value),maxSlots:Number($('#rule-max-slots').value),maxActive:Number($('#rule-active').value),days:Number($('#rule-days').value),reminder:Number($('#rule-reminder').value),history:Number($('#rule-history').value)};toast('Booking rules saved.')};
$('#block-form').onsubmit=e=>{e.preventDefault();const roomId=Number($('#block-room').value),date=$('#block-date').value,from=$('#block-from').value,to=$('#block-to').value,reason=$('#block-reason').value.trim();if(!date||!reason||from>=to){toast('Enter a valid date, time range, and reason.');return}const conflict=state.reservations.find(r=>r.roomId===roomId&&r.date===date&&r.status==='Active'&&isOverlap(from,to,r.start,r.end));if(conflict){toast('An active reservation overlaps this block. Cancel it first.');return}state.blocks.push({id:Date.now(),roomId,date,from,to,reason});$('#block-reason').value='';renderBlocks();toast('Time slot blocked.')};


go(1);