// ---------- state.js : single source of truth for app data ----------
import { iso, todayISO } from './utils.js';

const KEY = 'ledger_app_state_v2';

function blank(){
  return {
    tasks:{}, expenses:{}, notes:{}, deposits:[], events:[],
    startBalance:null, startDate:todayISO,
    taskCats:['Work','Personal','Study'], expCats:['Food','Travel','Bills','Shopping'],
    payees:['Shopkeeper','Friend','Family','Online'],
    filters:{ task:['Work','Personal','Study'], exp:['Food','Travel','Bills','Shopping'] },
    savingsMoves:[], borrows:[], lenders:['Friend','Family','Classmate','Other'],
    updatedAt:0
  };
}

function load(){
  try{
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s) return s;
  }catch(e){}
  // migrate from the old single-file version if present
  try{
    const old = JSON.parse(localStorage.getItem('ledger_app_state_v1'));
    if (old) return mergeIntoBlank(old);
  }catch(e){}
  return blank();
}

function mergeIntoBlank(data){
  const b = blank();
  const merged = Object.assign(b, data);
  merged.notes = merged.notes || {};
  merged.filters = merged.filters || { task:[...merged.taskCats], exp:[...merged.expCats] };
  // old tasks had no "due" field — give each a null default so new UI doesn't choke
  Object.keys(merged.tasks||{}).forEach(d => (merged.tasks[d]||[]).forEach(t => { if (t.due===undefined) t.due=null; }));
  delete merged.fixedDefs; delete merged.fixedPaid; delete merged.deductMode;
  return merged;
}

export let state = load();

export function save(){
  state.updatedAt = Date.now();
  try{ localStorage.setItem(KEY, JSON.stringify(state)); }catch(e){ console.error('save failed', e); }
  window.dispatchEvent(new CustomEvent('store:change'));
  pushCloud();
}

// swap in data that came from Drive (does NOT trigger a new upload)
export function replaceState(data){
  state = mergeIntoBlank(data);
  try{ localStorage.setItem(KEY, JSON.stringify(state)); }catch(e){ console.error('save failed', e); }
}

// one-time import of an old backup file (it is then saved to Drive automatically)
export function importData(file, onDone){
  const reader = new FileReader();
  reader.onload = ev => {
    try{
      const data = JSON.parse(ev.target.result);
      state = mergeIntoBlank(data);
      save(); onDone && onDone(true);
    }catch(err){ onDone && onDone(false); }
  };
  reader.readAsText(file);
}

// ---------- cloud sync hook (sync.js registers the handler after sign-in) ----------
let pushTimer = null;
let cloudHandler = null;
export function setCloudHandler(fn){ cloudHandler = fn; }
function pushCloud(){
  clearTimeout(pushTimer);
  if (!cloudHandler) return;
  pushTimer = setTimeout(() => cloudHandler(), 2000);   // wait 2s after the last change
}

// ---------- derived finance helpers (pure functions over state) ----------
export function allExpenseItems(){
  const items = []; Object.keys(state.expenses).forEach(d => state.expenses[d].forEach(e => items.push({...e, date:d})));
  return items;
}
export function effDate(e){ return (e.preDeducted && e.addedOn) ? e.addedOn : e.date; }
export function allSpentUpTo(dateStr){
  return allExpenseItems().filter(e => effDate(e) >= state.startDate && effDate(e) <= dateStr).reduce((s,e)=>s+Number(e.amt),0);
}
export function allDepositedUpTo(dateStr){
  return state.deposits.filter(d => d.date >= state.startDate && d.date <= dateStr).reduce((a,d)=>a+Number(d.amt),0);
}
export function borrowedInUpTo(dateStr){ return (state.borrows||[]).filter(b=>b.date<=dateStr).reduce((s,b)=>s+Number(b.amt),0); }
export function borrowRepaidUpTo(dateStr){ return (state.borrows||[]).filter(b=>b.paid&&b.paidDate&&b.paidDate<=dateStr).reduce((s,b)=>s+Number(b.amt),0); }
export function savingsOutToWalletUpTo(dateStr){ return (state.savingsMoves||[]).filter(m=>m.type==='withdraw'&&m.date<=dateStr).reduce((s,m)=>s+Number(m.amt),0); }
export function savingsInFromWalletUpTo(dateStr){ return (state.savingsMoves||[]).filter(m=>m.type==='deposit'&&m.date<=dateStr).reduce((s,m)=>s+Number(m.amt),0); }
export function walletBalanceAsOf(dateStr){
  if (state.startBalance===null || state.startBalance===undefined) return 0;
  const pool = Number(state.startBalance) + allDepositedUpTo(dateStr) + borrowedInUpTo(dateStr) + savingsOutToWalletUpTo(dateStr);
  const out = allSpentUpTo(dateStr) + savingsInFromWalletUpTo(dateStr) + borrowRepaidUpTo(dateStr);
  return pool - out;
}
export function savingsBalance(){ return (state.savingsMoves||[]).reduce((s,m)=>s+(m.type==='deposit'?Number(m.amt):-Number(m.amt)),0); }
export function debtOwed(){ return (state.borrows||[]).filter(b=>!b.paid).reduce((s,b)=>s+Number(b.amt),0); }
export function futureExpenses(){
  const items = []; Object.keys(state.expenses).forEach(d => { if (d>todayISO) state.expenses[d].forEach(e => { if (!e.paid) items.push({...e,date:d}); }); });
  return items.sort((a,b)=>a.date<b.date?-1:1);
}