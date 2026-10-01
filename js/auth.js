// ---------- auth.js : Google sign-in (Google Identity Services) ----------
import { GOOGLE_CLIENT_ID } from './config.js';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const SCOPES = 'openid email profile ' + DRIVE_SCOPE;
const HINT_KEY = 'intelly_signed_in';

let tokenClient = null;
let accessToken = null;
let expiresAt = 0;
let user = null;
let pending = null;
let inflight = null;

function waitForGoogle(timeout = 10000){
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    (function check(){
      if (window.google && google.accounts && google.accounts.oauth2) return resolve();
      if (Date.now() - t0 > timeout) return reject(new Error('Google sign-in could not load. Check your internet connection.'));
      setTimeout(check, 100);
    })();
  });
}

export async function initAuth(){
  if (tokenClient) return;
  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.startsWith('PASTE')){
    throw new Error('Add your Google Client ID in js/config.js first.');
  }
  await waitForGoogle();
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: SCOPES,
    callback: resp => {
      if (!pending) return;
      const p = pending; pending = null;
      if (resp.error) return p.reject(new Error(resp.error_description || resp.error));
      if (!google.accounts.oauth2.hasGrantedAllScopes(resp, DRIVE_SCOPE)){
        return p.reject(new Error('Google Drive permission was not granted. Tick the Drive checkbox and try again.'));
      }
      accessToken = resp.access_token;
      expiresAt = Date.now() + (Number(resp.expires_in) - 60) * 1000;
      p.resolve(accessToken);
    },
    error_callback: err => {
      if (!pending) return;
      const p = pending; pending = null;
      p.reject(new Error(err.type === 'popup_closed' ? 'Sign-in window was closed.' : (err.type || 'Sign-in failed.')));
    }
  });
}

function request(prompt){
  if (inflight) return inflight;
  inflight = new Promise((resolve, reject) => {
    pending = { resolve, reject };
    tokenClient.requestAccessToken({ prompt });
  }).finally(() => { inflight = null; });
  return inflight;
}

async function loadUser(){
  try{
    const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + accessToken } });
    user = r.ok ? await r.json() : null;
  }catch(e){ user = null; }
}

// Called from the "Continue with Google" button (needs a real click)
export async function signIn(){
  await initAuth();
  await request('select_account');
  await loadUser();
  localStorage.setItem(HINT_KEY, '1');
}

// Called on page load: works without a popup if you already allowed access before
export async function trySilentSignIn(){
  await initAuth();
  await request('none');
  await loadUser();
}

// Used by drive.js before every request; refreshes the 1-hour token quietly
export async function getToken(force = false){
  if (!force && accessToken && Date.now() < expiresAt) return accessToken;
  try{
    await initAuth();
    return await request('none');
  }catch(e){
    const err = new Error('Session expired'); err.code = 'auth'; throw err;
  }
}

export function signOut(){
  accessToken = null; user = null; expiresAt = 0;
  localStorage.removeItem(HINT_KEY);
}

export const hasSignedInBefore = () => !!localStorage.getItem(HINT_KEY);
export const getUser = () => user;