// Helpers for the Planning modules (reports, check-in, activity, calendar,
// budget, tasks, copilot). Kept separate from lib/api.js so the core API client
// stays small and unchanged.
import { API } from './api.js';

// Download an authenticated file (CSV / PDF) by streaming the response and
// saving it as a Blob — a plain <a href> would omit the bearer token.
export async function downloadWithAuth(path, filename) {
  const token = localStorage.getItem('es_token');
  const res = await fetch(API + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    let message = 'Download failed.';
    try {
      message = (await res.json()).message || message;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function qs(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  });
  const text = search.toString();
  return text ? `?${text}` : '';
}

export const fmtDateTime = (value) => (value ? new Date(value).toLocaleString() : '—');
export const fmtDate = (value) => (value ? new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const fmtTime = (value) => (value ? new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '');
export const money = (value, currency = 'PKR') => `${currency} ${Number(value || 0).toLocaleString()}`;

// A YYYY-MM-DD string for <input type="date"> values.
export const isoDay = (date) => new Date(date).toISOString().slice(0, 10);

export const monthBounds = (date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
};
