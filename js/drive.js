// ---------- drive.js : read / write the ledger file in My Drive ----------
import { getToken } from './auth.js';
import { DRIVE_FILE_NAME } from './config.js';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const ID_KEY = 'intelly_drive_file_id';

let fileId = localStorage.getItem(ID_KEY) || null;
let validated = false;

async function api(url, opts = {}){
  const { allow404, ...init } = opts;
  for (let attempt = 0; attempt < 2; attempt++){
    const token = await getToken(attempt > 0);
    const res = await fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: 'Bearer ' + token } });
    if (res.status === 401 && attempt === 0) continue;
    if (res.ok || (allow404 && res.status === 404)) return res;
    break;
  }
  throw new Error('Google Drive request failed');
}

function remember(id){ fileId = id; validated = true; localStorage.setItem(ID_KEY, id); }
function forget(){ fileId = null; validated = false; localStorage.removeItem(ID_KEY); }

async function findFileId(){
  const q = encodeURIComponent(`name='${DRIVE_FILE_NAME}' and trashed=false`);
  const res = await api(`${API}/files?q=${q}&orderBy=modifiedTime%20desc&pageSize=1&fields=files(id)`);
  const j = await res.json();
  return (j.files && j.files[0]) ? j.files[0].id : null;
}

async function resolveId(){
  if (fileId && !validated){
    const res = await api(`${API}/files/${fileId}?fields=id,trashed`, { allow404: true });
    const meta = res.status === 404 ? null : await res.json();
    if (!meta || meta.trashed) forget(); else validated = true;
  }
  if (!fileId){
    const id = await findFileId();
    if (id) remember(id);
  }
  return fileId;
}

// returns the saved data, or null if no file exists yet
export async function pullFromDrive(){
  const id = await resolveId();
  if (!id) return null;
  const res = await api(`${API}/files/${id}?alt=media`, { allow404: true });
  if (res.status === 404){ forget(); return null; }
  return await res.json();
}

async function createFile(data){
  const boundary = 'intelly' + Math.random().toString(36).slice(2);
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name: DRIVE_FILE_NAME, mimeType: 'application/json' }) +
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
    JSON.stringify(data, null, 2) +
    `\r\n--${boundary}--`;
  const res = await api(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body
  });
  const j = await res.json();
  remember(j.id);
}

export async function pushToDrive(data){
  const id = await resolveId();
  if (id){
    const res = await api(`${UPLOAD}/files/${id}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data, null, 2),
      allow404: true
    });
    if (res.status !== 404) return;
    forget();
  }
  await createFile(data);
}