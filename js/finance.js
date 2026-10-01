// ---------- finance.js : wallet, savings, borrowed money, expenses ----------
import { state, save, walletBalanceAsOf, savingsBalance, debtOwed, futureExpenses, allExpenseItems } from './state.js';
import { esc, fmt, todayISO, toneFor, uid } from './utils.js';
import { openModal, closeModal, populateCatSelect, wireCatAdd, attemptPayment } from './modals.js';

wireCatAdd('eCat','eCatAdd','eCatNew','eCatAddBtn','expCats','exp');
wireCatAdd('ePayee','ePayeeAdd','ePayeeNew','ePayeeAddBtn','payees',null,'payee');
wireCatAdd('bLender','bLenderAdd','bLenderNew','bLenderAddBtn','lenders',null,'lender');

const changed = () => window.dispatchEvent(new CustomEvent('data:changed'));

// ---------- Expense modal (add / edit, future-dated => Waiting) ----------
let editingExpenseRef = null;
export function openExpenseModal(selectedDate){
  editingExpenseRef = null;
  document.getElementById('expenseModalTitle').textContent = 'New expense';
  document.getElementById('saveExpense').textContent = 'Add expense';
  document.getElementById('eTitle').value=''; document.getElementById('eAmt').value=''; document.getElementById('eDesc').value='';
  document.getElementById('eDate').value = selectedDate;
  populateCatSelect(document.getElementById('eCat'), state.expCats); document.getElementById('eCatAdd').style.display='none';
  populateCatSelect(document.getElementById('ePayee'), state.payees, 'payee'); document.getElementById('ePayeeAdd').style.display='none';
  updateFutureNote();
  openModal('ovExpense');
}
export function openExpenseEdit(e, date){
  editingExpenseRef = { e, date };
  document.getElementById('expenseModalTitle').textContent = 'Edit expense';
  document.getElementById('saveExpense').textContent = 'Save changes';
  document.getElementById('eTitle').value = e.title; document.getElementById('eAmt').value = e.amt; document.getElementById('eDesc').value = e.desc||'';
  document.getElementById('eDate').value = date;
  populateCatSelect(document.getElementById('eCat'), state.expCats); document.getElementById('eCatAdd').style.display='none'; document.getElementById('eCat').value = e.cat;
  populateCatSelect(document.getElementById('ePayee'), state.payees, 'payee'); document.getElementById('ePayeeAdd').style.display='none'; if (e.payee) document.getElementById('ePayee').value = e.payee;
  document.getElementById('ePay').value = e.pay || 'UPI';
  updateFutureNote();
  openModal('ovExpense');
}
function updateFutureNote(){
  document.getElementById('eFutureNote').style.display = document.getElementById('eDate').value > todayISO ? 'block' : 'none';
}
document.getElementById('eDate').onchange = updateFutureNote;

document.getElementById('saveExpense').onclick = () => {
  const title = document.getElementById('eTitle').value.trim(); const amt = Number(document.getElementById('eAmt').value);
  const date = document.getElementById('eDate').value; if (!title||!amt||amt<=0||!date) return;
  const cat = document.getElementById('eCat').value, pay = document.getElementById('ePay').value, payee = document.getElementById('ePayee').value;
  const desc = document.getElementById('eDesc').value.trim(); const isFuture = date > todayISO;

  if (editingExpenseRef){
    const { e, date: oldDate } = editingExpenseRef;
    if (oldDate !== date){ state.expenses[oldDate] = (state.expenses[oldDate]||[]).filter(x=>x!==e); state.expenses[date] = state.expenses[date]||[]; state.expenses[date].push(e); }
    e.title=title; e.amt=amt; e.cat=cat; e.pay=pay; e.payee=payee; e.desc=desc;
    e.preDeducted = isFuture; e.addedOn = isFuture ? (e.addedOn||todayISO) : undefined; if (!isFuture) e.paid = undefined;
    editingExpenseRef = null; save(); closeModal('ovExpense'); changed();
    return;
  }
  const push = () => {
    state.expenses[date] = state.expenses[date]||[];
    state.expenses[date].push({ id: uid('ex'), title, amt, cat, pay, payee, desc, addedOn: isFuture?todayISO:date, preDeducted:isFuture, paid:false });
    save(); closeModal('ovExpense'); changed();
  };
  if (isFuture) push(); else attemptPayment(amt, title, push);
};

export function renderExpensesFor(dateStr, container){
  const exps = (state.expenses[dateStr]||[]).filter(e => state.filters.exp.includes(e.cat));
  container.innerHTML = exps.length ? '' : '<div class="empty">No expenses logged.</div>';
  exps.forEach(e => {
    const row = document.createElement('div'); row.className = 'item-card ' + toneFor(e.cat);
    const badge = (e.preDeducted && dateStr > todayISO) ? `<span class="ic-badge">${e.paid?'Paid':'Waiting'} · already deducted</span>` : '';
    row.innerHTML = `
      <div class="ic-top">
        <div class="ic-title">${esc(e.title)}</div>
        <div style="display:flex;align-items:center;gap:8px;">
          <b>₹${fmt(e.amt)}</b>
          <div class="ic-actions"><button class="ic-btn edit-btn" title="Edit">✎</button><button class="ic-btn del-btn" title="Delete">✕</button></div>
        </div>
      </div>
      <div class="ic-meta">${esc(e.cat)} · ${esc(e.pay)}${e.payee?(' · to '+esc(e.payee)):''}</div>
      ${e.desc?`<div class="ic-desc">${esc(e.desc)}</div>`:''}
      ${badge}
    `;
    row.querySelector('.edit-btn').onclick = () => openExpenseEdit(e, dateStr);
    row.querySelector('.del-btn').onclick = () => { state.expenses[dateStr] = state.expenses[dateStr].filter(x=>x!==e); save(); changed(); };
    container.appendChild(row);
  });
}

// ---------- Wallet ----------
export function renderWallet(){
  const card = document.getElementById('walletCard');
  if (state.startBalance===null || state.startBalance===undefined){
    card.innerHTML = '<div class="empty">Set your starting balance to begin tracking.</div><button class="pill pill-ghost" style="width:100%;margin-top:8px" id="btnSetStart2">Set balance</button>';
    document.getElementById('btnSetStart2').onclick = () => { document.getElementById('startAmt').value=''; document.getElementById('startDate').value=todayISO; openModal('ovStart'); };
    return;
  }
  const deposited = state.deposits.filter(d=>d.date>=state.startDate&&d.date<=todayISO).reduce((a,d)=>a+Number(d.amt),0);
  const pool = Number(state.startBalance) + deposited;
  const balance = walletBalanceAsOf(todayISO);
  const pending = allExpenseItems().filter(e=>e.preDeducted && e.date>todayISO).reduce((s,e)=>s+Number(e.amt),0);
  card.innerHTML = `
    <div class="wallet-amt">₹${fmt(balance)}</div>
    ${pending>0?`<div class="wallet-note">Includes ₹${fmt(pending)} already pulled out for future-dated expenses.</div>`:''}
    <div class="wallet-bar"><i style="width:${pool>0?Math.min(100,Math.round((pool-balance)/pool*100)):0}%"></i></div>
    <div class="wallet-sub"><span>Used ₹${fmt(pool-balance)}</span><span>of ₹${fmt(pool)}</span></div>
    <div style="display:flex;gap:8px;margin-top:12px;">
      <button class="pill pill-ghost" style="flex:1" id="btnDeposit">+ Deposit</button>
      <button class="pill pill-ghost" style="flex:1" id="btnSetStart">Edit start</button>
    </div>`;
  document.getElementById('btnDeposit').onclick = () => { document.getElementById('depAmt').value=''; document.getElementById('depNote').value=''; openModal('ovDeposit'); };
  document.getElementById('btnSetStart').onclick = () => { document.getElementById('startAmt').value=state.startBalance; document.getElementById('startDate').value=state.startDate; openModal('ovStart'); };
}
document.getElementById('saveStart').onclick = () => {
  const amt = Number(document.getElementById('startAmt').value); const date = document.getElementById('startDate').value || todayISO;
  if (amt<0 || isNaN(amt)) return;
  state.startBalance = amt; state.startDate = date; save(); closeModal('ovStart'); changed();
};
document.getElementById('saveDeposit').onclick = () => {
  const amt = Number(document.getElementById('depAmt').value); if (!amt||amt<=0) return;
  const note = document.getElementById('depNote').value.trim();
  state.deposits.push({ amt, note, date: todayISO }); save(); closeModal('ovDeposit'); changed();
};

