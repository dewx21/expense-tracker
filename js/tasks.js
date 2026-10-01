// ---------- tasks.js : task CRUD, subtasks, due dates ----------
import { state, save } from './state.js';
import { esc, todayISO, daysBetween, toneFor, uid } from './utils.js';
import { openModal, closeModal, populateCatSelect, wireCatAdd } from './modals.js';

let modalSubtasks = [];
let editingTaskId = null; // the live task object, or null when adding

wireCatAdd('tCat','tCatAdd','tCatNew','tCatAddBtn','taskCats','task');

function renderModalSubtasks(){
  const wrap = document.getElementById('tSubtaskList');
  wrap.innerHTML = modalSubtasks.length ? modalSubtasks.map((s,i) =>
    `<div class="sub-row"><span style="${s.done?'text-decoration:line-through;opacity:.6':''}">${esc(s.title)}</span><button type="button" data-i="${i}">✕</button></div>`
  ).join('') : '';
  wrap.querySelectorAll('button').forEach(b => b.onclick = () => { modalSubtasks.splice(Number(b.dataset.i),1); renderModalSubtasks(); });
}
document.getElementById('tSubtaskAddBtn').onclick = () => {
  const v = document.getElementById('tSubtaskNew').value.trim(); if (!v) return;
  modalSubtasks.push({ title:v, done:false }); document.getElementById('tSubtaskNew').value=''; renderModalSubtasks();
};

function setDueMode(mode){
  document.getElementById('tDueDaysWrap').style.display = mode==='days' ? 'block':'none';
  document.getElementById('tDueDateWrap').style.display = mode==='date' ? 'block':'none';
}
document.querySelectorAll('input[name="dueMode"]').forEach(r => r.onchange = () => setDueMode(r.value));

export function openTaskModal(selectedDate){
  editingTaskId = null;
  document.querySelector('#ovTask h3').textContent = 'New task';
  document.getElementById('saveTask').textContent = 'Add task';
  document.getElementById('tTitle').value=''; document.getElementById('tDesc').value=''; document.getElementById('tTime').value='';
  document.querySelector('input[name="dueMode"][value="none"]').checked = true; setDueMode('none');
  document.getElementById('tDueDays').value = 1; document.getElementById('tDueDate').value = selectedDate;
  populateCatSelect(document.getElementById('tCat'), state.taskCats); document.getElementById('tCatAdd').style.display='none';
  modalSubtasks = []; renderModalSubtasks();
  document.getElementById('ovTask').dataset.anchorDate = selectedDate;
  openModal('ovTask');
}
function openTaskEdit(t, anchorDate){
  editingTaskId = t;
  document.querySelector('#ovTask h3').textContent = 'Edit task';
  document.getElementById('saveTask').textContent = 'Save changes';
  document.getElementById('tTitle').value = t.title; document.getElementById('tDesc').value = t.desc||''; document.getElementById('tTime').value = t.time||'';
  populateCatSelect(document.getElementById('tCat'), state.taskCats); document.getElementById('tCatAdd').style.display='none';
  document.getElementById('tCat').value = t.cat;
  if (t.due){ document.querySelector('input[name="dueMode"][value="date"]').checked = true; setDueMode('date'); document.getElementById('tDueDate').value = t.due; }
  else { document.querySelector('input[name="dueMode"][value="none"]').checked = true; setDueMode('none'); }
  modalSubtasks = (t.subtasks||[]).map(s => ({ title:s.title, done:s.done })); renderModalSubtasks();
  document.getElementById('ovTask').dataset.anchorDate = anchorDate;
  openModal('ovTask');
}

