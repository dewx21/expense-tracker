// ---------- calendar.js : date ribbon + selected-day detail panels ----------
import { state } from './state.js';
import { DAY, iso, todayISO } from './utils.js';
import { renderTasksFor } from './tasks.js';
import { renderExpensesFor } from './finance.js';
import { renderNotesFor } from './modals.js';

export let selected = todayISO;
export function setSelected(dateStr){ selected = dateStr; renderSchedulePage(); }

export function renderRibbon(){
  const ribbon = document.getElementById('ribbon'); if (!ribbon) return;
  ribbon.innerHTML = '';
  const base = new Date(selected); const dow = (base.getDay()+6)%7;
  const monday = new Date(base.getTime() - dow*DAY);
  for (let i=0;i<7;i++){
    const d = new Date(monday.getTime() + i*DAY); const dStr = iso(d);
    const el = document.createElement('div'); el.className = 'day-chip' + (dStr===selected?' sel':'') + (dStr===todayISO?' today':'');
    const hasItems = (state.tasks[dStr]&&state.tasks[dStr].length) || (state.expenses[dStr]&&state.expenses[dStr].length) || (state.notes[dStr]&&state.notes[dStr].length);
    if (hasItems) el.classList.add('has');
    el.innerHTML = `<small>${d.toLocaleString('default',{weekday:'short'})}</small><b>${d.getDate()}</b><div class="dot"></div>`;
    el.onclick = () => setSelected(dStr);
    ribbon.appendChild(el);
  }
  const label = document.getElementById('monthLabel'); if (label) label.textContent = base.toLocaleString('default',{month:'long',year:'numeric'});
}

export function renderSchedulePage(){
  renderRibbon();
  const head = document.getElementById('dayHead');
  if (head) head.textContent = new Date(selected).toLocaleDateString('default',{weekday:'long',day:'numeric',month:'long'});
  renderTasksFor(selected, document.getElementById('taskList'));
  renderExpensesFor(selected, document.getElementById('expList'));
  renderNotesFor(selected, document.getElementById('noteList'));
  const total = (state.expenses[selected]||[]).reduce((s,e)=>s+Number(e.amt),0);
  const dayTotal = document.getElementById('dayTotal'); if (dayTotal) dayTotal.textContent = '₹' + total.toLocaleString('en-IN');
}