// ---------- Savings ----------
export function renderSavings(){
  const card = document.getElementById('savingsCard');
  card.innerHTML = `<div class="wallet-amt">₹${fmt(savingsBalance())}</div>
    <button class="pill pill-ghost" style="width:100%;margin-top:10px" id="btnSavManage">Move money</button>`;
  document.getElementById('btnSavManage').onclick = () => { document.getElementById('savAmt').value=''; document.getElementById('savNote').value=''; openModal('ovSavings'); };
}
document.getElementById('savDeposit').onclick = () => {
  const amt = Number(document.getElementById('savAmt').value); if (!amt||amt<=0) return;
  const note = document.getElementById('savNote').value.trim(); const bal = walletBalanceAsOf(todayISO);
  if (amt>bal){ alert(`Your wallet only has ₹${fmt(bal)}.`); return; }
  state.savingsMoves.push({ type:'deposit', amt, note, date: todayISO }); save(); closeModal('ovSavings'); changed();
};
document.getElementById('savWithdraw').onclick = () => {
  const amt = Number(document.getElementById('savAmt').value); if (!amt||amt<=0) return;
  const note = document.getElementById('savNote').value.trim(); const bal = savingsBalance();
  if (amt>bal){ alert(`Your savings only has ₹${fmt(bal)}.`); return; }
  state.savingsMoves.push({ type:'withdraw', amt, note, date: todayISO }); save(); closeModal('ovSavings'); changed();
};

// ---------- Borrowed money ----------
export function renderBorrows(){
  const card = document.getElementById('borrowsCard');
  const owed = debtOwed(); const unpaid = (state.borrows||[]).filter(b=>!b.paid).sort((a,b)=>a.date<b.date?-1:1);
  let html = `<div class="wallet-amt" style="color:${owed>0?'var(--brick)':'var(--ink)'}">₹${fmt(owed)}</div>`;
  html += unpaid.length ? unpaid.map(b=>`<div class="side-row"><span>${esc(b.lender)}${b.title?(' · '+esc(b.title)):''} · ₹${fmt(b.amt)}</span><button class="sl-btn" data-id="${b.id}">Pay back</button></div>`).join('')
    : '<div class="empty">Nothing owed right now.</div>';
  html += '<button class="pill pill-ghost" style="width:100%;margin-top:10px" id="btnAddBorrow">+ Borrowed money</button>';
  card.innerHTML = html;
  card.querySelectorAll('[data-id]').forEach(btn => btn.onclick = () => {
    const b = state.borrows.find(x=>x.id===btn.dataset.id); if (!b) return;
    attemptPayment(Number(b.amt), `paying back ${b.lender}`, () => { b.paid=true; b.paidDate=todayISO; save(); changed(); });
  });
  document.getElementById('btnAddBorrow').onclick = () => {
    document.getElementById('bAmt').value=''; document.getElementById('bTitle').value=''; document.getElementById('bDate').value=todayISO;
    populateCatSelect(document.getElementById('bLender'), state.lenders, 'lender'); document.getElementById('bLenderAdd').style.display='none';
    openModal('ovBorrow');
  };
}
document.getElementById('saveBorrow').onclick = () => {
  const amt = Number(document.getElementById('bAmt').value); if (!amt||amt<=0) return;
  const lender = document.getElementById('bLender').value, title = document.getElementById('bTitle').value.trim();
  const date = document.getElementById('bDate').value || todayISO;
  state.borrows.push({ id: uid('brw'), amt, lender, title, date, paid:false });
  save(); closeModal('ovBorrow'); changed();
};

