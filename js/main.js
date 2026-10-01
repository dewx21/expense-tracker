// ---------- main.js : entry point, wires every module together ----------
import { state, exportData, importData } from './state.js';
import { todayISO } from './utils.js';
import { initSidebar } from './sidebar.js';
import { openModal, initAddPopover, openEventModal, openNoteModal } from './modals.js';
import { openTaskModal } from './tasks.js';
import { renderWallet, renderSavings, renderBorrows, renderPendingCount, renderCatTotals } from './finance.js';
import { selected, renderSchedulePage } from './calendar.js';
import { initStats } from './stats.js';

function renderAll(){
  renderSchedulePage();
  renderWallet(); renderSavings(); renderBorrows(); renderPendingCount();
  renderCatTotals(document.getElementById('catTotalsWidget'));
  renderCatTotals(document.getElementById('statsCat'));
}
window.addEventListener('data:changed', renderAll);

initSidebar(page => {
  if (page === 'statistics') renderCatTotals(document.getElementById('statsCat'));
});
initAddPopover({
  onTask: () => openTaskModal(selected),
  onEvent: () => openEventModal(selected),
  onNote: () => openNoteModal(selected)
});
initStats();

document.getElementById('todayJump').onclick = () => { window.dispatchEvent(new CustomEvent('data:changed')); };

// ---------- settings: export / import ----------
document.getElementById('btnExport').onclick = exportData;
document.getElementById('btnImportTrigger').onclick = () => document.getElementById('fileImport').click();
document.getElementById('fileImport').onchange = e => {
  const file = e.target.files[0]; if (!file) return;
  importData(file, ok => { alert(ok ? 'Data imported.' : 'That file could not be read.'); renderAll(); });
};

document.getElementById('greetName').textContent = (document.body.dataset.userName) || 'there';

renderAll();
if (state.startBalance === null || state.startBalance === undefined){
  document.getElementById('startAmt').value = ''; document.getElementById('startDate').value = todayISO; openModal('ovStart');
}