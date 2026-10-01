// ---------- sync.js : decides when to save to / load from Drive ----------
import { state, replaceState, setCloudHandler } from './state.js';
import { pullFromDrive, pushToDrive } from './drive.js';
import { signIn } from './auth.js';

let active = false, syncing = false, queued = false, needsReauth = false;

const clock = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function setStatus(text, kind = 'idle'){
  const el = document.getElementById('syncStatus'); if (!el) return;
  el.textContent = text; el.className = 'sync-status mono ' + kind;
}

function handleError(e){
  console.error(e);
  if (e && e.code === 'auth'){ needsReauth = true; setStatus('Session expired — click to reconnect', 'err'); }
  else setStatus('Not saved — will retry on next change', 'err');
}

// push the current data to Drive (called automatically after every change)
export async function syncNow(){
  if (!active) return;
  if (syncing){ queued = true; return; }
  syncing = true; setStatus('Saving to Drive…', 'busy');
  try{
    await pushToDrive(state);
    needsReauth = false; setStatus('Saved to Drive · ' + clock(), 'ok');
  }catch(e){ handleError(e); }
  finally{
    syncing = false;
    if (queued){ queued = false; syncNow(); }
  }
}

// right after sign-in: the newer copy (this device vs Drive) wins
export async function initialSync(){
  setStatus('Checking Drive…', 'busy');
  try{
    const remote = await pullFromDrive();
    const localTime = state.updatedAt || 0;
    const remoteTime = (remote && remote.updatedAt) || 0;
    if (!remote || localTime > remoteTime){
      await pushToDrive(state);
      setStatus('Saved to Drive · ' + clock(), 'ok');
      return remote ? 'pushed' : 'created';
    }
    if (remoteTime > localTime){
      replaceState(remote);
      setStatus('Loaded from Drive · ' + clock(), 'ok');
      return 'pulled';
    }
    setStatus('Up to date · ' + clock(), 'ok');
    return 'same';
  }catch(e){ handleError(e); return 'error'; }
}

export function startAutoSync(){
  active = true;
  setCloudHandler(syncNow);
  const el = document.getElementById('syncStatus');
  el.onclick = async () => {
    if (!needsReauth) return;
    try{ await signIn(); needsReauth = false; syncNow(); }catch(e){ handleError(e); }
  };
}

export async function backupNow(){
  if (!active){ alert('Sign in with Google first.'); return; }
  await syncNow();
}

// replace this device's data with the Drive copy
export async function restoreFromDrive(){
  if (!active){ alert('Sign in with Google first.'); return false; }
  if (!confirm('Replace the data on this device with the copy saved in Google Drive?')) return false;
  try{
    setStatus('Loading from Drive…', 'busy');
    const remote = await pullFromDrive();
    if (!remote){ setStatus('No Drive file yet', 'err'); alert('There is no saved file in your Drive yet.'); return false; }
    replaceState(remote);
    setStatus('Loaded from Drive · ' + clock(), 'ok');
    return true;
  }catch(e){ handleError(e); return false; }
}