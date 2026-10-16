// Central API + browser helpers.
// Keeping these in one small module keeps main.jsx focused on UI.

export const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export const SOCKET = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem('es_user') || 'null');
  } catch {
    return null;
  }
};

export async function api(path, opts = {}) {
  const token = localStorage.getItem('es_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(opts.headers || {}),
  };
  const request = base => fetch(base + path, { ...opts, headers });
  let r = await request(API);
  let contentType = r.headers.get('content-type') || '';

  if (contentType.includes('text/html') && API === '/api') {
    try {
      r = await request('http://localhost:5000/api');
      contentType = r.headers.get('content-type') || '';
    } catch {}
  }
  if (contentType.includes('text/html')) {
    throw Error('API returned the frontend page. Start the EventSphere backend on port 5000, then refresh.');
  }

  const raw = await r.text();
  let d = {};
  try {
    d = raw ? JSON.parse(raw) : {};
  } catch {
    throw Error('Server returned an invalid response. Please check the backend/API connection.');
  }
  if (!r.ok) throw Error(d.message || 'Request failed');
  return d;
}

export const downloadText = (filename, content, type = 'text/plain;charset=utf-8') => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
};

export const csvFromRows = rows =>
  rows
    .map(row => row.map(v => `"${String(v ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n');

export const formatMoney = value => `PKR ${Number(value || 0).toLocaleString()}`;

// Deterministic local portrait for a user/message row (our 6 bundled photos).
export const personImg = seed => {
  const s = String(seed ?? '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return `/images/people/avatar-${(s % 6) + 1}.jpg`;
};

// Deterministic local event photo (our 8 bundled gallery photos).
export const eventImg = seed => {
  const s = String(seed ?? '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return `/images/gallery/event-${(s % 8) + 1}.jpg`;
};
