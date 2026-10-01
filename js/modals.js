// ---------- modals.js : generic modal plumbing + Add-popover + Event & Note modals ----------
import { state, save, walletBalanceAsOf, savingsBalance } from './state.js';
import { esc, fmt, todayISO, uid } from './utils.js';

export function openModal(id){ document.getElementById(id).classList.add('show'); }
export function closeModal(id){ document.getElementById(id).classList.remove('show'); }

export function populateCatSelect(sel, list, label){
  sel.innerHTML = list.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('') +
    `<option value="__add__">+ Add new ${label||'category'}…</option>`;
}
export function wireCatAdd(selId, addId, inputId, btnId, catsKey, filterKey, label){
  const sel = document.getElementById(selId), addRow = document.getElementById(addId),
        input = document.getElementById(inputId), btn = document.getElementById(btnId);
  sel.onchange = () => {
    if (sel.value === '__add__'){ addRow.style.display='flex'; input.value=''; input.focus(); sel.value=state[catsKey][0]||''; }
    else addRow.style.display='none';
  };
  btn.onclick = () => {
    const name = input.value.trim(); if (!name) return;
    if (!state[catsKey].some(c=>c.toLowerCase()===name.toLowerCase())){ state[catsKey].push(name); if (filterKey) state.filters[filterKey].push(name); save(); }
    populateCatSelect(sel, state[catsKey], label); sel.value = name; addRow.style.display='none';
  };
}

// ---------- "Add" popover (Event / Task / Note) ----------
export function initAddPopover({ onTask, onEvent, onNote }){
  const btn = document.getElementById('addMenuBtn');
  const pop = document.getElementById('addPopover');
  btn.onclick = (e) => { e.stopPropagation(); pop.classList.toggle('show'); };
  document.addEventListener('click', () => pop.classList.remove('show'));
  document.getElementById('addEventOpt').onclick = () => { pop.classList.remove('show'); onEvent(); };
  document.getElementById('addTaskOpt').onclick = () => { pop.classList.remove('show'); onTask(); };
  document.getElementById('addNoteOpt').onclick = () => { pop.classList.remove('show'); onNote(); };
}

// ---------- payment shortfall confirm ----------
let pendingPayment = null;
export function attemptPayment(amount, description, onSuccess){
  const bal = walletBalanceAsOf(todayISO);
  if (bal >= amount){ onSuccess(); return; }
  const shortfall = amount - bal, sav = savingsBalance();
  if (sav >= shortfall){
    pendingPayment = { shortfall, onSuccess };
    document.getElementById('confirmMsg').textContent = `Your wallet is short by ₹${fmt(shortfall)} for "${description}". Pull ₹${fmt(shortfall)} from savings to cover it?`;
    openModal('ovConfirm');
  } else {
    alert(`Not enough in your wallet or savings to cover "${description}" (short by ₹${fmt(shortfall-sav)}). You could record this as borrowed money instead.`);
  }
}
document.getElementById('confirmYes').onclick = () => {
  if (!pendingPayment) return;
  state.savingsMoves.push({ type:'withdraw', amt:pendingPayment.shortfall, note:'Auto-used to cover a payment shortfall', date:todayISO });
  const cb = pendingPayment.onSuccess; pendingPayment = null;
  save(); closeModal('ovConfirm'); cb();
};
document.getElementById('confirmNo').onclick = () => { pendingPayment = null; closeModal('ovConfirm'); };

// ---------- Event modal (date-range banner) ----------
export function openEventModal(selectedDate){
  document.getElementById('vTitle').value = '';
  document.getElementById('vStart').value = selectedDate;
  document.getElementById('vEnd').value = selectedDate;
  openModal('ovEvent');
}
document.getElementById('saveEvent').onclick = () => {
  const title = document.getElementById('vTitle').value.trim();
  const cat = document.getElementById('vCat').value;
  const s = document.getElementById('vStart').value, e = document.getElementById('vEnd').value;
  if (!title || !s || !e || e < s) return;
  state.events = state.events || [];
  state.events.push({ id: uid('ev'), title, cat, start:s, end:e });
  save(); closeModal('ovEvent');
  window.dispatchEvent(new CustomEvent('data:changed'));
};
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => closeModal(b.dataset.close));

// ---------- Note modal ----------
let editingNoteRef = null;
export function openNoteModal(selectedDate){
  editingNoteRef = null;
  document.getElementById('noteModalTitle').textContent = 'New note';
  document.getElementById('nTitle').value = ''; document.getElementById('nBody').value = '';
  document.getElementById('nDate').value = selectedDate;
  openModal('ovNote');
}
export function openNoteEdit(n, date){
  editingNoteRef = { n, date };
  document.getElementById('noteModalTitle').textContent = 'Edit note';
  document.getElementById('nTitle').value = n.title; document.getElementById('nBody').value = n.body || '';
  document.getElementById('nDate').value = date;
  openModal('ovNote');
}
document.getElementById('saveNote').onclick = () => {
  const title = document.getElementById('nTitle').value.trim(); if (!title) return;
  const body = document.getElementById('nBody').value.trim();
  const date = document.getElementById('nDate').value || todayISO;
  if (editingNoteRef){
    const { n, date: oldDate } = editingNoteRef;
    if (oldDate !== date){ state.notes[oldDate] = (state.notes[oldDate]||[]).filter(x=>x!==n); state.notes[date] = state.notes[date]||[]; state.notes[date].push(n); }
    n.title = title; n.body = body;
  } else {
    state.notes[date] = state.notes[date] || [];
    state.notes[date].push({ id: uid('nt'), title, body });
  }
  editingNoteRef = null; save(); closeModal('ovNote');
  window.dispatchEvent(new CustomEvent('data:changed'));
};

export function renderNotesFor(dateStr, container){
  const notes = state.notes[dateStr] || [];
  container.innerHTML = notes.length ? '' : '<div class="empty">No notes for this day.</div>';
  notes.forEach(n => {
    const row = document.createElement('div'); row.className = 'item-card tone-grey';
    row.innerHTML = `<div class="ic-top"><div class="ic-title">${esc(n.title)}</div>
      <div class="ic-actions"><button class="ic-btn edit-btn" title="Edit">✎</button><button class="ic-btn del-btn" title="Delete">✕</button></div></div>
      ${n.body?`<div class="ic-desc">${esc(n.body)}</div>`:''}`;
    row.querySelector('.edit-btn').onclick = () => openNoteEdit(n, dateStr);
    row.querySelector('.del-btn').onclick = () => { state.notes[dateStr] = state.notes[dateStr].filter(x=>x!==n); save(); window.dispatchEvent(new CustomEvent('data:changed')); };
    container.appendChild(row);
  });
}