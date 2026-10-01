// ---------- main.js : entry point, wires every module together ----------
import { state, importData } from './state.js';
import { todayISO } from './utils.js';
import { initSidebar } from './sidebar.js';
import { openModal, initAddPopover, openEventModal, openNoteModal } from './modals.js';
import { openTaskModal } from './tasks.js';
import { openExpenseModal, renderWallet, renderSavings, renderBorrows, renderPendingCount, renderCatTotals } from './finance.js';
import { selected, renderSchedulePage } from './calendar.js';
import { initStats } from './stats.js';
import { signIn, trySilentSignIn, signOut, hasSignedInBefore, getUser } from './auth.js';
import { initialSync, startAutoSync, backupNow, restoreFromDrive, setStatus } from './sync.js';

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
document.getElementById('addExpenseOpt').onclick = () => openExpenseModal(selected);
initStats();

document.getElementById('todayJump').onclick = () => { window.dispatchEvent(new CustomEvent('data:changed')); };

// ---------- Google sign-in / Drive ----------
const loginScreen = document.getElementById('loginScreen');
const loginMsg = document.getElementById('loginMsg');

function renderAccount(){
  const u = getUser();
  document.getElementById('driveAccount').textContent = u
    ? 'Signed in as ' + (u.email || u.name)
    : 'Working on this device only — not signed in.';
  const nameEl = document.getElementById('greetName');
  if (u && u.given_name) nameEl.textContent = u.given_name;
}

async function enterApp(signedIn){
  loginScreen.classList.remove('show');
  renderAccount();
  if (signedIn){
    await initialSync();     // newer copy wins (this device vs Drive)
    startAutoSync();         // from now on, every change is saved to Drive
  } else {
    setStatus('Not syncing — this device only', 'idle');
  }
  renderAll();
  if (state.startBalance === null || state.startBalance === undefined){
    document.getElementById('startAmt').value = ''; document.getElementById('startDate').value = todayISO; openModal('ovStart');
  }
}

document.getElementById('googleSignIn').onclick = async () => {
  loginMsg.textContent = 'Opening Google…';
  try{ await signIn(); await enterApp(true); }
  catch(e){ console.error(e); loginMsg.textContent = e.message || 'Sign-in failed. Please try again.'; }
};
document.getElementById('offlineBtn').onclick = () => enterApp(false);

// sign out: forget the session and show the login screen again
document.getElementById('logoutItem').onclick = () => {
  if (!confirm('Sign out? Your data stays saved in Google Drive and on this device.')) return;
  signOut(); location.reload();
};

// ---------- settings: Drive backup / restore ----------
document.getElementById('btnBackupNow').onclick = backupNow;
document.getElementById('btnRestore').onclick = async () => { if (await restoreFromDrive()) renderAll(); };
document.getElementById('btnImportTrigger').onclick = () => document.getElementById('fileImport').click();
document.getElementById('fileImport').onchange = e => {
  const file = e.target.files[0]; if (!file) return;
  importData(file, ok => { alert(ok ? 'Backup imported.' : 'That file could not be read.'); renderAll(); });
  e.target.value = '';
};

document.getElementById('greetName').textContent = (document.body.dataset.userName) || 'there';

// ---------- start ----------
(async () => {
  if (hasSignedInBefore()){
    try{ await trySilentSignIn(); await enterApp(true); return; }
    catch(e){ console.warn('Silent sign-in did not work, showing login', e); }
  }
  // otherwise the login screen simply stays visible
})();