// ---------- Waiting drawer (borrows + future expenses) ----------
export function renderPendingCount(){
  const borrowsDue = (state.borrows||[]).filter(b=>!b.paid).length;
  document.getElementById('pendingCnt').textContent = borrowsDue + futureExpenses().length;
}
export function renderPendingDrawer(){
  const unpaidBorrows = (state.borrows||[]).filter(b=>!b.paid);
  const pb = document.getElementById('pendBorrows');
  pb.innerHTML = unpaidBorrows.length ? unpaidBorrows.map(b=>`<div class="side-row"><span>${esc(b.lender)}${b.title?(' · '+esc(b.title)):''} · ₹${fmt(b.amt)}</span><button class="sl-btn" data-pay="${b.id}">Mark as paid</button></div>`).join('') : '<div class="empty">Nothing owed.</div>';
  pb.querySelectorAll('[data-pay]').forEach(btn => btn.onclick = () => {
    const b = state.borrows.find(x=>x.id===btn.dataset.pay); if (!b) return;
    attemptPayment(Number(b.amt), `paying back ${b.lender}`, () => { b.paid=true; b.paidDate=todayISO; save(); changed(); renderPendingDrawer(); });
  });

  const future = futureExpenses();
  const pf = document.getElementById('pendFuture');
  pf.innerHTML = future.length ? future.map(e=>`<div class="side-row"><span>${esc(e.title)} · ₹${fmt(e.amt)} · due ${e.date}</span>
    <span style="display:flex;gap:4px"><button class="sl-btn" data-paid="${e.id}">Mark paid</button><button class="sl-btn" data-edit="${e.id}">Edit</button><button class="sl-btn" data-del="${e.id}" style="color:var(--brick)">Delete</button></span></div>`).join('') : '<div class="empty">No future expenses waiting.</div>';
  pf.querySelectorAll('[data-paid]').forEach(btn => btn.onclick = () => { const e=future.find(x=>x.id===btn.dataset.paid); const t=state.expenses[e.date].find(x=>x.id===e.id); t.paid=true; save(); changed(); renderPendingDrawer(); });
  pf.querySelectorAll('[data-del]').forEach(btn => btn.onclick = () => {
    const e = future.find(x=>x.id===btn.dataset.del); if (!confirm('Delete this future expense? The amount returns to your wallet.')) return;
    state.expenses[e.date] = state.expenses[e.date].filter(x=>x.id!==e.id); save(); changed(); renderPendingDrawer();
  });
  pf.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = () => {
    const e = future.find(x=>x.id===btn.dataset.edit); const t=state.expenses[e.date].find(x=>x.id===e.id);
    closeModal('ovPending'); openExpenseEdit(t, e.date);
  });
  renderPendingCount();
}
document.getElementById('pendingBtn').onclick = () => { renderPendingDrawer(); openModal('ovPending'); };

// ---------- Category totals / statistics ----------
export function renderCatTotals(container){
  const totals = {};
  allExpenseItems().forEach(e => { totals[e.cat] = (totals[e.cat]||0) + Number(e.amt); });
  const cats = Object.keys(totals).sort((a,b)=>totals[b]-totals[a]);
  container.innerHTML = cats.length ? cats.map(c => `<div class="side-row"><span>${esc(c)}</span><b>₹${fmt(totals[c])}</b></div>`).join('') : '<div class="empty">No expenses logged yet.</div>';
}