// ---------- utils.js : formatting helpers, shared across modules ----------
export const DAY = 86400000;

export const iso = d => { const x = new Date(d); return new Date(x.getTime() - x.getTimezoneOffset()*60000).toISOString().slice(0,10); };
export const todayISO = iso(new Date());

export function fmt(n){ return Number(n||0).toLocaleString('en-IN'); }

export function esc(s){ const d = document.createElement('div'); d.textContent = s==null?'':String(s); return d.innerHTML; }

export function ordinal(n){ n = Math.round(n); const s = ['th','st','nd','rd'], v = n%100; return n + (s[(v-20)%10] || s[v] || s[0]); }

export function daysBetween(a, b){ return Math.round((new Date(b) - new Date(a)) / DAY); }

// Pastel tone classes, lifted from the reference image (yellow / blue / lavender / pink / grey)
const TONES = ['tone-yellow','tone-blue','tone-lavender','tone-pink','tone-grey'];
export function toneFor(name){
  let h = 0; for (let i=0;i<String(name).length;i++) h = (h*31 + name.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

export function uid(prefix){ return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }