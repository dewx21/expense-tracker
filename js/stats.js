// ---------- stats.js : average spend over a custom date range ----------
import { allExpenseItems } from './state.js';
import { esc, iso, todayISO, DAY } from './utils.js';

const money = n => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

function addMonths(d, n){
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  return new Date(t.getFullYear(), t.getMonth(), Math.min(d.getDate(), last));
}

// how many days / weeks / months the range covers (both end dates included)
function periodCount(from, to, unit){
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1);
  const days = Math.round((end - from) / DAY);
  if (unit === 'day') return days;
  if (unit === 'week') return days / 7;
  let m = 0;
  while (addMonths(from, m + 1) <= end) m++;
  return m + Math.round((end - addMonths(from, m)) / DAY) / 30.44;
}

export function renderAverageStats(){
  const out = document.getElementById('avgResult');
  const fromStr = document.getElementById('avgFrom').value;
  const toStr = document.getElementById('avgTo').value;
  const unit = document.querySelector('input[name="avgUnit"]:checked').value;

  if (!fromStr || !toStr){ out.innerHTML = '<div class="empty">Pick both dates.</div>'; return; }
  if (toStr < fromStr){ out.innerHTML = '<div class="empty">The "To" date must be on or after the "From" date.</div>'; return; }

  const n = periodCount(parse(fromStr), parse(toStr), unit);
  const totals = {}; let total = 0;
  allExpenseItems().forEach(e => {
    if (e.date < fromStr || e.date > toStr) return;
    const a = Number(e.amt);
    total += a; totals[e.cat] = (totals[e.cat] || 0) + a;
  });

  const count = +n.toFixed(2);
  const span = `${count} ${unit}${count === 1 ? '' : 's'}`;
  if (!total){
    out.innerHTML = `<div class="wallet-sub"><span>${fromStr} → ${toStr}</span><span>${span}</span></div><div class="empty">No expenses in this range.</div>`;
    return;
  }

  const cats = Object.keys(totals).sort((a, b) => totals[b] - totals[a]);
  out.innerHTML = `
    <div class="wallet-sub" style="margin-bottom:8px;"><span>${fromStr} → ${toStr}</span><span>${span}</span></div>
    <div class="wallet-amt">${money(total / n)}<span class="avg-unit"> average / ${unit}</span></div>
    <div class="wallet-note" style="margin-bottom:10px;">Total spent in this range: ${money(total)}</div>
    ${cats.map(c => `
      <div class="side-row">
        <span>${esc(c)}</span>
        <span><b>${money(totals[c] / n)}</b> / ${unit} <span class="avg-total">· total ${money(totals[c])}</span></span>
      </div>`).join('')}
  `;
}

export function initStats(){
  document.getElementById('avgTo').value = todayISO;
  document.getElementById('avgFrom').value = iso(addMonths(parse(todayISO), -1));
  document.getElementById('avgCalc').onclick = renderAverageStats;
  // keep an already-shown result in sync when data changes
  window.addEventListener('data:changed', () => {
    if (document.getElementById('avgResult').innerHTML.trim()) renderAverageStats();
  });
}