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
    savingsMoves:[], borrows:[], lenders:['Friend','Family','Classmate','Other']
  };
}

function load(){
  try{
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s) return s;
  }catch(e){}
  // migrate from the old single-file version if present, so your exported
  // backup (or the old in-browser data) carries straight over
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
  try{ localStorage.setItem(KEY, JSON.stringify(state)); }catch(e){ console.error('save failed', e); }
  window.dispatchEvent(new CustomEvent('store:change'));
  pushCloud();
}

export function exportData(){
  const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'ledger-export-' + todayISO + '.json'; a.click();
}

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

// ---------- cloud sync (Phase 2 hook — safe no-op until wired to Drive/Supabase) ----------
let pushTimer = null;
function pushCloud(){
  // Placeholder for Phase 2: debounce + push `state` to whatever remote store
  // (Supabase/Firebase/Drive) you end up wiring. Left intentionally inert for now.
  clearTimeout(pushTimer);
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