document.getElementById('saveTask').onclick = () => {
  const title = document.getElementById('tTitle').value.trim(); if (!title) return;
  const cat = document.getElementById('tCat').value, time = document.getElementById('tTime').value, desc = document.getElementById('tDesc').value.trim();
  const dueMode = document.querySelector('input[name="dueMode"]:checked').value;
  const anchorDate = document.getElementById('ovTask').dataset.anchorDate || todayISO;
  let due = null;
  if (dueMode === 'days') due = new Date(Date.now() + Number(document.getElementById('tDueDays').value||1)*86400000).toISOString().slice(0,10);
  else if (dueMode === 'date') due = document.getElementById('tDueDate').value || null;
  const subtasks = modalSubtasks.map(s => ({ title:s.title, done:s.done }));

  if (editingTaskId){
    const t = editingTaskId;
    t.title=title; t.cat=cat; t.time=time; t.desc=desc; t.due=due; t.subtasks=subtasks;
    t.done = subtasks.length ? subtasks.every(s=>s.done) : t.done;
  } else {
    state.tasks[anchorDate] = state.tasks[anchorDate] || [];
    state.tasks[anchorDate].push({ id: uid('tk'), title, cat, time, desc, due, done:false, subtasks });
  }
  editingTaskId = null; save(); closeModal('ovTask');
  window.dispatchEvent(new CustomEvent('data:changed'));
};

export function shiftTaskToTomorrow(t, fromDate){
  const to = new Date(new Date(fromDate).getTime()+86400000).toISOString().slice(0,10);
  state.tasks[fromDate] = (state.tasks[fromDate]||[]).filter(x=>x!==t);
  state.tasks[to] = state.tasks[to]||[]; state.tasks[to].push(t);
  save(); window.dispatchEvent(new CustomEvent('data:changed'));
}

function dueBadge(t){
  if (!t.due) return '';
  const n = daysBetween(todayISO, t.due);
  const label = n < 0 ? `overdue by ${Math.abs(n)}d` : n===0 ? 'due today' : `due in ${n}d`;
  return `<span class="ic-badge">${label}</span>`;
}

export function renderTasksFor(dateStr, container){
  let tasks = (state.tasks[dateStr]||[]).filter(t => state.filters.task.includes(t.cat));
  container.innerHTML = tasks.length ? '' : '<div class="empty">No tasks yet.</div>';
  tasks.forEach(t => {
    t.subtasks = t.subtasks || [];
    const row = document.createElement('div'); row.className = 'item-card ' + toneFor(t.cat);
    row.innerHTML = `
      <div class="ic-top">
        <div style="display:flex;align-items:center;gap:9px;">
          <div class="ic-check ${t.done?'done':''}"></div>
          <div class="ic-title" style="${t.done?'text-decoration:line-through;opacity:.6':''}">${esc(t.title)}</div>
        </div>
        <div class="ic-actions"><button class="ic-btn edit-btn" title="Edit">✎</button><button class="ic-btn shift-btn" title="Shift to tomorrow">→</button><button class="ic-btn del-btn" title="Delete">✕</button></div>
      </div>
      <div class="ic-meta">${esc(t.cat)}${t.time?(' · '+t.time):''}</div>
      ${t.desc?`<div class="ic-desc">${esc(t.desc)}</div>`:''}
      ${dueBadge(t)}
      ${t.subtasks.length?`<div style="margin-top:8px;border-top:1px solid rgba(0,0,0,.08);padding-top:6px;">${t.subtasks.map((s,i)=>`<div class="subtask-row ${s.done?'done':''}" data-si="${i}"><span class="ic-check" style="width:14px;height:14px;${s.done?'background:currentColor':''}"></span>${esc(s.title)}</div>`).join('')}</div>`:''}
    `;
    row.querySelector('.ic-check').onclick = () => { t.done=!t.done; if (t.subtasks.length) t.subtasks.forEach(s=>s.done=t.done); save(); window.dispatchEvent(new CustomEvent('data:changed')); };
    row.querySelectorAll('.subtask-row').forEach(el => el.onclick = () => {
      const si = Number(el.dataset.si); t.subtasks[si].done = !t.subtasks[si].done; t.done = t.subtasks.every(s=>s.done);
      save(); window.dispatchEvent(new CustomEvent('data:changed'));
    });
    row.querySelector('.edit-btn').onclick = () => openTaskEdit(t, dateStr);
    row.querySelector('.shift-btn').onclick = () => shiftTaskToTomorrow(t, dateStr);
    row.querySelector('.del-btn').onclick = () => { state.tasks[dateStr] = state.tasks[dateStr].filter(x=>x!==t); save(); window.dispatchEvent(new CustomEvent('data:changed')); };
    container.appendChild(row);
  });
}